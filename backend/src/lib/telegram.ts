/**
 * Telegram Bot Integration for ERP MBG
 * - Link account via email
 * - Create IR via button or Excel upload
 * - Approve IR/PO via inline buttons
 * - Receive notifications on IR approved, DO delivered
 */

import TelegramBot from 'node-telegram-bot-api'
import * as XLSX from 'xlsx'
import { db } from '../db/index'
import { user, internalRequests, irItems, purchaseOrders, dapur, gudang, items as itemsTable, recipes, recipeIngredients, deliveryOrders, doItems, inventoryStock, inventoryMovements } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { createNotification } from './notify'

let bot: TelegramBot | null = null
const chatUserMap = new Map<number, { userId: string; name: string; role: string; dapurId?: string }>()
const userChatMap = new Map<string, number>()
const pendingExcelIR = new Map<number, { dapurId: string; dapurName: string; menuName: string; totalPorsi: number; items: any[] }>()

async function saveTelegramLink(userId: string, chatId: number, name: string, role: string) {
    chatUserMap.set(chatId, { userId, name, role })
    userChatMap.set(userId, chatId)
    try {
        const { createClient } = await import('@libsql/client')
        const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! })
        await client.execute({ sql: 'INSERT OR REPLACE INTO telegram_links (user_id, chat_id, user_name, user_role, linked_at) VALUES (?, ?, ?, ?, ?)', args: [userId, chatId, name, role, Date.now()] })
    } catch (e) { console.warn('[TG] save link error:', e) }
}

async function loadTelegramLinks() {
    try {
        const { createClient } = await import('@libsql/client')
        const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! })
        const res = await client.execute('SELECT user_id, chat_id, user_name, user_role FROM telegram_links')
        for (const row of res.rows) {
            chatUserMap.set(Number(row.chat_id), { userId: String(row.user_id), name: String(row.user_name || ''), role: String(row.user_role || '') })
            userChatMap.set(String(row.user_id), Number(row.chat_id))
        }
        console.log(`🤖 Loaded ${res.rows.length} Telegram links from DB`)
    } catch (e) { console.warn('[TG] load links error:', e) }
}

export function initTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) { console.log('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram bot disabled'); return }

    bot = new TelegramBot(token, { polling: true })
    console.log('🤖 Telegram bot started')
    loadTelegramLinks()

    // ── /start ────────────────────────────────────────────────────
    bot.onText(/\/start/, async (msg) => {
        await send(msg.chat.id, '🏭 <b>ERP MBG Bot</b>\n\nSelamat datang!\n\n📧 Kirim email ERP Anda untuk menghubungkan akun.\n📎 Atau langsung upload file Excel template SPPG untuk buat IR.')
    })

    // ── /help ─────────────────────────────────────────────────────
    bot.onText(/\/help/, async (msg) => {
        await send(msg.chat.id, '📋 <b>Perintah:</b>\n\n/ir — Buat IR (pilih dapur)\n/approve — Lihat pending approval\n/status IR-xxx — Cek status\n/me — Info akun\n📎 Upload Excel — Buat IR dari template SPPG')
    })

    // ── /me ───────────────────────────────────────────────────────
    bot.onText(/\/me/, async (msg) => {
        const u = chatUserMap.get(msg.chat.id)
        if (!u) return send(msg.chat.id, '❌ Kirim email ERP untuk menghubungkan akun.')
        await send(msg.chat.id, `👤 <b>${esc(u.name)}</b>\n🔑 ${esc(u.role)}`)
    })

    // ── Email linking ─────────────────────────────────────────────
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id
        const text = msg.text?.trim() || ''
        if (text.startsWith('/')) return
        if (text.includes('@') && !chatUserMap.has(chatId)) {
            const found = await db.query.user.findFirst({ where: eq(user.email, text.toLowerCase()) })
            if (found) {
                await saveTelegramLink(found.id, chatId, found.name, found.role)
                await send(chatId, `✅ Akun terhubung!\n\n👤 <b>${esc(found.name)}</b>\n📧 ${esc(found.email)}\n🔑 ${esc(found.role)}\n\nKetik /help untuk perintah.`)
            } else {
                await send(chatId, '❌ Email tidak ditemukan di sistem ERP.')
            }
        }
    })

    // ── File Upload (Excel template) ──────────────────────────────
    bot.on('document', async (msg) => {
        const chatId = msg.chat.id
        const u = chatUserMap.get(chatId)
        if (!u) return send(chatId, '❌ Hubungkan akun dulu. Kirim email ERP Anda.')

        const doc = msg.document
        if (!doc) return
        const fileName = doc.file_name || ''
        if (!fileName.match(/\.(xlsx|xls|csv)$/i)) return send(chatId, '❌ Kirim file Excel (.xlsx) atau CSV.')

        await send(chatId, '⏳ Memproses file...')

        try {
            // Download file from Telegram
            const fileLink = await bot!.getFileLink(doc.file_id)
            const response = await fetch(fileLink)
            const buffer = Buffer.from(await response.arrayBuffer())

            // Parse Excel
            let lines: string[] = []
            if (fileName.match(/\.xlsx?$/i)) {
                const wb = XLSX.read(buffer, { type: 'buffer' })
                const ws = wb.Sheets[wb.SheetNames[0]]
                const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' })
                lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
            } else {
                lines = buffer.toString('utf-8').split('\n').map(l => l.trim()).filter(Boolean)
            }

            // Parse template (same logic as web endpoint)
            const parsed = await parseTemplate(lines)

            if (parsed.items.length === 0) {
                return send(chatId, '❌ Tidak ada item yang terdeteksi dari file. Pastikan format sesuai template SPPG.')
            }

            // Store pending IR data
            pendingExcelIR.set(chatId, parsed)

            let msg2 = `📦 <b>Template SPPG Terdeteksi!</b>\n\n`
            if (parsed.dapurName) msg2 += `🏠 Dapur: <b>${esc(parsed.dapurName)}</b>\n`
            if (parsed.menuName && parsed.menuName !== '(tidak terdeteksi)') msg2 += `🍽️ Menu: ${esc(parsed.menuName.slice(0, 60))}\n`
            if (parsed.totalPorsi) msg2 += `👥 Porsi: ${parsed.totalPorsi}\n`
            msg2 += `📋 Item: ${parsed.items.length} bahan\n`
            const newItems = parsed.items.filter((i: any) => i.isNew).length
            if (newItems > 0) msg2 += `🆕 ${newItems} item baru otomatis dibuat\n`
            msg2 += `\nPilih gudang sumber untuk membuat IR:`

            const gudangs = await db.query.gudang.findMany({ where: eq(gudang.isActive, true) })
            const buttons = gudangs.map(g => [{ text: g.name, callback_data: `excel_ir_gudang:${g.id}` }])
            buttons.push([{ text: '❌ Batal', callback_data: 'excel_ir_cancel' }])

            await bot!.sendMessage(chatId, msg2, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } })
        } catch (e: any) {
            await send(chatId, `❌ Error: ${esc(e.message || 'Gagal parse file')}`)
        }
    })

    // ── /ir (manual) ──────────────────────────────────────────────
    bot.onText(/\/ir/, async (msg) => {
        const u = chatUserMap.get(msg.chat.id)
        if (!u) return send(msg.chat.id, '❌ Hubungkan akun dulu.')
        const dapurs = await db.query.dapur.findMany({ where: eq(dapur.isActive, true) })
        if (dapurs.length === 0) return send(msg.chat.id, '❌ Belum ada dapur.')
        const buttons = dapurs.map(d => [{ text: d.name, callback_data: `ir_dapur:${d.id}` }])
        await bot!.sendMessage(msg.chat.id, '📦 <b>Buat IR</b>\nPilih dapur:', { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } })
    })

    // ── /approve ──────────────────────────────────────────────────
    bot.onText(/\/approve/, async (msg) => {
        const u = chatUserMap.get(msg.chat.id)
        if (!u) return send(msg.chat.id, '❌ Hubungkan akun dulu.')
        const irs = (await db.query.internalRequests.findMany({ with: { dapur: true } })).filter(r => r.status === 'pending')
        const pos = (await db.query.purchaseOrders.findMany({ with: { vendor: true } })).filter(p => p.status === 'pending_approval')
        if (irs.length === 0 && pos.length === 0) return send(msg.chat.id, '✅ Tidak ada yang menunggu approval.')

        let text = '📋 <b>Menunggu Approval:</b>\n\n'
        const buttons: any[][] = []
        for (const ir of irs.slice(0, 5)) {
            text += `📦 <b>${esc(ir.irNumber)}</b> — ${esc(ir.dapur?.name || '-')}\n`
            buttons.push([{ text: `✅ ${ir.irNumber}`, callback_data: `approve_ir:${ir.id}` }])
        }
        for (const po of pos.slice(0, 5)) {
            text += `🛒 <b>${esc(po.poNumber)}</b> — ${esc(po.vendor?.name || '-')}\n`
            buttons.push([{ text: `✅ ${po.poNumber}`, callback_data: `approve_po:${po.id}` }, { text: `❌ Reject`, callback_data: `reject_po:${po.id}` }])
        }
        await bot!.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } })
    })

    // ── /status ───────────────────────────────────────────────────
    bot.onText(/\/status (.+)/, async (msg, match) => {
        const q = (match?.[1] || '').trim().toUpperCase()
        if (q.startsWith('IR-')) {
            const found = (await db.query.internalRequests.findMany({ with: { dapur: true } })).find(r => r.irNumber.toUpperCase() === q)
            if (found) return send(msg.chat.id, `📦 <b>${esc(found.irNumber)}</b>\nDapur: ${esc(found.dapur?.name || '-')}\nStatus: <b>${esc(found.status)}</b>`)
        } else if (q.startsWith('PO-')) {
            const found = (await db.query.purchaseOrders.findMany({ with: { vendor: true } })).find(p => p.poNumber.toUpperCase() === q)
            if (found) return send(msg.chat.id, `🛒 <b>${esc(found.poNumber)}</b>\nVendor: ${esc(found.vendor?.name || '-')}\nStatus: <b>${esc(found.status)}</b>`)
        }
        await send(msg.chat.id, '❌ Tidak ditemukan. Format: /status IR-123456')
    })

    // ── Callback Queries ──────────────────────────────────────────
    bot.on('callback_query', async (q) => {
        const chatId = q.message?.chat.id
        const msgId = q.message?.message_id
        if (!chatId) return
        const u = chatUserMap.get(chatId)
        if (!u) return bot!.answerCallbackQuery(q.id, { text: '❌ Akun belum terhubung' })
        const data = q.data || ''

        try {
            // Approve IR
            if (data.startsWith('approve_ir:')) {
                const ir = await db.query.internalRequests.findFirst({
                    where: eq(internalRequests.id, data.split(':')[1]),
                    with: { items: { with: { item: true } }, dapur: true, gudang: true },
                })
                if (!ir || ir.status !== 'pending') return bot!.answerCallbackQuery(q.id, { text: '⚠️ Sudah diproses' })

                // Update IR status
                await db.update(internalRequests).set({ status: 'approved', approvedBy: u.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(internalRequests.id, ir.id))

                // ── Auto-create DO (draft) — same logic as web ──
                const doId2 = randomUUID()
                const doNumber2 = `DO-${Date.now().toString().slice(-6)}`
                const now2 = new Date()
                const doLineItems: Array<{ id: string; doId: string; itemId: string; qtyDelivered: number; unitCost: number; totalCost: number; sellPrice: number; sellTotal: number }> = []

                for (const irItem of (ir.items || [])) {
                    const stock = await db.query.inventoryStock.findFirst({
                        where: and(eq(inventoryStock.itemId, irItem.itemId), eq(inventoryStock.gudangId, ir.gudangId), eq(inventoryStock.locationType, 'gudang')),
                    })
                    const unitCost = stock?.avgCost ?? 0
                    doLineItems.push({
                        id: randomUUID(), doId: doId2, itemId: irItem.itemId,
                        qtyDelivered: irItem.qtyRequested, unitCost, totalCost: irItem.qtyRequested * unitCost,
                        sellPrice: 0, sellTotal: 0,
                    })
                }

                await db.insert(deliveryOrders).values({
                    id: doId2, doNumber: doNumber2, irId: ir.id, gudangId: ir.gudangId, dapurId: ir.dapurId,
                    status: 'draft', notes: `Auto dari ${ir.irNumber} (via Telegram)`,
                    totalValue: 0, createdBy: u.userId, createdAt: now2, updatedAt: now2,
                })
                for (const li of doLineItems) await db.insert(doItems).values(li)

                await createNotification({ userId: ir.requestedBy, type: 'ir_approved', title: 'IR Disetujui', message: `${ir.irNumber} disetujui. DO ${doNumber2} dibuat otomatis.`, link: '/supply-chain/requests', refType: 'ir', refId: ir.id }).catch(() => {})

                // Notify via Telegram
                await notifyIRApproved(ir.requestedBy, ir.irNumber, doNumber2, doId2, false)

                await bot!.answerCallbackQuery(q.id, { text: '✅ Approved + DO dibuat!' })
                await bot!.editMessageText(`✅ <b>${esc(ir.irNumber)}</b> disetujui oleh ${esc(u.name)}\n📦 DO: <b>${doNumber2}</b> (Draft)`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' })
            }

            // Approve PO
            if (data.startsWith('approve_po:')) {
                const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, data.split(':')[1]) })
                if (!po || po.status !== 'pending_approval') return bot!.answerCallbackQuery(q.id, { text: '⚠️ Sudah diproses' })
                await db.update(purchaseOrders).set({ status: 'open', updatedAt: new Date() }).where(eq(purchaseOrders.id, po.id))
                await createNotification({ userId: po.createdBy, type: 'po_approved', title: 'PO Disetujui', message: `${po.poNumber} disetujui oleh ${u.name} via Telegram`, link: '/purchase/po', refType: 'po', refId: po.id }).catch(() => {})
                await sendToUser(po.createdBy, `✅ <b>${esc(po.poNumber)}</b> telah disetujui oleh ${esc(u.name)}.\nStatus: <b>Open</b>`)
                await bot!.answerCallbackQuery(q.id, { text: '✅ Approved!' })
                await bot!.editMessageText(`✅ <b>${esc(po.poNumber)}</b> disetujui oleh ${esc(u.name)}`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' })
            }

            // Reject PO
            if (data.startsWith('reject_po:')) {
                const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, data.split(':')[1]) })
                if (!po || po.status !== 'pending_approval') return bot!.answerCallbackQuery(q.id, { text: '⚠️ Sudah diproses' })
                await db.update(purchaseOrders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(purchaseOrders.id, po.id))
                await createNotification({ userId: po.createdBy, type: 'po_rejected', title: 'PO Ditolak', message: `${po.poNumber} ditolak oleh ${u.name}`, link: '/purchase/po', refType: 'po', refId: po.id }).catch(() => {})
                await sendToUser(po.createdBy, `❌ <b>${esc(po.poNumber)}</b> ditolak oleh ${esc(u.name)}.`)
                await bot!.answerCallbackQuery(q.id, { text: '❌ Rejected' })
                await bot!.editMessageText(`❌ <b>${esc(po.poNumber)}</b> ditolak oleh ${esc(u.name)}`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' })
            }

            // Manual IR — dapur selection
            if (data.startsWith('ir_dapur:')) {
                const gudangs = await db.query.gudang.findMany({ where: eq(gudang.isActive, true) })
                const buttons = gudangs.map(g => [{ text: g.name, callback_data: `ir_gudang:${data.split(':')[1]}:${g.id}` }])
                await bot!.editMessageText('📦 Pilih gudang sumber:', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: buttons } })
            }

            // Manual IR — create
            if (data.startsWith('ir_gudang:')) {
                const parts = data.split(':')
                const irId = randomUUID(), irNumber = `IR-${Date.now().toString().slice(-6)}`, now = new Date()
                await db.insert(internalRequests).values({ id: irId, irNumber, dapurId: parts[1], gudangId: parts[2], status: 'pending', requestDate: now, notes: `Via Telegram — ${u.name}`, requestedBy: u.userId, createdAt: now, updatedAt: now })
                await createNotification({ role: 'admin', type: 'ir_pending_approval', title: 'IR Baru', message: `${irNumber} oleh ${u.name} via Telegram`, link: '/supply-chain/requests', refType: 'ir', refId: irId }).catch(() => {})
                await bot!.editMessageText(`✅ <b>IR Dibuat!</b>\n\n📦 <b>${irNumber}</b>\nStatus: Menunggu Approval\n\n<i>Tambahkan item di web ERP.</i>`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' })
            }

            // Excel IR — gudang selection → create IR with items
            if (data.startsWith('excel_ir_gudang:')) {
                const gudangId = data.split(':')[1]
                const pending = pendingExcelIR.get(chatId)
                if (!pending) return bot!.answerCallbackQuery(q.id, { text: '⚠️ Data expired, upload ulang' })

                const irId = randomUUID(), irNumber = `IR-${Date.now().toString().slice(-6)}`, now = new Date()
                await db.insert(internalRequests).values({
                    id: irId, irNumber, dapurId: pending.dapurId || '', gudangId,
                    status: 'pending', requestDate: now,
                    notes: `Via Telegram (${pending.menuName || 'Excel'}) — ${u.name}`,
                    requestedBy: u.userId, createdAt: now, updatedAt: now,
                })

                for (const item of pending.items) {
                    if (item.itemId) {
                        await db.insert(irItems).values({
                            id: randomUUID(), irId, itemId: item.itemId,
                            qtyRequested: item.qtyRequested, qtyFulfilled: 0, notes: '',
                        })
                    }
                }

                pendingExcelIR.delete(chatId)
                await createNotification({ role: 'admin', type: 'ir_pending_approval', title: 'IR Baru via Telegram', message: `${irNumber} (${pending.items.length} item) oleh ${u.name}`, link: '/supply-chain/requests', refType: 'ir', refId: irId }).catch(() => {})

                await bot!.editMessageText(
                    `✅ <b>IR Dibuat dari Template!</b>\n\n📦 <b>${irNumber}</b>\n📋 ${pending.items.length} item\n🍽️ ${esc((pending.menuName || '').slice(0, 50))}\n👥 ${pending.totalPorsi} porsi\nStatus: Menunggu Approval`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }
                )
            }

            if (data === 'excel_ir_cancel') {
                pendingExcelIR.delete(chatId)
                await bot!.editMessageText('❌ Dibatalkan.', { chat_id: chatId, message_id: msgId })
            }

            // Confirm DO — deduct gudang stock, set status delivered, notify
            if (data.startsWith('confirm_do:')) {
                const doId = data.split(':')[1]
                const doRecord = await db.query.deliveryOrders.findFirst({
                    where: eq(deliveryOrders.id, doId),
                    with: { items: { with: { item: true } }, dapur: true, request: true },
                })
                if (!doRecord) return bot!.answerCallbackQuery(q.id, { text: '❌ DO tidak ditemukan' })
                if (doRecord.status !== 'draft') {
                    console.log(`[TG] DO ${doRecord.doNumber} status=${doRecord.status}, skipping confirm`)
                    // If already delivered, send the surat jalan link anyway
                    if (doRecord.status === 'delivered' || doRecord.status === 'confirmed') {
                        const irNum = doRecord.request?.irNumber || '-'
                        const url = process.env.FRONTEND_URL || 'http://localhost:5173'
                        const sjUrl2 = `${url}/supply-chain/delivery-orders/${doId}/print`
                        await bot!.answerCallbackQuery(q.id, { text: 'DO sudah terkirim' })
                        await bot!.sendMessage(chatId,
                            `📄 <b>${esc(doRecord.doNumber)}</b> sudah berstatus <b>${doRecord.status}</b>.\n\n📋 Ref IR: <b>${esc(irNum)}</b>\n\n📄 Surat Jalan:\n${sjUrl2}`,
                            { parse_mode: 'HTML' }
                        ).catch(() => {})
                        return
                    }
                    return bot!.answerCallbackQuery(q.id, { text: `⚠️ DO status: ${doRecord.status}` })
                }

                // Deduct gudang stock
                for (const li of doRecord.items) {
                    const stock = await db.query.inventoryStock.findFirst({
                        where: and(eq(inventoryStock.itemId, li.itemId), eq(inventoryStock.gudangId, doRecord.gudangId), eq(inventoryStock.locationType, 'gudang')),
                    })
                    if (stock) {
                        const newQty = Math.max(0, stock.qty - li.qtyDelivered)
                        await db.update(inventoryStock).set({ qty: newQty, totalValue: newQty * stock.avgCost, updatedAt: new Date() }).where(eq(inventoryStock.id, stock.id))
                        await db.insert(inventoryMovements).values({
                            id: randomUUID(), itemId: li.itemId, movementType: 'out_distribution', locationType: 'gudang',
                            gudangId: doRecord.gudangId, qty: -li.qtyDelivered, unitCost: stock.avgCost,
                            totalCost: li.qtyDelivered * stock.avgCost, refType: 'do', refId: doId, createdAt: new Date(),
                        })
                    }
                }

                // Update DO status
                await db.update(deliveryOrders).set({ status: 'delivered', deliveryDate: new Date(), updatedAt: new Date() }).where(eq(deliveryOrders.id, doId))

                // Update IR status
                if (doRecord.irId) {
                    await db.update(internalRequests).set({ status: 'in_transit' as any, updatedAt: new Date() }).where(eq(internalRequests.id, doRecord.irId))
                }

                const irNumber = doRecord.request?.irNumber || '-'
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

                // Edit the original message
                await bot!.answerCallbackQuery(q.id, { text: '🚚 DO Terkirim!' })
                await bot!.editMessageText(
                    `🚚 <b>${esc(doRecord.doNumber)}</b> telah dikirim!\n\nStatus: <b>Terkirim</b>\nDapur: ${esc(doRecord.dapur?.name || '-')}`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }
                ).catch(() => {})

                // Send NEW message with delivery details + surat jalan link
                const sjUrl = `${frontendUrl}/supply-chain/delivery-orders/${doId}/print`
                const isHttps = frontendUrl.startsWith('https')
                console.log(`[TG] Sending delivery notification for ${doRecord.doNumber} to chat ${chatId}`)
                await bot!.sendMessage(chatId,
                    `🚚 <b>DO Terkirim!</b>\n\n` +
                    `📦 DO: <b>${esc(doRecord.doNumber)}</b>\n` +
                    `📋 Ref IR: <b>${esc(irNumber)}</b>\n` +
                    `🏠 Dapur: ${esc(doRecord.dapur?.name || '-')}\n` +
                    `Status IR: <b>Dalam Pengiriman</b>\n\n` +
                    `📄 Surat Jalan:\n${sjUrl}`,
                    {
                        parse_mode: 'HTML',
                        ...(isHttps ? { reply_markup: { inline_keyboard: [[{ text: '📄 Buka Surat Jalan', url: sjUrl }]] } } : {}),
                    }
                ).catch(err => console.warn('[TG] Failed to send delivery msg:', err.message))
            }
        } catch (e: any) {
            await bot!.answerCallbackQuery(q.id, { text: `❌ ${(e.message || '').slice(0, 50)}` }).catch(() => {})
        }
    })
}

// ── Template Parser (shared with web) ─────────────────────────────────────────
async function parseTemplate(lines: string[]) {
    const allItems = await db.query.items.findMany()
    const allDapur = await db.query.dapur.findMany()

    let dapurName = '', dapurId = '', menuName = '', totalPorsi = 0
    const items: any[] = []
    let inItemTable = false

    for (const line of lines) {
        if (!dapurName && /dapur\s+(cabang|pusat)/i.test(line)) {
            const m = line.match(/(dapur\s+.+)/i)
            if (m) {
                dapurName = m[1].replace(/[–—-]\s*$/, '').trim()
                const match = allDapur.find(d => d.name.toLowerCase().includes(dapurName.toLowerCase()) || dapurName.toLowerCase().includes(d.name.toLowerCase().replace('dapur ', '')))
                if (match) { dapurId = match.id; dapurName = match.name }
            }
        }
        if (!totalPorsi && /total\s+penerima/i.test(line)) {
            const m = line.match(/(\d[\d.,]*)\s*(orang|porsi)?/i)
            if (m) totalPorsi = parseInt(m[1].replace(/[.,]/g, ''))
        }
        if (!menuName && totalPorsi > 0 && !inItemTable && !/^(no|bahan|\d)/i.test(line) && !/total/i.test(line) && !/nota/i.test(line) && !/satuan/i.test(line) && !/sppg/i.test(line)) {
            if (line.includes(',') || (line.length > 10 && !/dapur/i.test(line))) {
                menuName = line.replace(/\t/g, ', ').trim()
            }
        }
        if (/^no\b/i.test(line) && /bahan/i.test(line)) { inItemTable = true; continue }
        if (inItemTable) {
            let parts = line.split(/\t+/).map(s => s.trim()).filter(Boolean)
            if (parts.length < 3) parts = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean)
            if (parts.length >= 3 && /^\d+$/.test(parts[0])) {
                const itemName = parts[1].trim()
                const qtyMatch = parts.slice(2).join(' ').trim().match(/([\d.,]+)\s*(.*)/)
                if (!qtyMatch) continue
                const qty = parseFloat(qtyMatch[1].replace(',', '.'))
                const uom = qtyMatch[2]?.trim() || ''
                if (isNaN(qty) || qty <= 0) continue

                let itemMatch = allItems.find(i => i.name.toLowerCase() === itemName.toLowerCase() || i.name.toLowerCase().includes(itemName.toLowerCase()) || itemName.toLowerCase().includes(i.name.toLowerCase()))
                let isNew = false

                // Auto-create missing item
                if (!itemMatch) {
                    const newId = randomUUID()
                    const maxNum = allItems.filter(i => i.sku.startsWith('ITM-')).map(i => parseInt(i.sku.replace('ITM-', '')) || 0).reduce((a, b) => Math.max(a, b), 0)
                    const newSku = `ITM-${String(maxNum + 1 + items.filter(i => i.isNew).length).padStart(4, '0')}`
                    const now = new Date()
                    await db.insert(itemsTable).values({ id: newId, sku: newSku, name: itemName, category: 'Bahan Baku', uom: uom || 'kg', minStock: 0, isActive: true, createdAt: now, updatedAt: now })
                    itemMatch = { id: newId, name: itemName, sku: newSku } as any
                    allItems.push(itemMatch as any)
                    isNew = true
                }

                items.push({ itemId: itemMatch!.id, itemName: itemMatch!.name, qtyRequested: qty, uom: uom || (itemMatch as any)?.uom || '', isNew })
            }
        }
    }

    // Auto-create BOM
    console.log(`[TG-PARSE] dapur=${dapurName} menu=${menuName} porsi=${totalPorsi} items=${items.length} newItems=${items.filter(i => i.isNew).length}`)
    if (menuName && menuName !== '(tidak terdeteksi)' && items.length > 0) {
        const existing = (await db.query.recipes.findMany()).find(r => r.name.toLowerCase() === menuName.slice(0, 100).toLowerCase())
        if (!existing) {
            const recipeId = randomUUID(), now = new Date()
            const maxRcp = (await db.query.recipes.findMany()).filter(r => r.code.startsWith('RCP-')).map(r => parseInt(r.code.replace('RCP-', '')) || 0).reduce((a, b) => Math.max(a, b), 0)
            await db.insert(recipes).values({ id: recipeId, code: `RCP-${String(maxRcp + 1).padStart(4, '0')}`, name: menuName.slice(0, 100), defaultYield: totalPorsi || 1000, description: 'Auto dari Telegram', isActive: true, createdAt: now, updatedAt: now })
            for (const item of items) {
                if (item.itemId) await db.insert(recipeIngredients).values({ id: randomUUID(), recipeId, itemId: item.itemId, quantity: item.qtyRequested, uom: item.uom || 'kg', createdAt: now, updatedAt: now })
            }
        }
    }

    return { dapurId, dapurName: dapurName || '(tidak terdeteksi)', menuName: menuName || '(tidak terdeteksi)', totalPorsi, items }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function send(chatId: number, text: string) { return bot!.sendMessage(chatId, text, { parse_mode: 'HTML' }) }
function esc(s: string) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

/** Get chatId from DB directly (reliable, no in-memory dependency) */
async function getChatIdForUser(userId: string): Promise<number | null> {
    // Check memory first
    if (userChatMap.has(userId)) return userChatMap.get(userId)!
    // Query DB
    try {
        const { createClient } = await import('@libsql/client')
        const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! })
        const res = await client.execute({ sql: 'SELECT chat_id FROM telegram_links WHERE user_id = ?', args: [userId] })
        if (res.rows[0]) {
            const chatId = Number(res.rows[0].chat_id)
            userChatMap.set(userId, chatId) // cache it
            return chatId
        }
    } catch (e) { console.warn('[TG] DB lookup error:', e) }
    return null
}

/** Get all admin chat IDs from DB */
async function getAllAdminChatIds(): Promise<number[]> {
    const ids: number[] = []
    try {
        const { createClient } = await import('@libsql/client')
        const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! })
        const res = await client.execute("SELECT tl.chat_id FROM telegram_links tl JOIN user u ON tl.user_id = u.id WHERE u.role IN ('owner','super_admin','admin')")
        for (const row of res.rows) ids.push(Number(row.chat_id))
    } catch (e) { console.warn('[TG] admin lookup error:', e) }
    return ids
}

async function sendToUser(userId: string, text: string, opts?: any) {
    if (!bot) return
    const chatId = await getChatIdForUser(userId)
    if (chatId) {
        console.log(`[TG] Sending to user ${userId} chat ${chatId}`)
        await bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts }).catch(e => console.warn('[TG] send error:', e.message))
    } else {
        console.log(`[TG] No chat found for user ${userId}`)
    }
}

async function sendToAdmins(text: string, opts?: any) {
    if (!bot) return
    const chatIds = await getAllAdminChatIds()
    console.log(`[TG] Sending to ${chatIds.length} admins`)
    for (const chatId of chatIds) {
        await bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts }).catch(e => console.warn('[TG] admin send error:', e.message))
    }
}

// ── Public notification functions ─────────────────────────────────────────────

export async function sendTelegramNotification(userId: string, message: string) {
    await sendToUser(userId, message)
}

export async function sendTelegramToRole(role: string, message: string) {
    await sendToAdmins(message)
}

/** IR approved → notify requester with status update */
export async function notifyIRApproved(userId: string, irNumber: string, doNumber: string, doId: string, hasShortages: boolean) {
    if (!bot) return
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const isHttps = frontendUrl.startsWith('https')

    let msg = `✅ <b>${esc(irNumber)} Disetujui!</b>\n\n`
    msg += `📦 DO otomatis dibuat: <b>${esc(doNumber)}</b>\n`
    msg += `Status DO: <b>Draft</b>\n`
    if (hasShortages) msg += `⚠️ Beberapa item stok kurang di gudang.\n`

    await sendToUser(userId, msg)
    const adminChats = await getAllAdminChatIds()
    const requesterChat = await getChatIdForUser(userId)
    for (const chatId of adminChats) {
        if (chatId === requesterChat) continue
        await bot.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    }
}

/** DO delivered → notify requester with surat jalan link */
export async function notifyDODelivered(userId: string, doNumber: string, doId: string, irNumber: string) {
    if (!bot) return
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const sjUrl = `${frontendUrl}/supply-chain/delivery-orders/${doId}/print`
    console.log(`[TG] notifyDODelivered: user=${userId} DO=${doNumber}`)

    const msg = `🚚 <b>DO Terkirim!</b>\n\n` +
        `📦 DO: <b>${esc(doNumber)}</b>\n` +
        `📋 Ref IR: <b>${esc(irNumber)}</b>\n` +
        `Status: <b>Terkirim</b>\n\n` +
        `📄 Surat Jalan:\n${sjUrl}`

    // Use inline button only if HTTPS, otherwise plain text link
    const isHttps = frontendUrl.startsWith('https')
    const opts = isHttps
        ? { reply_markup: { inline_keyboard: [[{ text: '📄 Buka Surat Jalan (PDF)', url: sjUrl }]] } }
        : {}

    await sendToUser(userId, msg, opts)
    await sendToAdmins(`🚚 <b>${esc(doNumber)}</b> terkirim. Ref IR: <b>${esc(irNumber)}</b>`)
}

/** KR complete → notify requester with detailed item breakdown */
export async function notifyIRReceived(
    userId: string, irNumber: string, doNumber: string, krNumber: string,
    isPartial: boolean,
    acceptedItems: Array<{ name: string; qtyExpected: number; qtyActual: number; uom: string }>,
    rejectedItems: Array<{ name: string; qtyExpected: number; qtyActual: number; qtyRejected: number; uom: string; reason: string }>,
    invoiceNumber?: string,
) {
    if (!bot) return
    const status = isPartial ? 'Partial Diterima' : 'Diterima Penuh'
    const emoji = isPartial ? '📦' : '✅'
    console.log(`[TG] notifyIRReceived: user=${userId} IR=${irNumber} DO=${doNumber} KR=${krNumber} partial=${isPartial} accepted=${acceptedItems.length} rejected=${rejectedItems.length}`)

    let msg = `${emoji} <b>Kitchen Receiving Selesai!</b>\n\n`
    msg += `📋 No. IR: <b>${esc(irNumber)}</b>\n`
    msg += `🚚 No. DO: <b>${esc(doNumber)}</b>\n`
    msg += `📝 No. KR: <b>${esc(krNumber)}</b>\n`
    msg += `📊 Status: <b>${status}</b>\n`
    if (invoiceNumber) msg += `🧾 Invoice: <b>${esc(invoiceNumber)}</b>\n`

    // Accepted items
    if (acceptedItems.length > 0) {
        msg += `\n✅ <b>Barang Diterima:</b>\n`
        for (const item of acceptedItems) {
            msg += `  • ${esc(item.name)} — <b>${item.qtyActual}</b> ${esc(item.uom)}`
            if (item.qtyActual < item.qtyExpected) {
                msg += ` <i>(dari ${item.qtyExpected})</i>`
            }
            msg += `\n`
        }
    }

    // Rejected items
    if (rejectedItems.length > 0) {
        msg += `\n❌ <b>Barang Ditolak / Tidak Diterima:</b>\n`
        for (const item of rejectedItems) {
            msg += `  • ${esc(item.name)} — <b>${item.qtyRejected}</b> ${esc(item.uom)}`
            if (item.reason) msg += ` (${esc(item.reason)})`
            msg += `\n`
        }
    }

    msg += `\n📍 Barang telah diterima di dapur.`

    await sendToUser(userId, msg)
    // Admin summary
    let adminMsg = `${emoji} KR selesai — IR <b>${esc(irNumber)}</b> | DO <b>${esc(doNumber)}</b> | KR <b>${esc(krNumber)}</b>\nStatus: <b>${status}</b>`
    if (acceptedItems.length > 0) adminMsg += `\n✅ Diterima: ${acceptedItems.length} item`
    if (rejectedItems.length > 0) adminMsg += `\n❌ Ditolak: ${rejectedItems.length} item`
    await sendToAdmins(adminMsg)
}

/** Notify IR owner that DO was auto-created (legacy alias) */
export async function notifyIROwnerDOCreated(userId: string, irNumber: string, doNumber: string, doId: string, hasShortages: boolean) {
    await notifyIRApproved(userId, irNumber, doNumber, doId, hasShortages)
}

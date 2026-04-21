import { useState } from 'react'
import { Search } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useJournalEntries } from '../../hooks/useApi'

const typeColorMap: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'red'> = {
    purchase_receiving: 'blue',
    distribution: 'green',
    consumption: 'purple',
    adjustment: 'red',
}

const typeLabelMap: Record<string, string> = {
    purchase_receiving: 'Pembelian',
    distribution: 'Distribusi',
    consumption: 'COGS',
    adjustment: 'Penyesuaian',
}

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function JournalPage() {
    const { data: journalRes, isLoading, error } = useJournalEntries()
    const journals = journalRes?.data || []
    const [search, setSearch] = useState('')
    const [type, setType] = useState('Semua')

    if (isLoading) return <div className={styles.page}>Loading journals...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    const filtered = journals.filter((j: any) =>
        (type === 'Semua' || typeLabelMap[j.type] === type) &&
        (j.description.toLowerCase().includes(search.toLowerCase()) || j.journalNumber.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Jurnal Umum</h1>
                    <p className={styles.pageSubtitle}>Auto-generated journal engine dari setiap transaksi operasional</p>
                </div>
            </div>

            <div style={{ background: 'rgba(123,94,167,0.05)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-accent-light)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>🔥</span>
                <div>
                    <strong>Auto Journal Engine:</strong> Semua jurnal dibuat otomatis oleh sistem berdasarkan event (Receiving, Distribution, Consumption, Invoice). Tidak ada input manual.
                </div>
            </div>

            <div className={styles.summaryBar}>
                {['Pembelian', 'Distribusi', 'COGS', 'Penyesuaian'].map(t => (
                    <div key={t} className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>{t}</span>
                        <span className={styles.summaryValue}>{journals.filter((j: any) => typeLabelMap[j.type] === t).length}</span>
                    </div>
                ))}
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total Nilai</span>
                    <span className={styles.summaryValue}>{fmt(journals.reduce((a: number, j: any) => a + j.totalDebit, 0))}</span>
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari jurnal..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={type} onChange={e => setType(e.target.value)}>
                            <option>Semua</option>
                            <option>Pembelian</option>
                            <option>Distribusi</option>
                            <option>COGS</option>
                            <option>Penyesuaian</option>
                        </select>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>No. Jurnal</th><th>Tanggal</th><th>Deskripsi</th><th>Debit</th><th>Kredit</th><th>Jumlah</th><th>Tipe</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map((j: any) => {
                                const debitLine = j.lines?.find((l: any) => l.side === 'debit')
                                const creditLine = j.lines?.find((l: any) => l.side === 'credit')
                                return (
                                    <tr key={j.id}>
                                        <td><span className={styles.mono}>{j.journalNumber}</span></td>
                                        <td className={styles.muted}>{j.createdAt ? new Date(j.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                                        <td style={{ maxWidth: 280 }} className="truncate">{j.description}</td>
                                        <td className={styles.muted} style={{ fontSize: 12 }}>{debitLine?.coa?.name || '-'}</td>
                                        <td className={styles.muted} style={{ fontSize: 12 }}>{creditLine?.coa?.name || '-'}</td>
                                        <td style={{ fontWeight: 600 }}>{fmt(j.totalDebit)}</td>
                                        <td><Badge label={typeLabelMap[j.type] || j.type} color={typeColorMap[j.type] || 'gray'} /></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}>
                    <span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {journals.length} jurnal</span>
                </div>
            </Card>
        </div>
    )
}

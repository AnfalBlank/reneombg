import { useState } from 'react'
import { User, Mail, Shield, Building2, LogOut, Edit2, Key, Eye, EyeOff, Save, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'
import { useSession, signOut } from '../../lib/auth-client'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/utils'
import { getRoleLabel } from '../../lib/roles'
import { useToast } from '../../components/ui/Toast'

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

export default function ProfilePage() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const { data: session } = useSession()
    const { success, error: toastError } = useToast()
    const user = session?.user as any

    // Edit name state
    const [editingName, setEditingName] = useState(false)
    const [nameInput, setNameInput] = useState('')

    // Change password state
    const [changingPw, setChangingPw] = useState(false)
    const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)

    const updateName = useMutation({
        mutationFn: (name: string) => api.patch<any>(`/users/${user?.id}`, { name }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['session'] })
            // Also refresh the session
            window.location.reload()
        },
        onError: (e: any) => toastError(e?.message || 'Gagal memperbarui nama'),
    })

    const handleSaveName = async () => {
        if (!nameInput.trim()) return toastError('Nama tidak boleh kosong!')
        if (nameInput.trim() === user?.name) { setEditingName(false); return }
        await updateName.mutateAsync(nameInput.trim())
        setEditingName(false)
        success('Nama berhasil diperbarui!')
    }

    const handleChangePw = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pwForm.current) return toastError('Password saat ini wajib diisi!')
        if (!pwForm.newPw || pwForm.newPw.length < 6) return toastError('Password baru minimal 6 karakter!')
        if (pwForm.newPw !== pwForm.confirm) return toastError('Konfirmasi password tidak cocok!')

        try {
            // Use better-auth's change password endpoint
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword: pwForm.current,
                    newPassword: pwForm.newPw,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.message || 'Gagal mengganti password')
            success('Password berhasil diubah! Silakan login ulang.')
            setPwForm({ current: '', newPw: '', confirm: '' })
            setChangingPw(false)
            // Force re-login after password change
            setTimeout(async () => {
                await signOut()
                navigate('/login')
            }, 1500)
        } catch (err: any) {
            toastError(err.message || 'Gagal mengganti password')
        }
    }

    const handleLogout = async () => { await signOut(); navigate('/login') }

    if (!user) return <div className={styles.page}>Loading...</div>

    const role = getRoleLabel(user.role)
    const initials = user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Profil Saya</h1>
                    <p className={styles.pageSubtitle}>Informasi akun dan pengaturan profil</p>
                </div>
            </div>

            {/* Profile Card */}
            <Card title="Informasi Akun">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Avatar + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22, fontWeight: 700, color: 'white', flexShrink: 0,
                        }}>
                            {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {editingName ? (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                        style={{ ...inp, maxWidth: 280 }}
                                        value={nameInput}
                                        onChange={e => setNameInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                                        autoFocus
                                    />
                                    <Button size="sm" icon={<Save size={13} />} onClick={handleSaveName} disabled={updateName.isPending}>
                                        {updateName.isPending ? '...' : 'Simpan'}
                                    </Button>
                                    <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={() => setEditingName(false)}>
                                        Batal
                                    </Button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>{user.name}</div>
                                    <button
                                        onClick={() => { setNameInput(user.name); setEditingName(true) }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, borderRadius: 4 }}
                                        title="Edit nama"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            )}
                            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>{user.email}</div>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <Mail size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
                                <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{user.email}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <Shield size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</div>
                                <Badge label={role.label} color={role.color} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <User size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>User ID</div>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{user.id?.slice(0, 16)}...</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <Building2 size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Terdaftar Sejak</div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(user.createdAt)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Change Password */}
            <Card title="Keamanan Akun">
                {!changingPw ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Password</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Ganti password akun Anda secara berkala untuk keamanan</div>
                        </div>
                        <Button variant="secondary" icon={<Key size={14} />} onClick={() => { setChangingPw(true); setPwForm({ current: '', newPw: '', confirm: '' }) }}>
                            Ganti Password
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleChangePw}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={lbl}>Password Saat Ini *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        style={inp}
                                        value={pwForm.current}
                                        onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                                        placeholder="••••••••"
                                        autoFocus
                                    />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={lbl}>Password Baru * (min 6 karakter)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showNew ? 'text' : 'password'}
                                            style={inp}
                                            value={pwForm.newPw}
                                            onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                        <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                            {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label style={lbl}>Konfirmasi Password Baru *</label>
                                    <input
                                        type="password"
                                        style={{ ...inp, borderColor: pwForm.confirm && pwForm.confirm !== pwForm.newPw ? '#ef4444' : undefined }}
                                        value={pwForm.confirm}
                                        onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                                        placeholder="••••••••"
                                    />
                                    {pwForm.confirm && pwForm.confirm !== pwForm.newPw && (
                                        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Password tidak cocok</p>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                                <Button type="button" variant="secondary" onClick={() => setChangingPw(false)}>Batal</Button>
                                <Button type="submit" icon={<Key size={14} />}>
                                    Simpan Password Baru
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </Card>

            {/* Session & Logout */}
            <Card title="Sesi & Logout">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        Anda sedang login sebagai <strong>{user.name}</strong> dengan role <strong>{role.label}</strong>.
                    </div>
                    <div>
                        <Button icon={<LogOut size={14} />} variant="danger" onClick={handleLogout}>
                            Keluar dari Akun
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}

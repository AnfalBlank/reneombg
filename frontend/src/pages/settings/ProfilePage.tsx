import { useState } from 'react'
import { User, Mail, Shield, Building2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'
import { useSession, signOut } from '../../lib/auth-client'
import { fmtDate } from '../../lib/utils'
import { getRoleLabel } from '../../lib/roles'

export default function ProfilePage() {
    const navigate = useNavigate()
    const { data: session } = useSession()
    const user = session?.user as any

    const handleLogout = async () => { await signOut(); navigate('/login') }

    if (!user) return <div className={styles.page}>Loading...</div>

    const role = getRoleLabel(user.role)

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Profil Saya</h1>
                    <p className={styles.pageSubtitle}>Informasi akun dan pengaturan profil</p>
                </div>
            </div>

            <Card title="Informasi Akun">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22, fontWeight: 700, color: 'white',
                        }}>
                            {user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{user.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{user.email}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <User size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nama</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <Mail size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{user.email}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <Shield size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</div>
                                <Badge label={role.label} color={role.color} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Terdaftar Sejak</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(user.createdAt)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Sesi & Keamanan">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        Anda sedang login sebagai <strong>{user.name}</strong> dengan role <strong>{role.label}</strong>.
                    </div>
                    <Button icon={<LogOut size={14} />} variant="danger" onClick={handleLogout}>
                        Keluar dari Akun
                    </Button>
                </div>
            </Card>
        </div>
    )
}

/**
 * IdleWarningModal
 * Muncul 2 menit sebelum auto-logout karena idle.
 * User bisa klik "Tetap Login" untuk reset timer.
 */
import { Clock } from 'lucide-react'
import Button from './Button'

interface Props {
    secondsLeft: number
    onExtend: () => void
    onLogout: () => void
}

export default function IdleWarningModal({ secondsLeft, onExtend, onLogout }: Props) {
    const minutes = Math.floor(secondsLeft / 60)
    const seconds = secondsLeft % 60
    const timeStr = minutes > 0
        ? `${minutes}:${String(seconds).padStart(2, '0')} menit`
        : `${seconds} detik`

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
        }}>
            <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 16,
                padding: '32px 28px',
                maxWidth: 380,
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
                <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                }}>
                    <Clock size={24} style={{ color: '#f59e0b' }} />
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                    Sesi Akan Berakhir
                </h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Tidak ada aktivitas terdeteksi. Anda akan otomatis logout dalam:
                </p>

                <div style={{
                    fontSize: 36, fontWeight: 800,
                    color: secondsLeft <= 30 ? '#ef4444' : '#f59e0b',
                    fontFamily: 'monospace',
                    marginBottom: 24,
                    transition: 'color 0.3s',
                }}>
                    {timeStr}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <Button variant="secondary" onClick={onLogout} style={{ flex: 1 }}>
                        Logout Sekarang
                    </Button>
                    <Button variant="primary" onClick={onExtend} style={{ flex: 1 }}>
                        Tetap Login
                    </Button>
                </div>
            </div>
        </div>
    )
}

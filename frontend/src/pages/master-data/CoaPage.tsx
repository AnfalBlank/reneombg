import { Plus, ChevronRight } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import styles from '../shared.module.css'

import { useCoa } from '../../hooks/useApi'

export default function CoaPage() {
    const { data: coaRes, isLoading, error } = useCoa()
    const coaList = coaRes?.data || []

    const typeColors: Record<string, string> = {
        ASSET: 'var(--color-primary)',
        LIABILITY: 'var(--color-danger)',
        EQUITY: 'var(--color-accent-light)',
        REVENUE: 'var(--color-success)',
        EXPENSE: 'var(--color-warning)',
    }

    const grouped = Object.entries(
        coaList.reduce((acc, current) => {
            if (!acc[current.type]) acc[current.type] = []
            acc[current.type].push(current)
            return acc
        }, {} as Record<string, any[]>)
    ).map(([type, accounts]) => ({ type, accounts, color: typeColors[type] || 'gray' }))

    if (isLoading) return <div className={styles.page}>Loading COA...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Chart of Accounts (COA)</h1><p className={styles.pageSubtitle}>Struktur akun pembukuan operasional</p></div>
                <div className={styles.pageActions}><Button icon={<Plus size={14} />}>Tambah Akun</Button></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {grouped.map(group => (
                    <Card key={group.type} title={group.type} action={<span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{group.accounts.length} akun</span>}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {group.accounts.map((acc: any) => (
                                <div key={acc.code}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 10px',
                                        borderRadius: 'var(--radius-md)',
                                        marginLeft: acc.level === 2 ? 20 : 0,
                                        background: 'var(--color-surface-2)',
                                        transition: 'all var(--transition-fast)',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-3)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                                >
                                    {acc.level === 2 && <ChevronRight size={12} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />}
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: group.color, fontWeight: 600, minWidth: 70 }}>{acc.code}</span>
                                    <span style={{ fontSize: 13 }}>{acc.name}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}

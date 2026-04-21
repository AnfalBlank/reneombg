import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import Button from './Button'

interface PeriodFilterProps {
    onFilterChange: (startDate: string, endDate: string) => void
    defaultStart?: string
    defaultEnd?: string
}

export default function PeriodFilter({ onFilterChange, defaultStart, defaultEnd }: PeriodFilterProps) {
    const today = new Date().toISOString().split('T')[0]
    const defaultStartDt = new Date()
    defaultStartDt.setDate(1) // first day of current month

    const [startDate, setStartDate] = useState(defaultStart || defaultStartDt.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(defaultEnd || today)

    // apply initial filter on mount if not explicitly skipped
    useEffect(() => {
        onFilterChange(startDate, endDate)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleApply = () => {
        onFilterChange(startDate, endDate)
    }

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Dari Tanggal</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                        height: 36, padding: '0 12px', borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)'
                    }}
                />
            </div>
            <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Sampai Tanggal</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                        height: 36, padding: '0 12px', borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)'
                    }}
                />
            </div>
            <Button icon={<Calendar size={14} />} onClick={handleApply}>
                Filter Periode
            </Button>
        </div>
    )
}

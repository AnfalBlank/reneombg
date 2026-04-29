import { useState, useEffect, useRef } from 'react'

interface PeriodFilterProps {
    onFilterChange: (startDate: string, endDate: string) => void
    defaultStart?: string
    defaultEnd?: string
}

export default function PeriodFilter({ onFilterChange, defaultStart, defaultEnd }: PeriodFilterProps) {
    const today = new Date().toISOString().split('T')[0]
    const defaultStartDt = new Date()
    defaultStartDt.setDate(1)

    const [startDate, setStartDate] = useState(defaultStart || defaultStartDt.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(defaultEnd || today)
    const mounted = useRef(false)

    useEffect(() => {
        onFilterChange(startDate, endDate)
        mounted.current = true
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (mounted.current) onFilterChange(startDate, endDate)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate])

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateInput} />
            <span style={{ color: 'var(--color-text-dim)', fontSize: 12, flexShrink: 0 }}>—</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={dateInput} />
        </div>
    )
}

const dateInput: React.CSSProperties = {
    height: 36,
    padding: '0 10px',
    borderRadius: 'var(--radius-md, 10px)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 13,
    outline: 'none',
    minWidth: 0,
    width: 140,
}

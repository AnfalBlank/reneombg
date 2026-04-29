import { useState, useEffect, useRef } from 'react'

interface CurrencyInputProps {
    value: number
    onChange: (val: number) => void
    placeholder?: string
    style?: React.CSSProperties
    disabled?: boolean
    min?: number
}

/** Format number with Indonesian thousand separator (dots) */
function formatNumber(n: number): string {
    if (!n && n !== 0) return ''
    if (n === 0) return ''
    return n.toLocaleString('id-ID')
}

/** Parse formatted string back to number */
function parseFormatted(s: string): number {
    // Remove all dots (thousand sep) and replace comma with dot (decimal)
    const cleaned = s.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
}

export default function CurrencyInput({ value, onChange, placeholder = '0', style, disabled, min }: CurrencyInputProps) {
    const [display, setDisplay] = useState(value ? formatNumber(value) : '')
    const [focused, setFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync external value changes (only when not focused to avoid cursor jump)
    useEffect(() => {
        if (!focused) {
            setDisplay(value ? formatNumber(value) : '')
        }
    }, [value, focused])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value
        // Allow only digits, dots, and commas
        const filtered = raw.replace(/[^0-9.,]/g, '')
        // Parse the numeric value
        const num = parseFormatted(filtered)
        if (min !== undefined && num < min) {
            // Don't block typing, just let it through
        }
        // Format for display (only the integer part gets separators)
        const parts = filtered.replace(/\./g, '').split(',')
        const intPart = parts[0].replace(/^0+(?=\d)/, '') // remove leading zeros
        const intNum = parseInt(intPart.replace(/\D/g, '')) || 0
        const formatted = intNum ? intNum.toLocaleString('id-ID') : intPart
        const decPart = parts.length > 1 ? ',' + parts[1] : ''
        setDisplay(formatted + decPart)
        onChange(num)
    }

    const handleFocus = () => {
        setFocused(true)
    }

    const handleBlur = () => {
        setFocused(false)
        // Clean up display on blur
        setDisplay(value ? formatNumber(value) : '')
    }

    return (
        <div style={{ position: 'relative', ...style }}>
            <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, pointerEvents: 'none',
            }}>Rp</span>
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={display}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                style={{
                    width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    color: 'var(--color-text)', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box' as const, fontVariantNumeric: 'tabular-nums',
                }}
            />
        </div>
    )
}

interface BadgeProps {
    label: string
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
}

const colorMap: Record<string, string> = {
    blue: 'rgba(79,124,255,0.15)',
    green: 'rgba(34,197,94,0.15)',
    yellow: 'rgba(245,158,11,0.15)',
    red: 'rgba(239,68,68,0.15)',
    purple: 'rgba(123,94,167,0.15)',
    gray: 'rgba(255,255,255,0.06)',
}

const textMap: Record<string, string> = {
    blue: 'var(--color-primary)',
    green: 'var(--color-success)',
    yellow: 'var(--color-warning)',
    red: 'var(--color-danger)',
    purple: 'var(--color-accent-light)',
    gray: 'var(--color-text-muted)',
}

export default function Badge({ label, color = 'blue' }: BadgeProps) {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 10px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: 600,
                background: colorMap[color],
                color: textMap[color],
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
            }}
        >
            {label}
        </span>
    )
}

/** Format date with time: "28 Apr 2026, 14:30:45" */
export function fmtDate(d: string | Date | null | undefined): string {
    if (!d) return '-'
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return '-'
    return dt.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
    }) + ', ' + dt.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
}

/** Format date only: "28 Apr 2026" */
export function fmtDateOnly(d: string | Date | null | undefined): string {
    if (!d) return '-'
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return '-'
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format currency: "Rp 1.500.000" */
export function fmtRp(n: number): string {
    return 'Rp ' + (n || 0).toLocaleString('id-ID')
}

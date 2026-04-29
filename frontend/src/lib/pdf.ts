/**
 * PDF generation using browser print API.
 * Creates a new window with the HTML content and triggers print/save as PDF.
 */
export function downloadPDF(htmlContent: string, title: string) {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
        alert('Popup diblokir. Izinkan popup untuk download PDF.')
        return
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #000; background: #fff; padding: 40px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin: 20px 0 10px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { padding: 8px 10px; text-align: left; border: 1px solid #ddd; font-size: 12px; }
        th { background: #f5f5f5; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        .mono { font-family: 'Courier New', monospace; }
        .right { text-align: right; }
        .bold { font-weight: 700; }
        .muted { color: #666; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; }
        .info-grid div { padding: 4px 0; }
        .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 60px; text-align: center; }
        .signatures div { padding-top: 60px; border-top: 1px solid #000; font-size: 11px; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
        .total-row { background: #f5f5f5; font-weight: 700; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
    ${htmlContent}
    <div class="footer">Dokumen ini dicetak otomatis oleh sistem ERP MBG — ${new Date().toLocaleString('id-ID')}</div>
</body>
</html>
    `)
    printWindow.document.close()

    // Wait for content to render then trigger print
    setTimeout(() => {
        printWindow.print()
    }, 300)
}

/** Format currency for PDF */
export function pdfFmt(n: number): string {
    return 'Rp ' + (n || 0).toLocaleString('id-ID')
}

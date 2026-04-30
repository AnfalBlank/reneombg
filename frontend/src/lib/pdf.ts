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
        @page {
            size: A4;
            margin: 15mm 12mm 20mm 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
            font-size: 12px;
            color: #111;
            background: #fff;
            padding: 24px 32px;
            line-height: 1.5;
        }

        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #111;
            padding-bottom: 14px;
            margin-bottom: 20px;
        }
        .header h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
        .header .muted { font-size: 11px; color: #666; margin-top: 2px; }

        /* Info Grid */
        .info-grid {
            display: table;
            width: 100%;
            margin-bottom: 18px;
            font-size: 12px;
        }
        .info-grid div {
            display: inline-block;
            width: 49%;
            padding: 3px 0;
            vertical-align: top;
        }
        .info-grid strong { font-weight: 700; }

        /* Table */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 11px;
            page-break-inside: auto;
        }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        th {
            background: #1a1a2e;
            color: #fff;
            padding: 8px 10px;
            text-align: left;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            border: 1px solid #1a1a2e;
            white-space: nowrap;
        }
        td {
            padding: 7px 10px;
            text-align: left;
            border: 1px solid #d0d0d0;
            font-size: 11px;
            vertical-align: middle;
        }
        tr:nth-child(even) td { background: #f8f9fa; }

        /* Utility */
        .mono { font-family: 'Courier New', monospace; font-size: 11px; }
        .right { text-align: right; }
        .bold { font-weight: 700; }
        .muted { color: #666; }
        .total-row td {
            background: #f0f0f0 !important;
            font-weight: 800;
            font-size: 12px;
            border-top: 2px solid #333;
        }

        /* Signatures */
        .signatures {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-top: 50px;
            page-break-inside: avoid;
        }
        .signatures div {
            flex: 1;
            text-align: center;
            font-size: 11px;
            font-weight: 600;
            color: #333;
        }
        .signatures div::before {
            content: '';
            display: block;
            height: 60px;
        }
        .signatures div::after {
            content: '';
            display: block;
            width: 80%;
            margin: 0 auto;
            border-bottom: 1px solid #333;
            margin-bottom: 6px;
            margin-top: 0;
        }

        /* Footer */
        .footer {
            margin-top: 28px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            font-size: 9px;
            color: #999;
            text-align: center;
            page-break-inside: avoid;
        }

        /* Status badges in PDF */
        .status-paid { color: #16a34a; font-weight: 700; }
        .status-pending { color: #d97706; font-weight: 700; }
        .status-unpaid { color: #dc2626; font-weight: 700; }

        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    ${htmlContent}
    <div class="footer">
        Dicetak oleh sistem ERP MBG — ${new Date().toLocaleString('id-ID')}<br>
        <span style="font-size:8px;">PT. Manggala Utama Indonesia — Solusi Sistem Terintegrasi</span>
    </div>
</body>
</html>
    `)
    printWindow.document.close()

    // Wait for content to render then trigger print
    setTimeout(() => {
        printWindow.print()
    }, 400)
}

/** Format currency for PDF */
export function pdfFmt(n: number): string {
    return 'Rp ' + (n || 0).toLocaleString('id-ID')
}

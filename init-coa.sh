#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  ERP MBG — Inisialisasi Chart of Accounts (COA)
#  Jalankan di VPS dari folder root project: /home/deploy/reneombg
#
#  Usage:
#    bash init-coa.sh           # Tambah COA yang belum ada (aman, tidak hapus)
#    bash init-coa.sh --force   # Reset semua COA & buat ulang (HAPUS journal!)
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
SEED_SCRIPT="$BACKEND_DIR/seed-coa.mjs"

echo "═══════════════════════════════════════════"
echo "  📊 ERP MBG — Init COA"
echo "═══════════════════════════════════════════"
echo ""

# ── Validasi ──────────────────────────────────────────────────────────────────
if [ ! -f "$SEED_SCRIPT" ]; then
    echo "❌ File seed-coa.mjs tidak ditemukan di: $SEED_SCRIPT"
    exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "❌ File .env tidak ditemukan di: $BACKEND_DIR/.env"
    echo "   Pastikan TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN sudah diset."
    exit 1
fi

# Cek TURSO_DATABASE_URL tersedia
source "$BACKEND_DIR/.env" 2>/dev/null || true
if [ -z "$TURSO_DATABASE_URL" ]; then
    echo "❌ TURSO_DATABASE_URL belum diset di .env"
    exit 1
fi

# ── Konfirmasi --force ────────────────────────────────────────────────────────
if [[ "$1" == "--force" ]]; then
    echo "⚠️  MODE --force: Semua COA dan journal entries akan DIHAPUS dan dibuat ulang!"
    echo ""
    read -p "   Ketik 'YA' untuk konfirmasi: " confirm
    if [ "$confirm" != "YA" ]; then
        echo "❌ Dibatalkan."
        exit 0
    fi
    echo ""
fi

# ── Jalankan seed ─────────────────────────────────────────────────────────────
echo "📂 Working dir : $BACKEND_DIR"
echo "🗄️  Database    : $TURSO_DATABASE_URL"
echo ""

cd "$BACKEND_DIR"
node seed-coa.mjs $1

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Inisialisasi COA selesai!"
echo ""
echo "  Langkah selanjutnya:"
echo "  1. Buka aplikasi → Pembukuan → Tutup Buku"
echo "  2. Klik 'Buat Periode' untuk bulan berjalan"
echo "  3. Sistem siap mencatat jurnal otomatis"
echo "═══════════════════════════════════════════"

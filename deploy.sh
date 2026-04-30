#!/bin/bash
# 🚀 ERP MBG Deploy Script
# Jalankan di VPS dalam folder project: /home/deploy/reneombg

set -e
echo "═══════════════════════════════════════════"
echo "  🚀 ERP MBG — Deploy to Production"
echo "═══════════════════════════════════════════"

# 1. Pull latest
echo ""
echo "📥 Pulling latest from GitHub..."
git pull origin main

# 2. Backend
echo ""
echo "🏗️  Building backend..."
cd backend
npm install --legacy-peer-deps
npx tsc
echo "✅ Backend built"

# 3. Frontend
echo ""
echo "🏗️  Building frontend..."
cd ../frontend
npm install --legacy-peer-deps
npm run build
echo "✅ Frontend built"

# 4. Restart PM2
echo ""
echo "🔄 Restarting PM2..."
cd ..
pm2 restart erp-backend 2>/dev/null || pm2 start backend/dist/index.js --name "erp-backend" --env production
pm2 save

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deploy selesai!"
echo "  🌐 https://rmb.manggalautama.web.id"
echo "═══════════════════════════════════════════"

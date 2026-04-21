#!/bin/bash
# 🚀 ERP MBG Auto-Deployment Script
# Run this on your VPS inside the /home/indotech/SystemSaas directory

echo "📥 pulling latest changes from git..."
git pull origin main

# 1. Backend Setup
echo "🏗️ setting up backend..."
cd backend
npm install
npm run build 

# 2. Frontend Setup
echo "🏗️ setting up frontend..."
cd ../frontend
npm install
# VITE_API_URL helps frontend know where to call the backend in production
VITE_API_URL=https://reneo.manggalautama.web.id/api npm run build

# 3. Restart Processes (assuming PM2 is used)
echo "🔄 restarting PM2 processes..."
cd ..
pm2 restart all || pm2 start backend/dist/index.js --name "erp-backend"

echo "✅ Deployment Successful!"
echo "🌐 Site: https://reneo.manggalautama.web.id"

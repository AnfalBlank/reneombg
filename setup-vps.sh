#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# 🖥️  ERP MBG — VPS Initial Setup (Ubuntu 22.04/24.04)
# Jalankan sebagai root: sudo bash setup-vps.sh
# ═══════════════════════════════════════════════════════════════

set -e
DOMAIN="rmb.manggalautama.web.id"
APP_DIR="/home/deploy/reneombg"

echo "═══════════════════════════════════════════"
echo "  🖥️  Setup VPS untuk ERP MBG"
echo "  Domain: $DOMAIN"
echo "═══════════════════════════════════════════"

# ─── 1. System Update ─────────────────────────────────────────
echo ""
echo "📦 Updating system..."
apt update && apt upgrade -y

# ─── 2. Install Node.js 20 ────────────────────────────────────
echo ""
echo "📦 Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# ─── 3. Install PM2 ───────────────────────────────────────────
echo ""
echo "📦 Installing PM2..."
npm install -g pm2

# ─── 4. Install Nginx ─────────────────────────────────────────
echo ""
echo "📦 Installing Nginx..."
apt install -y nginx

# ─── 5. Install Certbot (SSL) ─────────────────────────────────
echo ""
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# ─── 6. Create deploy user ────────────────────────────────────
echo ""
echo "👤 Setting up deploy user..."
id -u deploy &>/dev/null || useradd -m -s /bin/bash deploy
mkdir -p $APP_DIR
chown -R deploy:deploy /home/deploy

# ─── 7. Clone repo ────────────────────────────────────────────
echo ""
echo "📥 Cloning repository..."
if [ ! -d "$APP_DIR/.git" ]; then
    sudo -u deploy git clone https://github.com/AnfalBlank/reneombg.git $APP_DIR
else
    echo "Repo already exists, pulling latest..."
    cd $APP_DIR && sudo -u deploy git pull origin main
fi

# ─── 8. Nginx Config ──────────────────────────────────────────
echo ""
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/erp-mbg << 'NGINX'
server {
    listen 80;
    server_name rmb.manggalautama.web.id;

    # Proxy API & Auth to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 20M;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    # Frontend static files (served by backend)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/erp-mbg /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ─── 9. Firewall ──────────────────────────────────────────────
echo ""
echo "🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ─── 10. PM2 startup ──────────────────────────────────────────
echo ""
echo "⚙️  Configuring PM2 startup..."
pm2 startup systemd -u deploy --hp /home/deploy
env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ VPS Setup selesai!"
echo ""
echo "  LANGKAH SELANJUTNYA:"
echo ""
echo "  1. Arahkan DNS domain ke IP VPS:"
echo "     rmb.manggalautama.web.id → A record → 20.196.202.37"
echo ""
echo "  2. Buat file .env di backend:"
echo "     sudo -u deploy nano $APP_DIR/backend/.env"
echo "     (isi TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, dll)"
echo ""
echo "  3. Build & deploy:"
echo "     cd $APP_DIR && sudo -u deploy bash deploy.sh"
echo ""
echo "  4. Setup SSL (setelah DNS aktif):"
echo "     certbot --nginx -d rmb.manggalautama.web.id"
echo ""
echo "═══════════════════════════════════════════════════════════"

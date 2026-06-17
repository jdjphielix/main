#!/bin/bash
# ============================================================
# TaperPay Backoffice — VPS Setup Script
# Server: 178.105.76.158
# ============================================================
set -e

echo "▶ TaperPay Server Setup gestart..."

# ── 1. Systeem update ────────────────────────────────────────
echo "📦 Systeem updaten..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Docker installeren ────────────────────────────────────
echo "🐳 Docker installeren..."
if ! command -v docker &> /dev/null; then
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker geïnstalleerd: $(docker --version)"
else
    echo "✅ Docker al aanwezig: $(docker --version)"
fi

# ── 3. Nginx installeren ─────────────────────────────────────
echo "🌐 Nginx installeren..."
apt-get install -y -qq nginx
systemctl enable nginx

# ── 4. Firewall instellen ────────────────────────────────────
echo "🔒 Firewall instellen..."
apt-get install -y -qq ufw
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS (voor later)
ufw --force enable
echo "✅ Firewall actief"

# ── 5. Project directory aanmaken ───────────────────────────
echo "📁 Project directory aanmaken..."
mkdir -p /opt/taperpay
mkdir -p /opt/taperpay/uploads
mkdir -p /opt/taperpay/avatars

echo ""
echo "✅ Server setup compleet!"
echo "Volgende stap: project bestanden uploaden met:"
echo "  scp -r 'The Main Frame/' root@178.105.76.158:/opt/taperpay/app"
echo ""

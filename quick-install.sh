#!/bin/bash

echo "🚀 Web Hosting Panel - TEK SATIR KURULUM"
echo "========================================="
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    echo "❌ Bu script root olarak çalıştırılmalıdır!"
    echo "   Kullanım: curl -fsSL https://raw.githubusercontent.com/fatihgungor133/web-panel/main/quick-install.sh | sudo bash"
    exit 1
fi

echo "📦 Sistem güncelleniyor..."
apt update -qq > /dev/null 2>&1

echo "📥 Node.js kuruluyor..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
apt install -y nodejs git > /dev/null 2>&1

echo "📂 Panel indiriliyor..."
cd /opt
rm -rf web-panel
git clone -q https://github.com/fatihgungor133/web-panel.git
cd web-panel

echo "⚙️ Bağımlılıklar yükleniyor..."
npm install --silent > /dev/null 2>&1

echo "📁 Klasörler oluşturuluyor..."
mkdir -p logs backups user_files/admin data

echo "🔧 Servis oluşturuluyor..."
cat > /etc/systemd/system/hosting-panel.service << 'EOF'
[Unit]
Description=Web Hosting Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/web-panel
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

echo "🚀 Servis başlatılıyor..."
systemctl daemon-reload
systemctl enable hosting-panel > /dev/null 2>&1
systemctl start hosting-panel

echo "🔥 Firewall ayarlanıyor..."
ufw --force enable > /dev/null 2>&1
ufw allow 3000 > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1

# IP tespiti
SERVER_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "N/A")

echo ""
echo "🎉 KURULUM TAMAMLANDI!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 PANEL ERİŞİM ADRESLERİ:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Yerel Ağ: http://${SERVER_IP}:3000"
if [ "$EXTERNAL_IP" != "N/A" ]; then
    echo "🌍 İnternet: http://${EXTERNAL_IP}:3000"
fi
echo "🔗 Giriş: http://${SERVER_IP}:3000/login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 GİRİŞ BİLGİLERİ:"
echo "   👤 Kullanıcı: admin"
echo "   🔑 Şifre: admin123"
echo ""
echo "🎯 Panel şu anda çalışıyor ve hazır!"
echo ""
echo "📚 YARDIMCI KOMUTLAR:"
echo "   🔧 Panel durumu: systemctl status hosting-panel"
echo "   📝 Panel logları: journalctl -u hosting-panel -f"
echo "   🔄 Panel yeniden başlat: systemctl restart hosting-panel"
echo "   ⏹️  Panel durdur: systemctl stop hosting-panel"
echo "   🗑️  Panel kaldır: rm -rf /opt/web-panel && systemctl disable hosting-panel"
echo "" 
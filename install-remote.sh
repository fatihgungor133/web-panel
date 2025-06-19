#!/bin/bash

echo "🌐 Web Hosting Panel - UZAKTAN KURULUM"
echo "======================================"
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    echo "❌ Bu script root olarak çalıştırılmalıdır!"
    echo "   sudo bash install-remote.sh"
    exit 1
fi

# Git yükle
echo "📦 Git kontrol ediliyor..."
if ! command -v git &> /dev/null; then
    echo "📦 Git yükleniyor..."
    apt update
    apt install -y git curl wget
fi

# Panel dosyalarını GitHub'dan indir
echo "📥 Panel dosyaları GitHub'dan indiriliyor..."
cd /tmp
rm -rf web-hosting-panel

# GitHub repo'yu clone et
git clone https://github.com/YOUR_USERNAME/web-hosting-panel.git
cd web-hosting-panel

echo "✅ Panel dosyaları indirildi"
echo ""

# Ubuntu setup'ı çalıştır
echo "🚀 Kurulum başlatılıyor..."
chmod +x ubuntu-setup.sh
bash ubuntu-setup.sh

echo ""
echo "🎉 UZAKTAN KURULUM TAMAMLANDI!"
echo ""

# IP tespiti
SERVER_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "N/A")

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
echo "🔐 Giriş Bilgileri:"
echo "   👤 Kullanıcı: admin"
echo "   🔑 Şifre: admin123"
echo ""
echo "📚 Yönetim Komutları:"
echo "   🔧 Panel durumu: systemctl status hosting-panel"
echo "   📝 Panel logları: journalctl -u hosting-panel -f"
echo "   🔄 Panel yeniden başlat: systemctl restart hosting-panel"
echo "   📡 IP kontrol: bash /opt/hosting-panel/get-ip.sh"
echo ""
echo "⚠️  Güvenlik önerileri:"
echo "   1. MySQL root şifresini değiştirin"
echo "   2. Admin panel şifresini değiştirin"
echo "   3. UFW firewall ayarlarını kontrol edin" 
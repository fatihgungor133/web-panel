#!/bin/bash

echo "🚀 Web Hosting Panel - TEK KOMUT KURULUM"
echo "========================================"
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    echo "❌ Bu script root olarak çalıştırılmalıdır!"
    echo "   sudo bash quick-install.sh"
    exit 1
fi

# Dosya kontrolü
if [ ! -f "server.js" ]; then
    echo "❌ Panel dosyaları bulunamadı!"
    echo "   Panel dizininde çalıştırın"
    exit 1
fi

echo "🚀 Ubuntu + Panel kurulumu yapılıyor..."
bash ubuntu-setup.sh

echo ""
echo "🎉 KURULUM TAMAMLANDI!"
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
echo "🎯 Panel şu anda çalışıyor ve hazır!"
echo ""
echo "📚 Yardımcı Komutlar:"
echo "   🔧 Panel durumu: systemctl status hosting-panel"
echo "   📝 Panel logları: journalctl -u hosting-panel -f"
echo "   🔄 Panel yeniden başlat: systemctl restart hosting-panel"
echo "   📡 IP kontrol: bash get-ip.sh" 
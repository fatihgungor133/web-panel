#!/bin/bash

echo "🌐 SUNUCU IP ADRESLERİ"
echo "===================="
echo ""

# Yerel IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "📍 Yerel IP: $LOCAL_IP"

# Dış IP (birkaç farklı servis dene)
echo "🌍 Dış IP kontrol ediliyor..."

EXTERNAL_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null)
if [ -z "$EXTERNAL_IP" ]; then
    EXTERNAL_IP=$(curl -s --max-time 3 ipinfo.io/ip 2>/dev/null)
fi
if [ -z "$EXTERNAL_IP" ]; then
    EXTERNAL_IP=$(curl -s --max-time 3 icanhazip.com 2>/dev/null)
fi

if [ -n "$EXTERNAL_IP" ]; then
    echo "🌍 Dış IP: $EXTERNAL_IP"
else
    echo "❌ Dış IP tespit edilemedi (İnternet bağlantısı yok)"
fi

echo ""
echo "🔗 PANEL ERİŞİM LİNKLERİ:"
echo "========================"
echo "📍 Yerel Ağ: http://$LOCAL_IP:3000"
if [ -n "$EXTERNAL_IP" ]; then
    echo "🌍 İnternet: http://$EXTERNAL_IP:3000"
fi
echo "🔑 Giriş: http://$LOCAL_IP:3000/login"

echo ""
echo "📋 Faydalı Komutlar:"
echo "==================="
echo "🔧 Panel durumu: systemctl status hosting-panel"
echo "📝 Panel logları: journalctl -u hosting-panel -f"
echo "🔄 Panel yeniden başlat: systemctl restart hosting-panel"
echo "🔒 Firewall durumu: ufw status"
echo "📡 Ağ dinleme: netstat -tlnp | grep :3000" 
#!/bin/bash

echo "🔒 HTTPS SSL Servisi Kurulumu"
echo "============================="

# SSL sertifikası oluştur
echo "📜 SSL sertifikası oluşturuluyor..."
bash ssl-setup.sh

# HTTPS servis dosyası oluştur
cat > /etc/systemd/system/hosting-panel-ssl.service << 'EOF'
[Unit]
Description=Web Hosting Panel HTTPS
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/web-panel
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=HTTPS_PORT=443

[Install]
WantedBy=multi-user.target
EOF

# Eski HTTP servisini durdur ve devre dışı bırak
echo "⏹️  HTTP servisini durduruyor..."
systemctl stop hosting-panel 2>/dev/null || true
systemctl disable hosting-panel 2>/dev/null || true

# HTTPS servisini başlat
echo "🚀 HTTPS servisini başlatıyor..."
systemctl daemon-reload
systemctl enable hosting-panel-ssl
systemctl start hosting-panel-ssl

# Firewall ayarları
echo "🔥 Firewall HTTPS için ayarlanıyor..."
ufw allow 443 > /dev/null 2>&1
ufw delete allow 3000 > /dev/null 2>&1

# Durum kontrolü
echo ""
echo "🎉 HTTPS SSL KURULUMU TAMAMLANDI!"
echo ""

# IP tespiti
SERVER_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "N/A")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 HTTPS PANEL ERİŞİM ADRESLERİ:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Yerel Ağ: https://${SERVER_IP}"
if [ "$EXTERNAL_IP" != "N/A" ]; then
    echo "🌍 İnternet: https://${EXTERNAL_IP}"
fi
echo "🔗 Giriş: https://${SERVER_IP}/login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 GİRİŞ BİLGİLERİ:"
echo "   👤 Kullanıcı: admin"
echo "   🔑 Şifre: admin123"
echo ""
echo "⚠️  TARAYICI UYARISI:"
echo "   🛡️  Self-signed sertifika kullanıldığı için"
echo "   🔓 tarayıcınız güvenlik uyarısı verecek"
echo "   ✅ 'Gelişmiş' > 'Güvensiz devam et' seçin"
echo ""
echo "📚 YARDIMCI KOMUTLAR:"
echo "   🔧 Panel durumu: systemctl status hosting-panel-ssl"
echo "   📝 Panel logları: journalctl -u hosting-panel-ssl -f"
echo "   🔄 Panel yeniden başlat: systemctl restart hosting-panel-ssl"
echo "   ⏹️  Panel durdur: systemctl stop hosting-panel-ssl"
echo "" 
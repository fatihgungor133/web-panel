#!/bin/bash

echo "🔒 Self-Signed SSL Sertifikası Oluşturuluyor..."
echo "=============================================="

# SSL klasörü oluştur
mkdir -p /opt/web-panel/ssl

# Private key oluştur
openssl genrsa -out /opt/web-panel/ssl/private.key 2048

# Certificate signing request oluştur
openssl req -new -key /opt/web-panel/ssl/private.key -out /opt/web-panel/ssl/cert.csr -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Web Panel/OU=IT/CN=91.99.166.231"

# Self-signed sertifika oluştur (10 yıl geçerli)
openssl x509 -req -days 3650 -in /opt/web-panel/ssl/cert.csr -signkey /opt/web-panel/ssl/private.key -out /opt/web-panel/ssl/certificate.crt

# Dosya izinlerini ayarla
chmod 600 /opt/web-panel/ssl/private.key
chmod 644 /opt/web-panel/ssl/certificate.crt

echo "✅ SSL sertifikası oluşturuldu!"
echo "📁 Dosyalar: /opt/web-panel/ssl/"
echo "🔑 Private Key: private.key"
echo "📜 Certificate: certificate.crt"
echo ""
echo "🚀 HTTPS sunucusunu başlatmak için:"
echo "   systemctl stop hosting-panel"
echo "   systemctl start hosting-panel-ssl"
echo "" 
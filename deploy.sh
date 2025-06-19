#!/bin/bash

echo "🚀 Web Hosting Paneli Deployment Başlıyor..."

# Gerekli kontroller
if [ "$EUID" -ne 0 ]; then
    echo "❌ Bu script root olarak çalıştırılmalıdır!"
    exit 1
fi

if [ ! -f "server.js" ]; then
    echo "❌ server.js dosyası bulunamadı!"
    exit 1
fi

# Kontrol: ubuntu-setup.sh çalıştırıldı mı?
if [ ! -d "/opt/hosting-panel" ]; then
    echo "❌ Panel kurulu değil! Önce ubuntu-setup.sh çalıştırın:"
    echo "   sudo bash ubuntu-setup.sh"
    exit 1
fi

echo "📁 Panel güncelleniyor..."
# Mevcut panel'i backup'la
cp -r /opt/hosting-panel /opt/hosting-panel-backup-$(date +%Y%m%d-%H%M%S)

# Yeni dosyaları kopyala
cp -r . /opt/hosting-panel/
cd /opt/hosting-panel

# Node.js bağımlılıklarını güncelle
echo "📦 Node.js bağımlılıkları güncelleniyor..."
npm install

# Çevre değişkenlerini ayarla
cat > .env << EOF
NODE_ENV=production
PORT=3000
MYSQL_ROOT_PASSWORD=your_mysql_root_password
MYSQL_HOST=localhost
MYSQL_USER=panel_user
MYSQL_PASSWORD=panel_password_$(openssl rand -hex 8)
MYSQL_DATABASE=hosting_panel
SESSION_SECRET=$(openssl rand -hex 32)
EOF

# Dizin izinlerini ayarla
chown -R www-data:www-data /opt/hosting-panel
chmod -R 755 /opt/hosting-panel

# Servisi yeniden başlat
echo "🔄 Panel servisi yeniden başlatılıyor..."
systemctl daemon-reload
systemctl restart hosting-panel

# Nginx reverse proxy (opsiyonel)
echo "🔧 Nginx reverse proxy kuruluyor..."
apt install -y nginx

cat > /etc/nginx/sites-available/hosting-panel << EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Nginx'i etkinleştir
ln -sf /etc/nginx/sites-available/hosting-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Cron job'ları ekle
echo "⏰ Otomatik görevler ekleniyor..."
crontab -l > /tmp/crontab_backup 2>/dev/null || true
cat >> /tmp/crontab_backup << EOF
# Hosting Panel Otomatik Görevler
0 2 * * * /opt/hosting-panel/scripts/daily-backup.sh
0 3 * * 0 /opt/hosting-panel/scripts/weekly-cleanup.sh
*/5 * * * * /opt/hosting-panel/scripts/ssl-renewal.sh
EOF
crontab /tmp/crontab_backup

# Otomatik görev scriptleri oluştur
mkdir -p /opt/hosting-panel/scripts

cat > /opt/hosting-panel/scripts/daily-backup.sh << 'EOF'
#!/bin/bash
# Günlük yedekleme scripti
cd /opt/hosting-panel
/usr/bin/node -e "
const hostingManager = require('./hosting-manager');
const db = require('./db');

async function dailyBackup() {
    try {
        const users = ['admin']; // Tüm kullanıcıları al
        for (const user of users) {
            await hostingManager.createBackup(user, 'full');
        }
        console.log('Günlük yedekleme tamamlandı');
    } catch (error) {
        console.error('Yedekleme hatası:', error);
    }
}

dailyBackup();
"
EOF

cat > /opt/hosting-panel/scripts/weekly-cleanup.sh << 'EOF'
#!/bin/bash
# Haftalık temizlik scripti
# Eski log dosyalarını temizle
find /var/log/apache2 -name "*.log" -mtime +30 -delete
find /opt/hosting-panel/logs -name "*.log" -mtime +30 -delete
# Eski yedekleri temizle (60 günden eski)
find /backups -name "*.tar.gz" -mtime +60 -delete
echo "Haftalık temizlik tamamlandı"
EOF

cat > /opt/hosting-panel/scripts/ssl-renewal.sh << 'EOF'
#!/bin/bash
# SSL sertifikası yenileme scripti
certbot renew --quiet --no-self-upgrade
systemctl reload apache2
EOF

# Script izinlerini ayarla
chmod +x /opt/hosting-panel/scripts/*.sh

# Firewall kurallarını kontrol et
echo "🔒 Firewall kuralları kontrol ediliyor..."
ufw status | grep -q "Status: active" && echo "✅ UFW aktif" || ufw --force enable

# Panel durumunu kontrol et
echo "🔍 Panel durumu kontrol ediliyor..."
sleep 5
if systemctl is-active --quiet hosting-panel; then
    echo "✅ Hosting Panel servisi çalışıyor"
else
    echo "❌ Hosting Panel servisi çalışmıyor"
    systemctl status hosting-panel
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx reverse proxy çalışıyor"
else
    echo "❌ Nginx çalışmıyor"
fi

# Bağlantı testi
echo "🌐 Bağlantı testi yapılıyor..."
curl -s http://localhost:3000 > /dev/null && echo "✅ Panel localhost:3000'de erişilebilir" || echo "❌ Panel erişilemez"

echo ""
echo "🎉 Panel Güncelleme Tamamlandı!"
echo ""

# IP adreslerini otomatik tespit et
SERVER_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "N/A")

echo "📋 Kurulum özeti:"
echo "   - 📁 Panel dizini: /opt/hosting-panel"
echo "   - 📝 Log dizini: /var/log/hosting-panel"
echo "   - 💾 Yedek dizini: /backups"
echo ""
echo "🌐 PANEL ERİŞİM ADRESLERİ:"
echo "   📍 Yerel Ağ: http://${SERVER_IP}:3000"
if [ "$EXTERNAL_IP" != "N/A" ]; then
    echo "   🌍 İnternet: http://${EXTERNAL_IP}:3000"
fi
echo "   🔄 Nginx Proxy: http://${SERVER_IP}"
echo "   🔗 Direkt Giriş: http://${SERVER_IP}:3000/login"
echo ""
echo "🔐 Varsayılan giriş bilgileri:"
echo "   - Kullanıcı: admin"
echo "   - Şifre: admin123"
echo ""
echo "⚠️  Güvenlik için:"
echo "   1. Admin şifresini hemen değiştirin"
echo "   2. MySQL root şifresini güçlendirin"
echo "   3. Firewall kurallarını gözden geçirin"
echo "   4. SSL sertifikalarını düzenli olarak yenileyin"
echo ""
echo "🎯 Hizmet yönetimi:"
echo "   - Panel başlat: systemctl start hosting-panel"
echo "   - Panel durdur: systemctl stop hosting-panel"
echo "   - Panel yeniden başlat: systemctl restart hosting-panel"
echo "   - Panel durumu: systemctl status hosting-panel"
echo ""
echo "📝 Log dosyaları:"
echo "   - Panel logları: journalctl -u hosting-panel -f"
echo "   - Apache logları: tail -f /var/log/apache2/error.log"
echo "   - Nginx logları: tail -f /var/log/nginx/error.log" 
#!/bin/bash

echo "🚀 Web Hosting Paneli Ubuntu Kurulumu Başlıyor..."

# Git kontrol et
if ! command -v git &> /dev/null; then
    echo "📦 Git yükleniyor..."
    apt update
    apt install -y git
fi

# Panel dosyalarını indir (eğer mevcut dizinde yoksa)
if [ ! -f "server.js" ]; then
    echo "📥 Panel dosyaları GitHub'dan indiriliyor..."
    git clone https://github.com/YOUR_USERNAME/web-hosting-panel.git /tmp/hosting-panel-source
    cd /tmp/hosting-panel-source
    echo "✅ Panel dosyaları indirildi"
else
    echo "✅ Panel dosyaları mevcut dizinde bulundu"
fi

# Sistem güncellemesi
echo "📦 Sistem güncelleniyor..."
apt update && apt upgrade -y

# Gerekli paketleri yükle
echo "📦 Gerekli paketler yükleniyor..."
apt install -y apache2 mysql-server php8.1 php8.1-fpm php8.1-mysql php8.1-cli php8.1-curl php8.1-gd php8.1-mbstring php8.1-xml php8.1-zip nodejs npm certbot python3-certbot-apache pure-ftpd postfix dovecot-core dovecot-imapd dovecot-pop3d

# Apache modüllerini aktifleştir
echo "🔧 Apache modülleri aktifleştiriliyor..."
a2enmod rewrite ssl headers proxy_fcgi setenvif
a2enconf php8.1-fpm

# MySQL güvenlik ayarları
echo "🔒 MySQL güvenlik ayarları yapılıyor..."
mysql_secure_installation

# Node.js bağımlılıklarını yükle
echo "📦 Node.js bağımlılıkları yükleniyor..."
npm install mysql2 archiver

# Web root dizinini oluştur
echo "📁 Web root dizini oluşturuluyor..."
mkdir -p /var/www/html
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# Backup dizini oluştur
mkdir -p /backups
chown -R www-data:www-data /backups

# FTP yapılandırması
echo "📧 FTP yapılandırması..."
cat > /etc/pure-ftpd/conf/ChrootEveryone << EOF
yes
EOF

cat > /etc/pure-ftpd/conf/CreateHomeDir << EOF
yes
EOF

systemctl restart pure-ftpd

# E-posta yapılandırması
echo "📧 E-posta sunucusu yapılandırması..."

# Postfix ana yapılandırması
cat > /etc/postfix/main.cf << EOF
smtpd_banner = \$myhostname ESMTP \$mail_name (Ubuntu)
biff = no
append_dot_mydomain = no
readme_directory = no
compatibility_level = 2

myhostname = $(hostname -f)
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
mydestination = localhost
relayhost = 
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

# Virtual domains
virtual_mailbox_domains = /etc/postfix/virtual_domains
virtual_mailbox_base = /var/mail/vhosts
virtual_mailbox_maps = /etc/postfix/virtual_users
virtual_minimum_uid = 100
virtual_uid_maps = static:5000
virtual_gid_maps = static:5000

# SASL Authentication
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_recipient_restrictions =
    permit_sasl_authenticated,
    permit_mynetworks,
    reject_unauth_destination

# TLS Settings
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_use_tls = yes
smtpd_tls_auth_only = yes
EOF

# Virtual domains ve users dosyalarını oluştur
touch /etc/postfix/virtual_domains
touch /etc/postfix/virtual_users

# Mail dizinini oluştur
mkdir -p /var/mail/vhosts
groupadd -g 5000 vmail
useradd -g vmail -u 5000 vmail -d /var/mail/vhosts -m
chown -R vmail:vmail /var/mail/vhosts

# Dovecot yapılandırması
cat > /etc/dovecot/dovecot.conf << EOF
protocols = imap pop3 lmtp
listen = *, ::
base_dir = /var/run/dovecot/
instance_name = dovecot
login_greeting = Dovecot ready.

mail_location = maildir:/var/mail/vhosts/%d/%n
mail_privileged_group = mail

namespace inbox {
  inbox = yes
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    group = postfix
    mode = 0660
    user = postfix
  }
}

passdb {
  driver = passwd-file
  args = scheme=PLAIN username_format=%u /etc/dovecot/users
}

userdb {
  driver = static
  args = uid=vmail gid=vmail home=/var/mail/vhosts/%d/%n
}

service auth-worker {
  user = vmail
}

ssl = yes
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key
EOF

# Dovecot users dosyası oluştur
touch /etc/dovecot/users
chown root:dovecot /etc/dovecot/users
chmod 640 /etc/dovecot/users

# Servisleri yeniden başlat
echo "🔄 Servisler başlatılıyor..."
systemctl restart apache2
systemctl restart mysql
systemctl restart php8.1-fpm
systemctl restart postfix
systemctl restart dovecot

# Servisleri otomatik başlatmaya ayarla
systemctl enable apache2
systemctl enable mysql
systemctl enable php8.1-fpm
systemctl enable postfix
systemctl enable dovecot
systemctl enable pure-ftpd

# Güvenlik duvarı ayarları
echo "🔒 Güvenlik duvarı ayarları..."
ufw allow OpenSSH
ufw allow 'Apache Full'
ufw allow 21/tcp  # FTP
ufw allow 993/tcp # IMAPS
ufw allow 995/tcp # POP3S
ufw allow 587/tcp # SMTP submission
ufw --force enable

# MySQL veritabanı oluştur
echo "🗄️ MySQL panel veritabanı oluşturuluyor..."
mysql -e "CREATE DATABASE IF NOT EXISTS hosting_panel;"
mysql -e "CREATE USER IF NOT EXISTS 'panel_user'@'localhost' IDENTIFIED BY 'panel_password_$(openssl rand -hex 8)';"
mysql -e "GRANT ALL PRIVILEGES ON hosting_panel.* TO 'panel_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# Hosting paneli için systemd service oluştur
cat > /etc/systemd/system/hosting-panel.service << EOF
[Unit]
Description=Web Hosting Panel
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/hosting-panel
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Panel dizinini oluştur ve dosyaları kopyala
echo "📁 Panel dosyaları kopyalanıyor..."
mkdir -p /opt/hosting-panel

# Panel dosyalarını kopyala
if [ -d "/tmp/hosting-panel-source" ]; then
    # GitHub'dan indirildi
    cp -r /tmp/hosting-panel-source/. /opt/hosting-panel/
    rm -rf /tmp/hosting-panel-source
else
    # Mevcut dizinden
    cp -r . /opt/hosting-panel/
fi

cd /opt/hosting-panel

# Node.js bağımlılıklarını yükle
echo "📦 Node.js bağımlılıkları yükleniyor..."
npm install

# Dizin izinlerini ayarla
chown -R www-data:www-data /opt/hosting-panel
chmod -R 755 /opt/hosting-panel

# Servisi başlat
echo "🚀 Hosting Panel servisi başlatılıyor..."
systemctl daemon-reload
systemctl enable hosting-panel
systemctl start hosting-panel

# Logrotate yapılandırması
cat > /etc/logrotate.d/hosting-panel << EOF
/var/log/hosting-panel/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
}
EOF

mkdir -p /var/log/hosting-panel
chown www-data:www-data /var/log/hosting-panel

echo "✅ Ubuntu Sunucu Altyapısı Hazır!"
echo ""
echo "📋 Yüklenen Servisler:"
echo "   ✅ Apache2 web sunucusu"
echo "   ✅ MySQL veritabanı sunucusu"
echo "   ✅ PHP 8.1 FastCGI"
echo "   ✅ Let's Encrypt SSL desteği"
echo "   ✅ Pure-FTPd FTP sunucusu"
echo "   ✅ Postfix + Dovecot e-posta sunucusu"
echo "   ✅ Node.js hosting environment"
echo ""

# Sunucu IP'sini otomatik tespit et
SERVER_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "N/A")

# Panel durumunu kontrol et
echo "🔍 Panel durumu kontrol ediliyor..."
sleep 3
if systemctl is-active --quiet hosting-panel; then
    echo "✅ Hosting Panel servisi çalışıyor"
else
    echo "❌ Hosting Panel servisi çalışmıyor"
    echo "   Durumu kontrol et: systemctl status hosting-panel"
fi

echo ""
echo "🎉 TÜM KURULUM TAMAMLANDI!"
echo ""
echo "🌐 PANEL ERİŞİM ADRESLERİ:"
echo "   📍 Yerel IP: http://${SERVER_IP}:3000"
if [ "$EXTERNAL_IP" != "N/A" ]; then
    echo "   🌍 Dış IP: http://${EXTERNAL_IP}:3000"
fi
echo "   🔗 Giriş: http://${SERVER_IP}:3000/login"
echo ""
echo "🔐 Giriş Bilgileri:"
echo "   👤 Kullanıcı: admin"
echo "   🔑 Şifre: admin123"
echo ""
echo "⚠️  Güvenlik için MySQL root şifresini değiştirmeyi unutmayın!" 
# 🚀 Professional Web Hosting Panel

Bu proje, **cPanel benzeri profesyonel web hosting kontrol paneli** uygulamasıdır. **Gerçek Ubuntu sunucularda çalışır** ve tam teşekküllü hosting hizmetleri sunar.

## 🎯 Temel Özellikler

### 🔐 Kimlik Doğrulama & Güvenlik
- Güvenli giriş sistemi
- Session tabanlı oturum yönetimi
- Kullanıcı bazlı yetkilendirme
- Helmet & CORS güvenlik katmanları

### 📊 Gelişmiş Dashboard
- **Gerçek zamanlı** sistem durumu (CPU, RAM, Disk)
- Apache, MySQL, PHP servis durumları
- Hosting istatistikleri
- Hızlı erişim paneli

### 🌐 Gerçek Domain Yönetimi
- **Apache Virtual Host** otomatik oluşturma
- Subdomain oluşturma ve yönetimi
- **Let's Encrypt SSL** sertifika otomasyonu
- DNS kayıt yönetimi
- Domain log takibi (access/error logs)

### 🗄️ MySQL Veritabanı Yönetimi
- **Gerçek MySQL** bağlantıları
- Veritabanı ve kullanıcı oluşturma
- Otomatik yetkilendirme
- Veritabanı yedekleme/geri yükleme

### 📁 Dosya Yöneticisi
- **Gerçek dosya sistemi** entegrasyonu
- 50MB'a kadar dosya yükleme
- Güvenlik filtreleri (.exe, .bat vb. engelleme)
- Dosya izin yönetimi

### 📧 E-posta Sunucusu
- **Postfix + Dovecot** entegrasyonu
- Gerçek e-posta hesabı oluşturma
- IMAP/POP3/SMTP desteği
- Mail quota yönetimi

### 🔒 SSL Sertifika Otomasyonu
- **Let's Encrypt** otomatik kurulum
- Self-signed SSL alternatifi
- Otomatik yenileme (cron job)
- SSL durumu takibi

### 💾 Profesyonel Yedekleme
- **Gerçek tar.gz** arşivleme
- Tam yedek (dosyalar + veritabanları)
- Otomatik günlük yedekleme
- Yedek indirme/geri yükleme

### 📊 FTP Entegrasyonu
- **Pure-FTPd** sunucu yönetimi
- Kullanıcı bazlı FTP hesapları
- Chroot jail güvenliği
- FTP quota yönetimi

## 🖥️ Ubuntu Sunucu Kurulumu

### 1. Sistem Gereksinimleri
- **Ubuntu 20.04 LTS** veya üzeri
- **2GB RAM** (minimum)
- **20GB disk** alanı
- **Root** erişimi

### 2. Uzaktan Kurulum (Önerilen)
```bash
# Sunucuya SSH ile bağlan, tek komut:
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/web-hosting-panel/main/install-remote.sh | sudo bash
```

### 3. Manuel Kurulum
```bash
# 1. Projeyi indirin
git clone https://github.com/YOUR_USERNAME/web-hosting-panel.git
cd web-hosting-panel

# 2. Tek komutla kurulum
sudo bash ubuntu-setup.sh

# Panel güncelleme (sonradan)
sudo bash deploy.sh
```

## 🔧 Sunucu Yapılandırması

### Kurulum Sonrası Otomatik Olarak Yüklenir:
- **Apache 2.4** - Web sunucusu
- **PHP 8.1** - FastCGI işleme
- **MySQL 8.0** - Veritabanı sunucusu
- **Let's Encrypt** - SSL sertifika otomasyonu
- **Pure-FTPd** - FTP sunucusu
- **Postfix + Dovecot** - Mail sunucusu
- **Nginx** - Reverse proxy (opsiyonel)

### Dizin Yapısı:
```
/opt/hosting-panel/     # Panel dosyaları
/var/www/html/          # Web siteleri
/etc/apache2/           # Apache yapılandırmaları
/backups/               # Yedek dosyaları
/var/mail/vhosts/       # Mail kutuları
```

## 🌐 Kullanım Senaryoları

### 1. Domain Ekleme
```
1. Panel → Domain Yönetimi
2. Alt domain oluştur: test.orneksite.com
3. Otomatik olarak oluşturulur:
   - Apache Virtual Host
   - MySQL veritabanı
   - FTP hesabı
   - Web klasörü (/var/www/html/kullanici/test.orneksite.com)
```

### 2. SSL Sertifikası
```
1. Domain detaylarına git
2. SSL Oluştur butonu
3. Let's Encrypt otomatik kurulum
4. HTTPS aktifleşir
```

### 3. E-posta Hesabı
```
1. E-posta Yönetimi
2. Yeni hesap oluştur: info@orneksite.com
3. Postfix/Dovecot otomatik yapılandırma
4. IMAP/SMTP hazır
```

## 📊 Sistem Yönetimi

### Servis Komutları:
```bash
# Panel durumu
systemctl status hosting-panel

# Panel yeniden başlat
systemctl restart hosting-panel

# Logları görüntüle
journalctl -u hosting-panel -f

# Apache yeniden başlat
systemctl restart apache2

# MySQL durumu
systemctl status mysql
```

### Güvenlik Ayarları:
```bash
# Firewall durumu
ufw status

# SSL sertifikalarını yenile
certbot renew

# Sistem güncellemesi
apt update && apt upgrade
```

## 🔒 Güvenlik Özellikleri

- **Chroot FTP** - Kullanıcılar sadece kendi dizinlerine erişir
- **SSL/TLS** - Tüm bağlantılar şifreli
- **Dosya Filtreleme** - Zararlı dosya türleri engellenir
- **MySQL İzolasyonu** - Kullanıcı bazlı veritabanı erişimi
- **Log Takibi** - Tüm işlemler loglanır
- **Otomatik Yedekleme** - Veri kaybı önlenir

## 📈 Performans & Monitoring

### Gerçek Zamanlı İzleme:
- CPU kullanımı
- RAM kullanımı
- Disk alanı
- Ağ trafiği
- Apache log analizi

### Otomatik Görevler:
- Günlük yedekleme (02:00)
- Haftalık temizlik (03:00 Pazar)
- SSL yenileme (Her 5 dakika kontrol)
- Log rotasyonu

## 🎯 Production Kullanımı

### Domain Bağlama:
1. A kaydı: `YOUR_SERVER_IP` (sunucu IP'nizi yazın)
2. Panel'e domain ekle: `http://YOUR_SERVER_IP:3000`
3. SSL sertifikası oluştur
4. Website dosyalarını yükle

### E-posta Sunucusu:
1. MX kaydı: `mail.orneksite.com`
2. Panel'den e-posta hesabı oluştur
3. IMAP/SMTP ayarları:
   - IMAP: `mail.orneksite.com:993` (SSL)
   - SMTP: `mail.orneksite.com:587` (TLS)

## 🔧 Teknoloji Stack

### Backend:
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MySQL2** - Veritabanı bağlantısı
- **Archiver** - Yedekleme sistemi
- **Child Process** - Sistem komutları

### Frontend:
- **EJS** - Template engine
- **Tailwind CSS** - Styling framework
- **FontAwesome** - İkonlar
- **Vanilla JS** - İnteraktivite

### Sistem Servisleri:
- **Apache 2.4** - Web server
- **PHP 8.1-FPM** - PHP işleyici
- **MySQL 8.0** - Veritabanı
- **Pure-FTPd** - FTP server
- **Postfix** - SMTP server
- **Dovecot** - IMAP/POP3 server

## 📞 Destek & Troubleshooting

### Log Dosyaları:
```bash
# Panel logları
journalctl -u hosting-panel -f

# Apache logları
tail -f /var/log/apache2/error.log

# MySQL logları
tail -f /var/log/mysql/error.log

# Mail logları
tail -f /var/log/mail.log
```

### Sık Karşılaşılan Sorunlar:
1. **Apache başlamıyor** → Port 80/443 kullanımda olabilir
2. **SSL çalışmıyor** → Let's Encrypt rate limit'i
3. **Mail gelmiyor** → DNS MX kayıtları kontrol edin
4. **FTP bağlantı hatası** → Firewall port 21 açık mı?

## 🚀 Gelecek Özellikler

- [ ] **WHM/cPanel** uyumlu API
- [ ] **Docker** konteyner desteği
- [ ] **Kubernetes** orkestrasyon
- [ ] **Multi-server** yönetimi
- [ ] **Advanced DNS** yönetimi
- [ ] **CDN** entegrasyonu
- [ ] **Web Application Firewall**
- [ ] **Automated backups** to S3/Google Cloud

## 📄 Lisans

MIT License - Ticari ve açık kaynak projelerde kullanılabilir.

---

**⚠️ Önemli Not:** Bu panel gerçek production sunucularda çalışır. Güvenlik ayarlarını dikkatlice yapılandırın ve düzenli güncellemeleri takip edin. 
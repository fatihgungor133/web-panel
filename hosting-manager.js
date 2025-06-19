const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
const util = require('util');

class HostingManager {
    constructor() {
        this.webRoot = '/var/www/html';
        this.apacheConfigPath = '/etc/apache2/sites-available';
        this.nginxConfigPath = '/etc/nginx/sites-available';
        this.phpVersion = '8.1';
        this.mysqlConfig = {
            host: 'localhost',
            user: 'root',
            password: process.env.MYSQL_ROOT_PASSWORD || '',
            database: 'mysql'
        };
    }

    // Komut çalıştırma helper
    async execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject({ error, stderr });
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    // Apache Virtual Host oluştur
    async createApacheVHost(domain, username) {
        const vhostConfig = `<VirtualHost *:80>
    ServerName ${domain}
    ServerAlias www.${domain}
    DocumentRoot /var/www/html/${username}/${domain}
    
    <Directory /var/www/html/${username}/${domain}>
        AllowOverride All
        Require all granted
        Options Indexes FollowSymLinks
    </Directory>
    
    ErrorLog \${APACHE_LOG_DIR}/${domain}_error.log
    CustomLog \${APACHE_LOG_DIR}/${domain}_access.log combined
    
    # PHP ayarları
    <FilesMatch \\.php$>
        SetHandler "proxy:unix:/var/run/php/php${this.phpVersion}-fpm.sock|fcgi://localhost"
    </FilesMatch>
</VirtualHost>

<VirtualHost *:443>
    ServerName ${domain}
    ServerAlias www.${domain}
    DocumentRoot /var/www/html/${username}/${domain}
    
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/${domain}.crt
    SSLCertificateKeyFile /etc/ssl/private/${domain}.key
    
    <Directory /var/www/html/${username}/${domain}>
        AllowOverride All
        Require all granted
        Options Indexes FollowSymLinks
    </Directory>
    
    ErrorLog \${APACHE_LOG_DIR}/${domain}_ssl_error.log
    CustomLog \${APACHE_LOG_DIR}/${domain}_ssl_access.log combined
    
    <FilesMatch \\.php$>
        SetHandler "proxy:unix:/var/run/php/php${this.phpVersion}-fpm.sock|fcgi://localhost"
    </FilesMatch>
</VirtualHost>`;

        const configPath = path.join(this.apacheConfigPath, `${domain}.conf`);
        await fs.writeFile(configPath, vhostConfig);
        
        // Site'ı aktifleştir
        await this.execCommand(`a2ensite ${domain}.conf`);
        await this.execCommand('systemctl reload apache2');
        
        return true;
    }

    // Domain klasörü oluştur
    async createDomainDirectory(domain, username) {
        const domainPath = path.join('/var/www/html', username, domain);
        await fs.mkdir(domainPath, { recursive: true });
        
        // Varsayılan index.php dosyası
        const indexContent = `<?php
echo "<h1>Hoş geldiniz - ${domain}</h1>";
echo "<p>Web siteniz başarıyla kuruldu!</p>";
echo "<p>PHP Version: " . phpversion() . "</p>";
echo "<p>Server Time: " . date('Y-m-d H:i:s') . "</p>";

// Veritabanı bağlantı testi
try {
    $pdo = new PDO('mysql:host=localhost;dbname=${username}_db', '${username}_user', 'password');
    echo "<p style='color: green;'>✅ Veritabanı bağlantısı başarılı!</p>";
} catch(PDOException $e) {
    echo "<p style='color: red;'>❌ Veritabanı bağlantısı başarısız: " . $e->getMessage() . "</p>";
}
?>`;

        await fs.writeFile(path.join(domainPath, 'index.php'), indexContent);
        
        // Dosya izinlerini ayarla
        await this.execCommand(`chown -R www-data:www-data ${domainPath}`);
        await this.execCommand(`chmod -R 755 ${domainPath}`);
        
        return domainPath;
    }

    // MySQL veritabanı oluştur
    async createMysqlDatabase(dbName, dbUser, dbPassword) {
        try {
            const connection = await mysql.createConnection(this.mysqlConfig);
            
            // Veritabanı oluştur
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
            
            // Kullanıcı oluştur
            await connection.execute(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}'`);
            
            // İzinleri ver
            await connection.execute(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`);
            await connection.execute('FLUSH PRIVILEGES');
            
            await connection.end();
            return true;
        } catch (error) {
            console.error('MySQL veritabanı oluşturma hatası:', error);
            throw error;
        }
    }

    // MySQL veritabanı sil
    async deleteMysqlDatabase(dbName, dbUser) {
        try {
            const connection = await mysql.createConnection(this.mysqlConfig);
            
            // Veritabanını sil
            await connection.execute(`DROP DATABASE IF EXISTS \`${dbName}\``);
            
            // Kullanıcıyı sil
            await connection.execute(`DROP USER IF EXISTS '${dbUser}'@'localhost'`);
            await connection.execute('FLUSH PRIVILEGES');
            
            await connection.end();
            return true;
        } catch (error) {
            console.error('MySQL veritabanı silme hatası:', error);
            throw error;
        }
    }

    // SSL sertifikası oluştur (Let's Encrypt)
    async createSSLCertificate(domain, email) {
        try {
            // Certbot ile SSL sertifikası al
            const certbotCommand = `certbot --apache -d ${domain} -d www.${domain} --email ${email} --agree-tos --non-interactive`;
            await this.execCommand(certbotCommand);
            return true;
        } catch (error) {
            console.error('SSL sertifikası oluşturma hatası:', error);
            // Manuel SSL sertifikası oluştur
            return await this.createSelfSignedSSL(domain);
        }
    }

    // Self-signed SSL sertifikası oluştur
    async createSelfSignedSSL(domain) {
        try {
            const keyPath = `/etc/ssl/private/${domain}.key`;
            const crtPath = `/etc/ssl/certs/${domain}.crt`;
            
            const opensslCommand = `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ${keyPath} -out ${crtPath} -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Hosting/CN=${domain}"`;
            await this.execCommand(opensslCommand);
            
            return true;
        } catch (error) {
            console.error('Self-signed SSL oluşturma hatası:', error);
            return false;
        }
    }

    // FTP kullanıcısı oluştur
    async createFTPUser(username, password, homeDir) {
        try {
            // Pure-FTPd için kullanıcı oluştur
            await this.execCommand(`pure-pw useradd ${username} -u www-data -g www-data -d ${homeDir}`);
            await this.execCommand(`pure-pw passwd ${username} <<< "${password}"`);
            await this.execCommand('pure-pw mkdb');
            
            return true;
        } catch (error) {
            console.error('FTP kullanıcısı oluşturma hatası:', error);
            return false;
        }
    }

    // E-posta hesabı oluştur (Postfix + Dovecot)
    async createEmailAccount(email, password) {
        try {
            const [localPart, domain] = email.split('@');
            
            // Postfix virtual kullanıcı dosyasına ekle
            const virtualUsers = `/etc/postfix/virtual_users`;
            const userEntry = `${email} ${localPart}\n`;
            await fs.appendFile(virtualUsers, userEntry);
            
            // Postfix haritasını güncelle
            await this.execCommand('postmap /etc/postfix/virtual_users');
            
            // Dovecot şifre dosyasına ekle
            const passwdEntry = `${email}:{PLAIN}${password}::::\n`;
            await fs.appendFile('/etc/dovecot/users', passwdEntry);
            
            // Posta klasörü oluştur
            const mailDir = `/var/mail/vhosts/${domain}/${localPart}`;
            await fs.mkdir(mailDir, { recursive: true });
            await this.execCommand(`chown -R vmail:vmail /var/mail/vhosts/${domain}`);
            
            // Servisleri yeniden başlat
            await this.execCommand('systemctl reload postfix');
            await this.execCommand('systemctl reload dovecot');
            
            return true;
        } catch (error) {
            console.error('E-posta hesabı oluşturma hatası:', error);
            return false;
        }
    }

    // Sistem durumunu kontrol et
    async getSystemStatus() {
        try {
            const [
                diskUsage,
                memoryUsage,
                cpuUsage,
                apacheStatus,
                mysqlStatus,
                phpStatus
            ] = await Promise.all([
                this.execCommand("df -h / | tail -n 1 | awk '{print $5}'"),
                this.execCommand("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'"),
                this.execCommand("top -bn1 | grep load | awk '{printf \"%.2f\", $(NF-2)}'"),
                this.execCommand('systemctl is-active apache2'),
                this.execCommand('systemctl is-active mysql'),
                this.execCommand(`php${this.phpVersion} -v | head -n 1`)
            ]);

            return {
                disk: diskUsage.trim(),
                memory: memoryUsage.trim() + '%',
                cpu: cpuUsage.trim(),
                services: {
                    apache: apacheStatus.trim() === 'active',
                    mysql: mysqlStatus.trim() === 'active',
                    php: phpStatus.includes('PHP')
                }
            };
        } catch (error) {
            console.error('Sistem durumu alınamadı:', error);
            return null;
        }
    }

    // Log dosyalarını oku
    async getLogFiles(domain, type = 'access', lines = 100) {
        try {
            const logFile = type === 'access' 
                ? `/var/log/apache2/${domain}_access.log`
                : `/var/log/apache2/${domain}_error.log`;
            
            const logs = await this.execCommand(`tail -n ${lines} ${logFile}`);
            return logs.split('\n').filter(line => line.trim());
        } catch (error) {
            console.error('Log dosyası okunamadı:', error);
            return [];
        }
    }

    // Yedekleme
    async createBackup(username, type = 'full') {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
            const backupName = `${username}_${type}_${timestamp}.tar.gz`;
            const backupPath = `/backups/${backupName}`;
            
            await fs.mkdir('/backups', { recursive: true });
            
            if (type === 'full') {
                // Tam yedek: dosyalar + veritabanları
                const userDir = `/var/www/html/${username}`;
                await this.execCommand(`tar -czf ${backupPath} -C /var/www/html ${username}`);
                
                // MySQL yedeklerini ekle
                const dbBackup = `/tmp/${username}_databases.sql`;
                await this.execCommand(`mysqldump --all-databases > ${dbBackup}`);
                await this.execCommand(`tar -rf ${backupPath} -C /tmp ${username}_databases.sql`);
                await this.execCommand(`rm ${dbBackup}`);
                
            } else if (type === 'database') {
                // Sadece veritabanı yedek
                await this.execCommand(`mysqldump --all-databases | gzip > ${backupPath}`);
            }
            
            return backupName;
        } catch (error) {
            console.error('Yedekleme hatası:', error);
            throw error;
        }
    }

    // Domain silme
    async deleteDomain(domain, username) {
        try {
            // Apache site'ını devre dışı bırak
            await this.execCommand(`a2dissite ${domain}.conf`);
            await this.execCommand('systemctl reload apache2');
            
            // Config dosyasını sil
            const configPath = path.join(this.apacheConfigPath, `${domain}.conf`);
            await fs.unlink(configPath);
            
            // Domain klasörünü sil
            const domainPath = path.join('/var/www/html', username, domain);
            await this.execCommand(`rm -rf ${domainPath}`);
            
            // SSL sertifikasını sil
            await this.execCommand(`rm -f /etc/ssl/certs/${domain}.crt`);
            await this.execCommand(`rm -f /etc/ssl/private/${domain}.key`);
            
            return true;
        } catch (error) {
            console.error('Domain silme hatası:', error);
            return false;
        }
    }
}

module.exports = new HostingManager(); 
const express = require('express');
const hostingManager = require('../hosting-manager');
const db = require('../db');
const router = express.Router();

// Mock domain listesi
const mockDomains = [
    {
        name: 'ornek.com',
        type: 'Ana Domain',
        created: new Date('2024-01-01'),
        expires: new Date('2025-01-01'),
        status: 'active',
        ssl: true
    },
    {
        name: 'test.ornek.com',
        type: 'Alt Domain',
        created: new Date('2024-01-15'),
        expires: null,
        status: 'active',
        ssl: false
    }
];

// Domain ana sayfa
router.get('/', async (req, res) => {
    try {
        const domains = await db.getDomains();
        const systemStatus = await hostingManager.getSystemStatus();
        
        res.render('domains', {
            username: req.session.username,
            domains,
            systemStatus,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Domain listesi alınamadı:', error);
        res.render('domains', {
            username: req.session.username,
            domains: [],
            systemStatus: null,
            error: 'Domain listesi yüklenemedi'
        });
    }
});

// Yeni domain oluştur
router.post('/create-subdomain', async (req, res) => {
    try {
        const { subdomain, mainDomain } = req.body;
        const username = req.session.username;
        const fullDomain = `${subdomain}.${mainDomain}`;
        
        // Domain formatını kontrol et
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?$/;
        if (!domainRegex.test(subdomain)) {
            return res.redirect('/domains?error=Geçersiz subdomain formatı');
        }
        
        // Aynı domain var mı kontrol et
        const domains = await db.getDomains();
        const exists = domains.find(d => d.name === fullDomain);
        if (exists) {
            return res.redirect('/domains?error=Bu domain zaten mevcut');
        }
        
        // Apache Virtual Host oluştur
        await hostingManager.createApacheVHost(fullDomain, username);
        
        // Domain klasörü oluştur ve index.php hazırla
        await hostingManager.createDomainDirectory(fullDomain, username);
        
        // MySQL veritabanı oluştur
        const dbName = `${username}_${subdomain}_db`;
        const dbUser = `${username}_${subdomain}`;
        const dbPassword = Math.random().toString(36).slice(-12);
        
        await hostingManager.createMysqlDatabase(dbName, dbUser, dbPassword);
        
        // FTP kullanıcısı oluştur
        const ftpUser = `${username}_${subdomain}`;
        const ftpPassword = Math.random().toString(36).slice(-12);
        await hostingManager.createFTPUser(ftpUser, ftpPassword, `/var/www/html/${username}/${fullDomain}`);
        
        // Veritabanına kaydet
        const newDomain = {
            name: fullDomain,
            type: 'Alt Domain',
            username: username,
            dbName: dbName,
            dbUser: dbUser,
            dbPassword: dbPassword,
            ftpUser: ftpUser,
            ftpPassword: ftpPassword,
            status: 'active',
            ssl: false
        };
        
        await db.createDomain(newDomain);
        
        res.redirect('/domains?success=Domain başarıyla oluşturuldu! Apache, MySQL ve FTP hazırlandı.');
    } catch (error) {
        console.error('Domain oluşturma hatası:', error);
        res.redirect('/domains?error=Domain oluşturulamadı: ' + error.message);
    }
});

// SSL sertifikası oluştur
router.post('/create-ssl', async (req, res) => {
    try {
        const { domainName, email } = req.body;
        const username = req.session.username;
        
        // Domain bu kullanıcıya ait mi kontrol et
        const domains = await db.getDomains();
        const domain = domains.find(d => d.name === domainName && d.username === username);
        if (!domain) {
            return res.redirect('/domains?error=Domain bulunamadı veya erişim yetkiniz yok');
        }
        
        // SSL sertifikası oluştur
        const sslResult = await hostingManager.createSSLCertificate(domainName, email);
        
        if (sslResult) {
            // Domain SSL durumunu güncelle
            domain.ssl = true;
            await db.writeTable('domains', domains);
            
            // SSL sertifikasını veritabanına kaydet
            await db.createSSLCert({
                domain: domainName,
                issuer: "Let's Encrypt",
                status: 'active',
                autoRenew: true
            });
            
            res.redirect('/domains?success=SSL sertifikası başarıyla oluşturuldu');
        } else {
            res.redirect('/domains?error=SSL sertifikası oluşturulamadı');
        }
    } catch (error) {
        console.error('SSL oluşturma hatası:', error);
        res.redirect('/domains?error=SSL sertifikası oluşturulamadı: ' + error.message);
    }
});

// Domain sil
router.post('/delete', async (req, res) => {
    try {
        const { domainName } = req.body;
        const username = req.session.username;
        
        // Domain bu kullanıcıya ait mi kontrol et
        const domains = await db.getDomains();
        const domain = domains.find(d => d.name === domainName && d.username === username);
        if (!domain) {
            return res.redirect('/domains?error=Domain bulunamadı veya erişim yetkiniz yok');
        }
        
        // Apache virtual host'u sil
        await hostingManager.deleteDomain(domainName, username);
        
        // MySQL veritabanını sil
        if (domain.dbName && domain.dbUser) {
            await hostingManager.deleteMysqlDatabase(domain.dbName, domain.dbUser);
        }
        
        // Veritabanından sil
        await db.deleteDomain(domainName);
        
        res.redirect('/domains?success=Domain ve tüm bileşenleri başarıyla silindi');
    } catch (error) {
        console.error('Domain silme hatası:', error);
        res.redirect('/domains?error=Domain silinemedi: ' + error.message);
    }
});

// Domain bilgilerini görüntüle
router.get('/info/:domainName', async (req, res) => {
    try {
        const domainName = req.params.domainName;
        const username = req.session.username;
        
        const domains = await db.getDomains();
        const domain = domains.find(d => d.name === domainName && d.username === username);
        
        if (!domain) {
            return res.redirect('/domains?error=Domain bulunamadı');
        }
        
        // Log dosyalarını al
        const accessLogs = await hostingManager.getLogFiles(domainName, 'access', 50);
        const errorLogs = await hostingManager.getLogFiles(domainName, 'error', 50);
        
        res.render('domain-info', {
            username,
            domain,
            accessLogs,
            errorLogs
        });
    } catch (error) {
        console.error('Domain bilgileri alınamadı:', error);
        res.redirect('/domains?error=Domain bilgileri alınamadı');
    }
});

module.exports = router; 
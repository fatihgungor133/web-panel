const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const helmet = require('helmet');
const cors = require('cors');
const moment = require('moment');
const db = require('./db');
const activityLogger = require('./activity-logger');

const app = express();
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// SSL sertifika dosyaları
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'private.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'certificate.crt'))
};

// Middleware - HTTPS için optimize edilmiş CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sadece HTTPS - HTTP yönlendirmesi yok

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Oturum yapılandırması - HTTPS için güvenli
app.use(session({
    secret: 'hosting-panel-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true, // HTTPS için true
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Dosya yükleme yapılandırması
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'user_files', req.session.username || 'guest');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Kullanıcı dosyalarını hazırla
async function ensureUserDirectories() {
    const dirs = ['user_files', 'backups', 'logs', 'ssl'];
    for (const dir of dirs) {
        try {
            await fs.promises.mkdir(path.join(__dirname, dir), { recursive: true });
        } catch (error) {
            console.log(`${dir} klasörü zaten mevcut`);
        }
    }
}

// Kimlik doğrulama middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/login');
}

// Varsayılan kullanıcı oluştur
const defaultUsers = {
    'admin': bcrypt.hashSync('admin123', 10),
    'user': bcrypt.hashSync('user123', 10)
};

// Ana sayfa
app.get('/', requireAuth, async (req, res) => {
    try {
        const stats = await getSystemStats();
        const recentActivities = await activityLogger.getRecentActivities(8);
        
        res.render('dashboard', { 
            username: req.session.username,
            stats,
            activities: recentActivities,
            activityLogger,
            moment
        });
    } catch (error) {
        console.error('Dashboard yüklenirken hata:', error);
        res.render('dashboard', { 
            username: req.session.username,
            stats: {},
            activities: [],
            activityLogger,
            moment
        });
    }
});

// Giriş sayfası
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (defaultUsers[username] && bcrypt.compareSync(password, defaultUsers[username])) {
        req.session.authenticated = true;
        req.session.username = username;
        
        // Kullanıcı klasörünü oluştur
        const userDir = path.join(__dirname, 'user_files', username);
        try {
            await fs.promises.mkdir(userDir, { recursive: true });
        } catch (error) {
            console.log('Kullanıcı klasörü zaten mevcut');
        }
        
        // Giriş aktivitesini kaydet
        await activityLogger.logLogin(username, req.ip);
        
        res.redirect('/');
    } else {
        res.render('login', { error: 'Geçersiz kullanıcı adı veya şifre!' });
    }
});

// Çıkış
app.get('/logout', async (req, res) => {
    const username = req.session.username;
    
    // Çıkış aktivitesini kaydet
    if (username) {
        await activityLogger.logLogout(username);
    }
    
    req.session.destroy();
    res.redirect('/login');
});

// Sistem istatistikleri
async function getSystemStats() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const stats = {
        diskUsage: '0 GB',
        diskFree: '0 GB',
        diskTotal: '0 GB',
        diskPercent: '0%',
        memoryUsage: '0 MB',
        memoryFree: '0 MB', 
        memoryTotal: '0 MB',
        memoryPercent: '0%',
        cpuUsage: '0%',
        loadAverage: '0.00',
        uptime: process.uptime(),
        systemUptime: '0 gün',
        nodeVersion: process.version,
        platform: process.platform,
        processes: '0',
        networkConnections: '0'
    };
    
    try {
        // Disk kullanımı (df komutu ile)
        try {
            const { stdout: diskInfo } = await execAsync('df -h / | tail -1');
            const diskParts = diskInfo.trim().split(/\s+/);
            if (diskParts.length >= 6) {
                stats.diskTotal = diskParts[1];
                stats.diskUsage = diskParts[2];
                stats.diskFree = diskParts[3];
                stats.diskPercent = diskParts[4];
            }
        } catch (error) {
            console.log('Disk bilgisi alınamadı:', error.message);
        }

        // Bellek kullanımı (free komutu ile)
        try {
            const { stdout: memInfo } = await execAsync('free -h | grep "Mem:"');
            const memParts = memInfo.trim().split(/\s+/);
            if (memParts.length >= 4) {
                stats.memoryTotal = memParts[1];
                stats.memoryUsage = memParts[2];
                stats.memoryFree = memParts[3];
                
                // Yüzde hesapla
                const totalBytes = parseMemory(memParts[1]);
                const usedBytes = parseMemory(memParts[2]);
                if (totalBytes > 0) {
                    stats.memoryPercent = Math.round((usedBytes / totalBytes) * 100) + '%';
                }
            }
        } catch (error) {
            console.log('Bellek bilgisi alınamadı:', error.message);
            // Fallback: Node.js process bellek kullanımı
            const memUsage = process.memoryUsage();
            stats.memoryUsage = formatBytes(memUsage.rss);
        }

        // CPU kullanımı (top komutu ile)
        try {
            const { stdout: cpuInfo } = await execAsync('top -bn1 | grep "Cpu(s)" | head -1');
            const cpuMatch = cpuInfo.match(/(\d+\.?\d*)%\s*us/);
            if (cpuMatch) {
                stats.cpuUsage = cpuMatch[1] + '%';
            }
        } catch (error) {
            console.log('CPU bilgisi alınamadı:', error.message);
        }

        // Load average
        try {
            const { stdout: loadInfo } = await execAsync('uptime | grep -o "load average.*" | cut -d" " -f3');
            stats.loadAverage = loadInfo.trim().replace(',', '');
        } catch (error) {
            console.log('Load average alınamadı:', error.message);
        }

        // Sistem uptime
        try {
            const { stdout: uptimeInfo } = await execAsync('uptime -p');
            stats.systemUptime = uptimeInfo.trim().replace('up ', '');
        } catch (error) {
            console.log('Sistem uptime alınamadı:', error.message);
        }

        // Aktif process sayısı
        try {
            const { stdout: processCount } = await execAsync('ps aux | wc -l');
            stats.processes = (parseInt(processCount.trim()) - 1).toString(); // Header satırını çıkar
        } catch (error) {
            console.log('Process sayısı alınamadı:', error.message);
        }

        // Network bağlantı sayısı
        try {
            const { stdout: netConnections } = await execAsync('netstat -an | grep ESTABLISHED | wc -l');
            stats.networkConnections = netConnections.trim();
        } catch (error) {
            console.log('Network bağlantı sayısı alınamadı:', error.message);
        }

        // User files disk kullanımı (eski kod)
        const userFilesPath = path.join(__dirname, 'user_files');
        const userFilesSize = await getDirSize(userFilesPath);
        stats.userFilesSize = formatBytes(userFilesSize);
        
    } catch (error) {
        console.error('İstatistikler alınırken hata:', error);
    }
    
    return stats;
}

// Bellek string'ini byte'a çevir (K, M, G için)
function parseMemory(memStr) {
    const units = { 'K': 1024, 'M': 1024*1024, 'G': 1024*1024*1024 };
    const match = memStr.match(/^([\d.]+)([KMG]?)i?$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || '';
    return value * (units[unit] || 1);
}

// Klasör boyutunu hesapla
async function getDirSize(dirPath) {
    let size = 0;
    try {
        const files = await fs.promises.readdir(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.promises.stat(filePath);
            if (stat.isDirectory()) {
                size += await getDirSize(filePath);
            } else {
                size += stat.size;
            }
        }
    } catch (error) {
        return 0;
    }
    return size;
}

// Byte formatla
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Rotalar
app.use('/files', requireAuth, require('./routes/files'));
app.use('/database', requireAuth, require('./routes/database'));
app.use('/email', requireAuth, require('./routes/email'));
app.use('/domains', requireAuth, require('./routes/domains'));
app.use('/ssl', requireAuth, require('./routes/ssl'));
app.use('/backup', requireAuth, require('./routes/backup'));

// Sadece HTTPS sunucusu
https.createServer(sslOptions, app).listen(HTTPS_PORT, async () => {
    await ensureUserDirectories();
    await db.initializeData();
    
    // Sistem başlangıç aktivitesini kaydet
    await activityLogger.logSystemStart();
    
    const { getServerIP } = require('./ip-checker');
    const serverIP = getServerIP();
    
    console.log(`🔒 HTTPS Hosting Kontrol Paneli ${HTTPS_PORT} portunda çalışıyor`);
    console.log(`🌐 Panel Adresi: https://${serverIP}:${HTTPS_PORT}`);
    console.log(`🔗 Giriş: https://${serverIP}:${HTTPS_PORT}/login`);
    console.log(`👤 Varsayılan kullanıcı: admin / admin123`);
    console.log(`🔒 Self-signed SSL aktif`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 HTTPS ERİŞİM: https://${serverIP}:${HTTPS_PORT}`);
}); 
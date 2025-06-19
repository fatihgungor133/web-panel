const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const helmet = require('helmet');
const cors = require('cors');
const moment = require('moment');
const db = require('./db');
const activityLogger = require('./activity-logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CSP ayarları ile (IP erişimi için optimize)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'"],
            formAction: ["'self'", "https:", "http:"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"]
            // upgradeInsecureRequests kaldırıldı - IP erişimi için
        }
    }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// HTTPS yönlendirme (sadece domain adı varsa)
app.use((req, res, next) => {
    const host = req.header('host');
    const isIP = /^\d+\.\d+\.\d+\.\d+/.test(host);
    
    if (process.env.NODE_ENV === 'production' && 
        process.env.FORCE_HTTPS === 'true' && 
        !isIP && 
        req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${host}${req.url}`);
    } else {
        next();
    }
});

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Oturum yapılandırması
app.use(session({
    secret: 'hosting-panel-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // IP erişimi için false
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
    const dirs = ['user_files', 'backups', 'logs'];
    for (const dir of dirs) {
        try {
            await fs.mkdir(path.join(__dirname, dir), { recursive: true });
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
            await fs.mkdir(userDir, { recursive: true });
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

// Gerçek sistem istatistikleri
async function getSystemStats() {
    const stats = {
        diskUsage: '0 GB',
        diskUsagePercent: 0,
        memoryUsage: '0 MB',
        memoryUsagePercent: 0,
        cpuUsage: 0,
        uptime: process.uptime(),
        systemUptime: 0,
        nodeVersion: process.version,
        platform: process.platform,
        loadAverage: [0, 0, 0],
        activeConnections: 0,
        totalFiles: 0,
        totalDatabases: 0,
        totalEmails: 0,
        totalDomains: 0
    };
    
    try {
        // Sistem bellek bilgileri
        const { execSync } = require('child_process');
        
        // RAM kullanımı (Linux)
        if (process.platform === 'linux') {
            const memInfo = execSync('cat /proc/meminfo').toString();
            const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
            const memFree = parseInt(memInfo.match(/MemFree:\s+(\d+)/)[1]) * 1024;
            const memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
            const memUsed = memTotal - memAvailable;
            
            stats.memoryUsage = formatBytes(memUsed);
            stats.memoryUsagePercent = Math.round((memUsed / memTotal) * 100);
            stats.memoryTotal = formatBytes(memTotal);
        } else {
            // Node.js process bellek kullanımı (fallback)
            const memUsage = process.memoryUsage();
            stats.memoryUsage = formatBytes(memUsage.rss);
        }
        
        // Disk kullanımı (Linux)
        if (process.platform === 'linux') {
            const diskInfo = execSync('df -h /').toString().split('\n')[1].split(/\s+/);
            stats.diskUsage = diskInfo[2];
            stats.diskTotal = diskInfo[1];
            stats.diskUsagePercent = parseInt(diskInfo[4].replace('%', ''));
        } else {
            // Fallback: user_files boyutu
            const userFilesPath = path.join(__dirname, 'user_files');
            const size = await getDirSize(userFilesPath);
            stats.diskUsage = formatBytes(size);
        }
        
        // CPU kullanımı (ortalama load)
        const loadAvg = require('os').loadavg();
        stats.loadAverage = loadAvg.map(load => Math.round(load * 100) / 100);
        stats.cpuUsage = Math.round(loadAvg[0] * 100);
        
        // Sistem uptime
        stats.systemUptime = require('os').uptime();
        
        // Panel verileri
        const databases = await db.getData('databases') || [];
        const emails = await db.getData('email_accounts') || [];
        const domains = await db.getData('domains') || [];
        
        stats.totalDatabases = databases.length;
        stats.totalEmails = emails.length;
        stats.totalDomains = domains.length;
        
        // Dosya sayısı
        const userFilesPath = path.join(__dirname, 'user_files');
        stats.totalFiles = await countFiles(userFilesPath);
        
        // Aktif bağlantılar (Linux)
        if (process.platform === 'linux') {
            try {
                const connections = execSync('netstat -an | grep :443 | grep ESTABLISHED | wc -l').toString().trim();
                stats.activeConnections = parseInt(connections) || 0;
            } catch (e) {
                stats.activeConnections = 0;
            }
        }
        
    } catch (error) {
        console.error('İstatistikler alınırken hata:', error);
    }
    
    return stats;
}

// Klasör boyutunu hesapla
async function getDirSize(dirPath) {
    let size = 0;
    try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
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

// Dosya sayısını hesapla
async function countFiles(dirPath) {
    let count = 0;
    try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                count += await countFiles(filePath);
            } else {
                count++;
            }
        }
    } catch (error) {
        return 0;
    }
    return count;
}

// Uptime formatla
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}g ${hours}s`;
    } else if (hours > 0) {
        return `${hours}s ${minutes}d`;
    } else {
        return `${minutes}d`;
    }
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

// Sunucuyu başlat
app.listen(PORT, async () => {
    await ensureUserDirectories();
    await db.initializeData(); // Veritabanını başlat
    
    // Sistem başlangıç aktivitesini kaydet
    await activityLogger.logSystemStart();
    
    // IP checker'ı kullan
    const { getServerIP } = require('./ip-checker');
    const serverIP = getServerIP();
    
    console.log(`🚀 Hosting Kontrol Paneli ${PORT} portunda çalışıyor`);
    console.log(`🌐 Panel Adresi: http://${serverIP}:${PORT}`);
    console.log(`🔗 Giriş: http://${serverIP}:${PORT}/login`);
    console.log(`👤 Varsayılan kullanıcı: admin / admin123`);
    console.log(`💾 JSON veritabanı hazırlandı`);
    console.log(`📡 IP bilgileri: node ip-checker.js`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 BURADAN ERİŞ: http://${serverIP}:${PORT}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}); 
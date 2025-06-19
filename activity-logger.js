const fs = require('fs').promises;
const path = require('path');

class ActivityLogger {
    constructor() {
        this.logFile = path.join(__dirname, 'data', 'activities.json');
        this.maxLogs = 100; // Son 100 aktiviteyi tut
    }

    async log(action, details, username = 'system') {
        try {
            const activity = {
                id: Date.now(),
                action,
                details,
                username,
                timestamp: new Date().toISOString(),
                ip: this.getClientIP()
            };

            // Mevcut logları oku
            let activities = [];
            try {
                const data = await fs.readFile(this.logFile, 'utf8');
                activities = JSON.parse(data);
            } catch (error) {
                // Dosya yoksa boş array
                activities = [];
            }

            // Yeni aktiviteyi ekle
            activities.unshift(activity);

            // Maksimum log sayısını aş
            if (activities.length > this.maxLogs) {
                activities = activities.slice(0, this.maxLogs);
            }

            // Dosyaya yaz
            await fs.writeFile(this.logFile, JSON.stringify(activities, null, 2));
        } catch (error) {
            console.error('Aktivite kaydedilirken hata:', error);
        }
    }

    async getRecentActivities(limit = 10) {
        try {
            const data = await fs.readFile(this.logFile, 'utf8');
            const activities = JSON.parse(data);
            return activities.slice(0, limit);
        } catch (error) {
            return [];
        }
    }

    getClientIP() {
        // Bu IP'yi request'ten alacağız, şimdilik placeholder
        return '127.0.0.1';
    }

    // Yaygın aktivite tipleri
    async logLogin(username, ip) {
        await this.log('login', `Kullanıcı giriş yaptı`, username);
    }

    async logLogout(username) {
        await this.log('logout', `Kullanıcı çıkış yaptı`, username);
    }

    async logFileUpload(filename, username) {
        await this.log('file_upload', `Dosya yüklendi: ${filename}`, username);
    }

    async logFileDelete(filename, username) {
        await this.log('file_delete', `Dosya silindi: ${filename}`, username);
    }

    async logDatabaseCreate(dbName, username) {
        await this.log('database_create', `Veritabanı oluşturuldu: ${dbName}`, username);
    }

    async logDatabaseDelete(dbName, username) {
        await this.log('database_delete', `Veritabanı silindi: ${dbName}`, username);
    }

    async logEmailCreate(email, username) {
        await this.log('email_create', `E-posta hesabı oluşturuldu: ${email}`, username);
    }

    async logEmailDelete(email, username) {
        await this.log('email_delete', `E-posta hesabı silindi: ${email}`, username);
    }

    async logDomainCreate(domain, username) {
        await this.log('domain_create', `Domain eklendi: ${domain}`, username);
    }

    async logBackupCreate(type, username) {
        await this.log('backup_create', `Yedekleme oluşturuldu: ${type}`, username);
    }

    async logSystemStart() {
        await this.log('system_start', 'Hosting panel başlatıldı');
    }

    getActivityIcon(action) {
        const icons = {
            'login': 'fas fa-sign-in-alt text-green-500',
            'logout': 'fas fa-sign-out-alt text-red-500',
            'file_upload': 'fas fa-upload text-blue-500',
            'file_delete': 'fas fa-trash text-red-500',
            'database_create': 'fas fa-database text-green-500',
            'database_delete': 'fas fa-database text-red-500',
            'email_create': 'fas fa-envelope text-green-500',
            'email_delete': 'fas fa-envelope text-red-500',
            'domain_create': 'fas fa-globe text-green-500',
            'backup_create': 'fas fa-shield-alt text-blue-500',
            'system_start': 'fas fa-power-off text-green-500'
        };
        return icons[action] || 'fas fa-info-circle text-gray-500';
    }

    getActivityColor(action) {
        const colors = {
            'login': 'green',
            'logout': 'red',
            'file_upload': 'blue',
            'file_delete': 'red',
            'database_create': 'green',
            'database_delete': 'red',
            'email_create': 'green',
            'email_delete': 'red',
            'domain_create': 'green',
            'backup_create': 'blue',
            'system_start': 'green'
        };
        return colors[action] || 'gray';
    }
}

module.exports = new ActivityLogger(); 
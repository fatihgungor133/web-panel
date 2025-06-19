const fs = require('fs').promises;
const path = require('path');

class SimpleDB {
    constructor() {
        this.dbPath = path.join(__dirname, 'data');
        this.ensureDBDir();
    }

    async ensureDBDir() {
        try {
            await fs.mkdir(this.dbPath, { recursive: true });
        } catch (error) {
            console.log('DB klasörü zaten mevcut');
        }
    }

    async readTable(tableName) {
        try {
            const filePath = path.join(this.dbPath, `${tableName}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    async writeTable(tableName, data) {
        try {
            const filePath = path.join(this.dbPath, `${tableName}.json`);
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Veritabanı yazma hatası:', error);
            return false;
        }
    }

    // Veritabanları
    async getDatabases() {
        return await this.readTable('databases');
    }

    async createDatabase(dbData) {
        const databases = await this.getDatabases();
        databases.push({
            ...dbData,
            id: Date.now(),
            created: new Date()
        });
        return await this.writeTable('databases', databases);
    }

    async deleteDatabase(dbName) {
        const databases = await this.getDatabases();
        const filtered = databases.filter(db => db.name !== dbName);
        return await this.writeTable('databases', filtered);
    }

    // E-posta hesapları
    async getEmailAccounts() {
        return await this.readTable('email_accounts');
    }

    async createEmailAccount(emailData) {
        const accounts = await this.getEmailAccounts();
        accounts.push({
            ...emailData,
            id: Date.now(),
            created: new Date()
        });
        return await this.writeTable('email_accounts', accounts);
    }

    async deleteEmailAccount(email) {
        const accounts = await this.getEmailAccounts();
        const filtered = accounts.filter(acc => acc.email !== email);
        return await this.writeTable('email_accounts', filtered);
    }

    // Domain'ler
    async getDomains() {
        return await this.readTable('domains');
    }

    async createDomain(domainData) {
        const domains = await this.getDomains();
        domains.push({
            ...domainData,
            id: Date.now(),
            created: new Date()
        });
        return await this.writeTable('domains', domains);
    }

    async deleteDomain(domainName) {
        const domains = await this.getDomains();
        const filtered = domains.filter(domain => domain.name !== domainName);
        return await this.writeTable('domains', filtered);
    }

    // SSL Sertifikaları
    async getSSLCerts() {
        return await this.readTable('ssl_certs');
    }

    async createSSLCert(sslData) {
        const certs = await this.getSSLCerts();
        certs.push({
            ...sslData,
            id: Date.now(),
            issued: new Date(),
            expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 gün sonra
        });
        return await this.writeTable('ssl_certs', certs);
    }

    // Yedekler
    async getBackups() {
        return await this.readTable('backups');
    }

    async createBackup(backupData) {
        const backups = await this.getBackups();
        backups.push({
            ...backupData,
            id: Date.now(),
            created: new Date()
        });
        return await this.writeTable('backups', backups);
    }

    async deleteBackup(filename) {
        const backups = await this.getBackups();
        const filtered = backups.filter(backup => backup.name !== filename);
        return await this.writeTable('backups', filtered);
    }

    // Başlangıç verilerini oluştur
    async initializeData() {
        // Varsayılan veritabanları
        const databases = await this.getDatabases();
        if (databases.length === 0) {
            await this.writeTable('databases', [
                {
                    name: 'website_db',
                    size: '15.2 MB',
                    tables: 8,
                    created: new Date('2024-01-15'),
                    status: 'active'
                },
                {
                    name: 'blog_db',
                    size: '3.8 MB',
                    tables: 5,
                    created: new Date('2024-02-01'),
                    status: 'active'
                }
            ]);
        }

        // Varsayılan e-posta hesapları
        const emails = await this.getEmailAccounts();
        if (emails.length === 0) {
            await this.writeTable('email_accounts', [
                {
                    email: 'info@ornek.com',
                    quota: '1 GB',
                    used: '256 MB',
                    created: new Date('2024-01-10'),
                    status: 'active'
                },
                {
                    email: 'destek@ornek.com',
                    quota: '500 MB',
                    used: '120 MB',
                    created: new Date('2024-01-15'),
                    status: 'active'
                }
            ]);
        }

        // Varsayılan domain'ler
        const domains = await this.getDomains();
        if (domains.length === 0) {
            await this.writeTable('domains', [
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
            ]);
        }

        // Varsayılan SSL sertifikaları
        const sslCerts = await this.getSSLCerts();
        if (sslCerts.length === 0) {
            await this.writeTable('ssl_certs', [
                {
                    domain: 'ornek.com',
                    issuer: "Let's Encrypt",
                    issued: new Date('2024-01-01'),
                    expires: new Date('2024-04-01'),
                    status: 'active',
                    autoRenew: true
                }
            ]);
        }

        // Varsayılan yedekler
        const backups = await this.getBackups();
        if (backups.length === 0) {
            await this.writeTable('backups', [
                {
                    name: 'full_backup_20240115.zip',
                    type: 'Tam Yedek',
                    size: '450 MB',
                    created: new Date('2024-01-15'),
                    status: 'completed'
                },
                {
                    name: 'database_backup_20240110.sql',
                    type: 'Veritabanı',
                    size: '25 MB',
                    created: new Date('2024-01-10'),
                    status: 'completed'
                }
            ]);
        }
    }
}

module.exports = new SimpleDB(); 
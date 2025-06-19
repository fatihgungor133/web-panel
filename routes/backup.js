const express = require('express');
const archiver = require('archiver');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const db = require('../db');
const router = express.Router();

// Yedekleme ana sayfa
router.get('/', async (req, res) => {
    try {
        const backups = await db.getBackups();
        res.render('backup', {
            username: req.session.username,
            backups,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Yedek listesi alınamadı:', error);
        res.render('backup', {
            username: req.session.username,
            backups: [],
            error: 'Yedek listesi yüklenemedi'
        });
    }
});

// Yeni yedek oluştur
router.post('/create', async (req, res) => {
    try {
        const { backupType } = req.body;
        const timestamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const filename = `${backupType}_backup_${timestamp}.zip`;
        
        const newBackup = {
            name: filename,
            type: backupType === 'full' ? 'Tam Yedek' : 'Veritabanı',
            size: '0 MB',
            status: 'processing'
        };
        
        // Veritabanına ekle
        await db.createBackup(newBackup);
        
        // Gerçek yedekleme işlemi (arka planda)
        setTimeout(async () => {
            try {
                const backupPath = path.join(__dirname, '../backups');
                await fs.mkdir(backupPath, { recursive: true });
                
                const zipPath = path.join(backupPath, filename);
                const output = fsSync.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });
                
                output.on('close', async () => {
                    const stats = await fs.stat(zipPath);
                    const size = (stats.size / (1024 * 1024)).toFixed(1) + ' MB';
                    
                    // Yedek durumunu güncelle
                    const backups = await db.getBackups();
                    const backup = backups.find(b => b.name === filename);
                    if (backup) {
                        backup.status = 'completed';
                        backup.size = size;
                        await db.writeTable('backups', backups);
                    }
                });
                
                archive.pipe(output);
                
                if (backupType === 'full') {
                    // Kullanıcı dosyalarını yedekle
                    const userFilesPath = path.join(__dirname, '../user_files');
                    if (fsSync.existsSync(userFilesPath)) {
                        archive.directory(userFilesPath, 'user_files');
                    }
                    
                    // Veritabanını yedekle
                    const dataPath = path.join(__dirname, '../data');
                    if (fsSync.existsSync(dataPath)) {
                        archive.directory(dataPath, 'data');
                    }
                } else {
                    // Sadece veritabanını yedekle
                    const dataPath = path.join(__dirname, '../data');
                    if (fsSync.existsSync(dataPath)) {
                        archive.directory(dataPath, 'data');
                    }
                }
                
                await archive.finalize();
                
            } catch (error) {
                console.error('Yedekleme hatası:', error);
                // Hatayı veritabanına kaydet
                const backups = await db.getBackups();
                const backup = backups.find(b => b.name === filename);
                if (backup) {
                    backup.status = 'failed';
                    await db.writeTable('backups', backups);
                }
            }
        }, 1000);
        
        res.redirect('/backup?success=Yedekleme işlemi başlatıldı');
    } catch (error) {
        console.error('Yedekleme başlatma hatası:', error);
        res.redirect('/backup?error=Yedekleme başlatılamadı');
    }
});

// Yedek indir
router.get('/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const backupPath = path.join(__dirname, '../backups', filename);
        
        // Dosya var mı kontrol et
        try {
            await fs.access(backupPath);
        } catch (error) {
            return res.redirect('/backup?error=Yedek dosyası bulunamadı');
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/zip');
        
        const fileStream = fsSync.createReadStream(backupPath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Yedek indirme hatası:', error);
        res.redirect('/backup?error=Yedek indirilemedi');
    }
});

// Yedek sil
router.post('/delete', async (req, res) => {
    try {
        const { filename } = req.body;
        
        // Veritabanından sil
        await db.deleteBackup(filename);
        
        // Fiziksel dosyayı sil
        const backupPath = path.join(__dirname, '../backups', filename);
        try {
            await fs.unlink(backupPath);
        } catch (error) {
            console.log('Fiziksel dosya zaten mevcut değil');
        }
        
        res.redirect('/backup?success=Yedek başarıyla silindi');
    } catch (error) {
        console.error('Yedek silme hatası:', error);
        res.redirect('/backup?error=Yedek silinemedi');
    }
});

module.exports = router; 
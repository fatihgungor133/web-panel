const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');
const extract = require('extract-zip');

const router = express.Router();

// Dosya yükleme yapılandırması
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../user_files', req.session.username);
        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Güvenlik: kötü dosya türlerini engelle
        const forbidden = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (forbidden.includes(ext)) {
            cb(new Error('Bu dosya türü yüklenemez!'));
        } else {
            cb(null, true);
        }
    }
});

// Dosya yöneticisi ana sayfa
router.get('/', async (req, res) => {
    try {
        const userDir = path.join(__dirname, '../user_files', req.session.username);
        const currentPath = req.query.path || '';
        const fullPath = path.join(userDir, currentPath);
        
        // Güvenlik kontrolü
        if (!fullPath.startsWith(userDir)) {
            return res.redirect('/files');
        }
        
        const files = await fs.readdir(fullPath);
        const fileDetails = [];
        
        for (const file of files) {
            try {
                const filePath = path.join(fullPath, file);
                const stats = await fs.stat(filePath);
                fileDetails.push({
                    name: file,
                    isDirectory: stats.isDirectory(),
                    size: stats.size,
                    modified: stats.mtime,
                    path: path.join(currentPath, file).replace(/\\/g, '/')
                });
            } catch (error) {
                console.error(`Dosya bilgisi alınamadı: ${file}`, error);
            }
        }
        
        // Klasörleri önce sırala
        fileDetails.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        res.render('files', {
            username: req.session.username,
            files: fileDetails,
            currentPath,
            breadcrumbs: getBreadcrumbs(currentPath)
        });
    } catch (error) {
        console.error('Dosya listesi alınamadı:', error);
        res.render('files', {
            username: req.session.username,
            files: [],
            currentPath: '',
            breadcrumbs: [],
            error: 'Dosyalar yüklenemedi'
        });
    }
});

// Dosya yükleme
router.post('/upload', upload.array('files'), (req, res) => {
    const currentPath = req.body.currentPath || '';
    res.redirect(`/files?path=${encodeURIComponent(currentPath)}&success=Dosyalar başarıyla yüklendi`);
});

// Klasör oluşturma
router.post('/mkdir', async (req, res) => {
    try {
        const { folderName, currentPath } = req.body;
        const userDir = path.join(__dirname, '../user_files', req.session.username);
        const newFolderPath = path.join(userDir, currentPath || '', folderName);
        
        await fs.mkdir(newFolderPath, { recursive: true });
        res.redirect(`/files?path=${encodeURIComponent(currentPath || '')}&success=Klasör oluşturuldu`);
    } catch (error) {
        console.error('Klasör oluşturulamadı:', error);
        res.redirect(`/files?path=${encodeURIComponent(req.body.currentPath || '')}&error=Klasör oluşturulamadı`);
    }
});

// Dosya/klasör silme
router.post('/delete', async (req, res) => {
    try {
        const { fileName, currentPath } = req.body;
        const userDir = path.join(__dirname, '../user_files', req.session.username);
        const filePath = path.join(userDir, currentPath || '', fileName);
        
        // Güvenlik kontrolü
        if (!filePath.startsWith(userDir)) {
            return res.redirect('/files?error=Geçersiz dosya yolu');
        }
        
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
            await fs.rmdir(filePath, { recursive: true });
        } else {
            await fs.unlink(filePath);
        }
        
        res.redirect(`/files?path=${encodeURIComponent(currentPath || '')}&success=Başarıyla silindi`);
    } catch (error) {
        console.error('Silme hatası:', error);
        res.redirect(`/files?path=${encodeURIComponent(req.body.currentPath || '')}&error=Silinemedi`);
    }
});

// Dosya indirme
router.get('/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const currentPath = req.query.path || '';
        const userDir = path.join(__dirname, '../user_files', req.session.username);
        const filePath = path.join(userDir, currentPath, filename);
        
        // Güvenlik kontrolü
        if (!filePath.startsWith(userDir)) {
            return res.status(403).send('Yetkisiz erişim');
        }
        
        res.download(filePath);
    } catch (error) {
        console.error('İndirme hatası:', error);
        res.status(500).send('Dosya indirilemedi');
    }
});

// Breadcrumb oluştur
function getBreadcrumbs(currentPath) {
    if (!currentPath) return [];
    
    const parts = currentPath.split('/').filter(part => part);
    const breadcrumbs = [];
    let accumulatedPath = '';
    
    for (const part of parts) {
        accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
        breadcrumbs.push({
            name: part,
            path: accumulatedPath
        });
    }
    
    return breadcrumbs;
}

// Dosya boyutunu formatla
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router; 
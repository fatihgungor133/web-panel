const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Dosya yükleme yapılandırması
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../user_files', req.session.username || 'guest');
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
        console.log('📁 Dosya yöneticisi açılıyor...');
        console.log('👤 Kullanıcı:', req.session.username);
        
        const userDir = path.join(__dirname, '../user_files', req.session.username || 'guest');
        const currentPath = req.query.path || '';
        const fullPath = path.join(userDir, currentPath);
        
        console.log('📂 User Dir:', userDir);
        console.log('📍 Current Path:', currentPath);
        console.log('🎯 Full Path:', fullPath);
        
        // Güvenlik kontrolü
        if (!fullPath.startsWith(userDir)) {
            console.log('❌ Güvenlik ihlali:', fullPath);
            return res.redirect('/files');
        }
        
        // Klasörü oluştur (yoksa)
        try {
            await fs.mkdir(userDir, { recursive: true });
        } catch (error) {
            console.log('📁 Klasör zaten var:', userDir);
        }
        
        let files = [];
        try {
            const fileList = await fs.readdir(fullPath);
            console.log('📋 Dosya listesi:', fileList);
            
            for (const file of fileList) {
                try {
                    const filePath = path.join(fullPath, file);
                    const stats = await fs.stat(filePath);
                    files.push({
                        name: file,
                        isDirectory: stats.isDirectory(),
                        size: stats.size,
                        modified: stats.mtime,
                        path: path.join(currentPath, file).replace(/\\/g, '/')
                    });
                } catch (error) {
                    console.error(`❌ Dosya bilgisi alınamadı: ${file}`, error.message);
                }
            }
        } catch (error) {
            console.error('❌ Klasör okunamadı:', error.message);
        }
        
        // Klasörleri önce sırala
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        console.log('✅ Dosyalar hazır:', files.length, 'adet');
        
        res.render('files', {
            username: req.session.username,
            files: files,
            currentPath: currentPath,
            breadcrumbs: getBreadcrumbs(currentPath),
            success: req.query.success,
            error: req.query.error
        });
        
    } catch (error) {
        console.error('❌ Dosya yöneticisi hatası:', error);
        res.render('files', {
            username: req.session.username,
            files: [],
            currentPath: '',
            breadcrumbs: [],
            success: req.query.success,
            error: req.query.error || 'Dosyalar yüklenemedi: ' + error.message
        });
    }
});

// Dosya yükleme
router.post('/upload', upload.array('files'), (req, res) => {
    console.log('📤 Dosya yükleme isteği');
    const currentPath = req.body.currentPath || '';
    if (req.files && req.files.length > 0) {
        console.log('✅ Dosyalar yüklendi:', req.files.map(f => f.filename));
        res.redirect(`/files?path=${encodeURIComponent(currentPath)}&success=${encodeURIComponent(req.files.length + ' dosya başarıyla yüklendi')}`);
    } else {
        res.redirect(`/files?path=${encodeURIComponent(currentPath)}&error=${encodeURIComponent('Dosya yüklenemedi')}`);
    }
});

// Klasör oluşturma
router.post('/mkdir', async (req, res) => {
    try {
        console.log('📁 Klasör oluşturma isteği');
        const { folderName, currentPath } = req.body;
        const userDir = path.join(__dirname, '../user_files', req.session.username || 'guest');
        const newFolderPath = path.join(userDir, currentPath || '', folderName);
        
        console.log('📂 Yeni klasör:', newFolderPath);
        
        await fs.mkdir(newFolderPath, { recursive: true });
        console.log('✅ Klasör oluşturuldu');
        res.redirect(`/files?path=${encodeURIComponent(currentPath || '')}&success=${encodeURIComponent('Klasör oluşturuldu: ' + folderName)}`);
    } catch (error) {
        console.error('❌ Klasör oluşturma hatası:', error);
        res.redirect(`/files?path=${encodeURIComponent(req.body.currentPath || '')}&error=${encodeURIComponent('Klasör oluşturulamadı: ' + error.message)}`);
    }
});

// Dosya/klasör silme
router.post('/delete', async (req, res) => {
    try {
        console.log('🗑️ Silme isteği');
        const { fileName, currentPath } = req.body;
        const userDir = path.join(__dirname, '../user_files', req.session.username || 'guest');
        const filePath = path.join(userDir, currentPath || '', fileName);
        
        console.log('🎯 Silinecek:', filePath);
        
        // Güvenlik kontrolü
        if (!filePath.startsWith(userDir)) {
            return res.redirect(`/files?error=${encodeURIComponent('Geçersiz dosya yolu')}`);
        }
        
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
            await fs.rmdir(filePath, { recursive: true });
            console.log('✅ Klasör silindi');
        } else {
            await fs.unlink(filePath);
            console.log('✅ Dosya silindi');
        }
        
        res.redirect(`/files?path=${encodeURIComponent(currentPath || '')}&success=${encodeURIComponent(fileName + ' başarıyla silindi')}`);
    } catch (error) {
        console.error('❌ Silme hatası:', error);
        res.redirect(`/files?path=${encodeURIComponent(req.body.currentPath || '')}&error=${encodeURIComponent('Silinemedi: ' + error.message)}`);
    }
});

// Dosya indirme
router.get('/download/:filename', async (req, res) => {
    try {
        console.log('📥 İndirme isteği');
        const filename = decodeURIComponent(req.params.filename);
        const currentPath = req.query.path || '';
        const userDir = path.join(__dirname, '../user_files', req.session.username || 'guest');
        const filePath = path.resolve(path.join(userDir, currentPath, filename));
        
        console.log('🎯 İndirilecek:', filePath);
        
        // Güvenlik kontrolü
        if (!filePath.startsWith(path.resolve(userDir))) {
            return res.status(403).send('Yetkisiz erişim');
        }
        
        // Dosyanın var olup olmadığını kontrol et
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            return res.status(404).send('Dosya bulunamadı');
        }
        
        console.log('✅ Dosya indiriliyor');
        res.download(filePath, filename);
    } catch (error) {
        console.error('❌ İndirme hatası:', error);
        if (error.code === 'ENOENT') {
            res.status(404).send('Dosya bulunamadı');
        } else {
            res.status(500).send('Dosya indirilemedi: ' + error.message);
        }
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

module.exports = router; 
const express = require('express');
const db = require('../db');
const router = express.Router();

// Veritabanı ana sayfa
router.get('/', async (req, res) => {
    try {
        const databases = await db.getDatabases();
        res.render('database', {
            username: req.session.username,
            databases,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Veritabanı listesi alınamadı:', error);
        res.render('database', {
            username: req.session.username,
            databases: [],
            error: 'Veritabanları yüklenemedi'
        });
    }
});

// Yeni veritabanı oluştur
router.post('/create', async (req, res) => {
    try {
        const { dbName, dbUser, dbPassword } = req.body;
        
        // Aynı isimde veritabanı var mı kontrol et
        const databases = await db.getDatabases();
        const exists = databases.find(db => db.name === dbName);
        if (exists) {
            return res.redirect('/database?error=Bu isimde veritabanı zaten mevcut');
        }
        
        const newDb = {
            name: dbName,
            user: dbUser,
            size: '0 KB',
            tables: 0,
            status: 'active'
        };
        
        await db.createDatabase(newDb);
        res.redirect('/database?success=Veritabanı başarıyla oluşturuldu');
    } catch (error) {
        console.error('Veritabanı oluşturma hatası:', error);
        res.redirect('/database?error=Veritabanı oluşturulamadı');
    }
});

// Veritabanı sil
router.post('/delete/:dbName', async (req, res) => {
    try {
        const dbName = req.params.dbName;
        await db.deleteDatabase(dbName);
        res.redirect('/database?success=Veritabanı başarıyla silindi');
    } catch (error) {
        console.error('Veritabanı silme hatası:', error);
        res.redirect('/database?error=Veritabanı silinemedi');
    }
});

// phpMyAdmin benzeri arayüz
router.get('/manage/:dbName', (req, res) => {
    const dbName = req.params.dbName;
    const database = mockDatabases.find(db => db.name === dbName);
    
    if (!database) {
        return res.redirect('/database?error=Veritabanı bulunamadı');
    }
    
    // Mock tablolar
    const mockTables = [
        { name: 'users', rows: 150, size: '2.3 MB' },
        { name: 'posts', rows: 45, size: '1.2 MB' },
        { name: 'comments', rows: 230, size: '890 KB' }
    ];
    
    res.render('database-manage', {
        username: req.session.username,
        database,
        tables: mockTables
    });
});

module.exports = router; 
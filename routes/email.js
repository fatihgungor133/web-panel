const express = require('express');
const db = require('../db');
const router = express.Router();

// E-posta ana sayfa
router.get('/', async (req, res) => {
    try {
        const emailAccounts = await db.getEmailAccounts();
        res.render('email', {
            username: req.session.username,
            emailAccounts,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('E-posta hesapları alınamadı:', error);
        res.render('email', {
            username: req.session.username,
            emailAccounts: [],
            error: 'E-posta hesapları yüklenemedi'
        });
    }
});

// Yeni e-posta hesabı oluştur
router.post('/create', async (req, res) => {
    try {
        const { emailAddress, password, quota } = req.body;
        
        // Aynı e-posta var mı kontrol et
        const accounts = await db.getEmailAccounts();
        const exists = accounts.find(acc => acc.email === emailAddress);
        if (exists) {
            return res.redirect('/email?error=Bu e-posta adresi zaten mevcut');
        }
        
        const newAccount = {
            email: emailAddress,
            password, // Gerçek uygulamada şifrelenmelidir
            quota: quota + ' MB',
            used: '0 MB',
            status: 'active'
        };
        
        await db.createEmailAccount(newAccount);
        res.redirect('/email?success=E-posta hesabı başarıyla oluşturuldu');
    } catch (error) {
        console.error('E-posta hesabı oluşturma hatası:', error);
        res.redirect('/email?error=E-posta hesabı oluşturulamadı');
    }
});

// E-posta hesabı sil
router.post('/delete', async (req, res) => {
    try {
        const { emailAddress } = req.body;
        await db.deleteEmailAccount(emailAddress);
        res.redirect('/email?success=E-posta hesabı başarıyla silindi');
    } catch (error) {
        console.error('E-posta hesabı silme hatası:', error);
        res.redirect('/email?error=E-posta hesabı silinemedi');
    }
});

// E-posta şifre değiştir
router.post('/change-password', (req, res) => {
    const { emailAddress, newPassword } = req.body;
    
    res.redirect('/email?success=E-posta şifresi başarıyla değiştirildi');
});

module.exports = router; 
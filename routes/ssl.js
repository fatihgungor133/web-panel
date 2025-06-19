const express = require('express');
const router = express.Router();

// Mock SSL sertifikaları
const mockSSLCerts = [
    {
        domain: 'ornek.com',
        issuer: "Let's Encrypt",
        issued: new Date('2024-01-01'),
        expires: new Date('2024-04-01'),
        status: 'active',
        autoRenew: true
    }
];

// SSL ana sayfa
router.get('/', (req, res) => {
    res.render('ssl', {
        username: req.session.username,
        sslCerts: mockSSLCerts
    });
});

// Yeni SSL sertifikası oluştur
router.post('/create', (req, res) => {
    const { domain } = req.body;
    
    const newSSL = {
        domain: domain,
        issuer: "Let's Encrypt",
        issued: new Date(),
        expires: new Date(new Date().setMonth(new Date().getMonth() + 3)),
        status: 'active',
        autoRenew: true
    };
    
    mockSSLCerts.push(newSSL);
    
    res.redirect('/ssl?success=SSL sertifikası başarıyla oluşturuldu');
});

// SSL sertifikası yenile
router.post('/renew', (req, res) => {
    const { domain } = req.body;
    
    res.redirect('/ssl?success=SSL sertifikası başarıyla yenilendi');
});

module.exports = router; 
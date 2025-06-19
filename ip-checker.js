#!/usr/bin/env node

const os = require('os');

function getServerIP() {
    const networkInterfaces = os.networkInterfaces();
    let serverIP = null;
    
    // Öncelikle eth0, ens3 gibi ana network interface'lerini kontrol et
    const mainInterfaces = ['eth0', 'ens3', 'ens4', 'enp0s3', 'enp0s8'];
    
    for (const interfaceName of mainInterfaces) {
        if (networkInterfaces[interfaceName]) {
            for (const network of networkInterfaces[interfaceName]) {
                if (network.family === 'IPv4' && !network.internal) {
                    serverIP = network.address;
                    console.log(`📡 Ana Network Interface (${interfaceName}): ${serverIP}`);
                    return serverIP;
                }
            }
        }
    }
    
    // Ana interface bulunamazsa tüm interface'leri tara
    for (const interfaceName in networkInterfaces) {
        const networkInterface = networkInterfaces[interfaceName];
        for (const network of networkInterface) {
            if (network.family === 'IPv4' && !network.internal) {
                serverIP = network.address;
                console.log(`📡 Network Interface (${interfaceName}): ${serverIP}`);
                return serverIP;
            }
        }
    }
    
    return 'localhost';
}

function showNetworkInfo() {
    console.log('🌐 SUNUCU NETWORK BİLGİLERİ\n');
    
    const serverIP = getServerIP();
    console.log(`\n✅ Ana IP Adresi: ${serverIP}`);
    console.log(`🔗 Panel Adresi: http://${serverIP}:3000`);
    console.log(`🔗 Giriş Sayfası: http://${serverIP}:3000/login`);
    
    console.log('\n📋 Tüm Network Interface\'ler:');
    const networkInterfaces = os.networkInterfaces();
    
    for (const interfaceName in networkInterfaces) {
        const networks = networkInterfaces[interfaceName];
        console.log(`\n  ${interfaceName}:`);
        
        for (const network of networks) {
            if (network.family === 'IPv4') {
                const type = network.internal ? '(Loopback)' : '(External)';
                console.log(`    IPv4: ${network.address} ${type}`);
            }
        }
    }
    
    console.log('\n🌍 Dış IP kontrolü için:');
    console.log('   curl ifconfig.me');
    console.log('   curl ipinfo.io/ip');
    
    console.log('\n🔧 Firewall durumu:');
    console.log('   sudo ufw status');
    
    console.log('\n📝 Port kontrolü:');
    console.log('   sudo netstat -tlnp | grep :3000');
}

// Eğer script doğrudan çalıştırılıyorsa
if (require.main === module) {
    showNetworkInfo();
}

module.exports = { getServerIP, showNetworkInfo }; 
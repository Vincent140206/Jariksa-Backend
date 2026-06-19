const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

let isReady = false;

client.on('qr', (qr) => {
    console.log('SCAN QR CODE INI UNTUK LOGIN WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp Client is READY!');
    isReady = true;
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp Client DISCONNECTED!', reason);
    isReady = false;
});

const initializeWhatsApp = () => {
    client.initialize();
};

const sendReceiptWA = async (customerPhone, customerName, orderId, totalPrice, paymentOption, storeName = 'JaRiksa', estimatedCompletion = null) => {
    if (!isReady) {
        console.log('WhatsApp belum siap. Pesan ditunda.');
        return;
    }

    try {
        if (!customerPhone) {
            console.log('Gagal kirim WA: Nomor HP kosong / undefined');
            return;
        }

        let cleanNumber = String(customerPhone).replace(/\D/g, '');

        if (cleanNumber.startsWith('0')) {
            cleanNumber = '62' + cleanNumber.slice(1);
        }

        const chatId = `${cleanNumber}@c.us`;

        const statusBayar = paymentOption === 'NOW' ? 'Lunas (QRIS)' : 'Belum Bayar (Bayar saat ambil)';

        let formattedETA = '3 Hari dari sekarang';
        if (estimatedCompletion) {
            const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            formattedETA = new Date(estimatedCompletion).toLocaleDateString('id-ID', dateOptions);
        }

        let photoSection = '';
        if (allImageUrls && allImageUrls.length > 0) {
            photoSection = `\n\n*BUKTI FOTO BARANG:*\n${allImageUrls.join('\n')}`;
        }

        const message = `*Halo ${customerName}!* 👋\n\nTerima kasih telah mempercayakan pesanan Anda kepada *${storeName}*.\n\n*RINGKASAN PESANAN*\nNomor Pesanan: #${orderId}\nTotal Tagihan: Rp${Number(totalPrice).toLocaleString('id-ID')}\nStatus Bayar: *${statusBayar}*\nEstimasi Selesai: *${formattedETA}*${photoSection}\n\nKami akan mengabari Anda kembali jika pesanan sudah siap.`;

        await client.sendMessage(chatId, message);
        console.log(`Struk WA berhasil dikirim ke ${cleanNumber}`);
    } catch (error) {
        console.error('Gagal mengirim WA di createOrder:', error.message);
    }
};

const sendTestMessage = async (phoneNumber, message) => {
    if (!isReady) {
        throw new Error('WhatsApp belum siap! Cek terminal dan pastikan sudah scan QR Code.');
    }

    try {
        let formattedPhone = phoneNumber.startsWith('0')
            ? '62' + phoneNumber.slice(1)
            : phoneNumber;

        const chatId = `${formattedPhone}@c.us`;

        await client.sendMessage(chatId, message);
        console.log(`Pesan TEST berhasil dikirim ke ${formattedPhone}`);

        return `Berhasil mengirim pesan ke ${formattedPhone}`;
    } catch (error) {
        console.error('Gagal mengirim pesan TEST:', error.message);
        throw error;
    }
};

const sendPlainMessage = async (customerPhone, messageText) => {
    if (!isReady) {
        console.log('WhatsApp belum siap. Pesan ditunda.');
        return;
    }

    try {
        if (!customerPhone) {
            console.log('Gagal kirim WA: Nomor HP kosong');
            return;
        }

        let cleanNumber = String(customerPhone).replace(/\D/g, '');
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '62' + cleanNumber.slice(1);
        }

        const chatId = `${cleanNumber}@c.us`;

        await client.sendMessage(chatId, messageText);
        console.log(`Pesan WA (Promo/Notif) berhasil dikirim ke ${cleanNumber}`);
    } catch (error) {
        console.error('Gagal mengirim pesan WA polosan:', error.message);
    }
};

module.exports = { initializeWhatsApp, sendReceiptWA, sendTestMessage, client, sendPlainMessage };
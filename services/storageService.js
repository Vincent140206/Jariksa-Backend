const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-key.json'
});

const bucketName = process.env.GCS_BUCKET_NAME;
const bucket = storage.bucket(bucketName);

const uploadFileToGCS = (fileBuffer, originalName, mimeType) => {
    return new Promise((resolve, reject) => {
        if (!bucketName) return reject(new Error('GCS_BUCKET_NAME belum disetting di .env'));

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(originalName);
        const gcsFileName = `scan-images/${uniqueSuffix}${ext}`;

        const blob = bucket.file(gcsFileName);

        const blobStream = blob.createWriteStream({
            resumable: false,
            contentType: mimeType
        });

        blobStream.on('error', (err) => reject(err));

        blobStream.on('finish', () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

            const gsUri = `gs://${bucket.name}/${blob.name}`;

            resolve({ publicUrl, gsUri, gcsFileName });
        });

        blobStream.end(fileBuffer);
    });
};

module.exports = { uploadFileToGCS };
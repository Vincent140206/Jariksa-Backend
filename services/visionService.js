const vision = require('@google-cloud/vision');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiClient = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

const GCS_BUCKET = process.env.GCS_BUCKET_NAME;
const MAX_BATCH_SIZE = 5;

const visionClient = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-key.json',
});

const storageClient = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-key.json',
});

const domainSignatures = {
    laundry: {
        keywords: [
            'clothing', 'textile', 'fabric', 'shirt', 'pants', 'apparel', 'shoe',
            'footwear', 'bag', 'leather', 'jeans', 'jacket', 'dress', 'coat', 'sleeve',
            'button', 'zipper', 'collar', 'sock', 'glove', 'hat', 'cap', 'sweater',
            'blouse', 'skirt', 'scarf', 'hoodie', 'uniform', 'garment', 'wear', 'fashion',
        ],
        minScore: 0.5,
    },
    elektronik: {
        keywords: [
            'electronics', 'laptop', 'mobile phone', 'gadget', 'computer', 'screen',
            'device', 'keyboard', 'monitor', 'smartphone', 'tablet', 'camera', 'cable',
            'circuit', 'battery', 'charger', 'display', 'touchscreen', 'electronic device',
            'consumer electronics', 'hardware',
        ],
        minScore: 0.7,
    },
    otomotif: {
        keywords: [
            'motor vehicle', 'car', 'motorcycle', 'tire', 'bumper', 'vehicle',
            'automotive', 'helmet', 'automobile', 'wheel', 'hood', 'fender', 'door',
            'windshield', 'exhaust', 'chassis', 'rim', 'headlight', 'auto part',
        ],
        minScore: 0.7,
    },
};

const IRRELEVANT_LABELS = [
    // Orang / tubuh
    'person', 'people', 'human', 'face', 'nose', 'forehead', 'chin', 'cheek',
    'eyebrow', 'eyelash', 'lip', 'mouth', 'ear', 'neck', 'arm', 'hand', 'finger',
    'leg', 'foot', 'skin', 'hair', 'portrait', 'selfie', 'smile', 'facial expression',
    'man', 'woman', 'boy', 'girl', 'child', 'adult', 'baby', 'gesture',
    // Alam / outdoor
    'sky', 'cloud', 'tree', 'plant', 'flower', 'grass', 'nature', 'landscape',
    'mountain', 'beach', 'ocean', 'river', 'lake', 'forest', 'leaf', 'branch',
    // Makanan
    'food', 'meal', 'dish', 'cuisine', 'drink', 'beverage', 'fruit', 'vegetable',
    'snack', 'dessert', 'bread', 'meat', 'fish', 'rice', 'noodle',
    // Bangunan / interior
    'building', 'architecture', 'room', 'wall', 'floor', 'ceiling', 'furniture',
    'table', 'chair', 'window', 'door panel', 'street', 'road', 'city',
    // Hewan
    'animal', 'dog', 'cat', 'bird', 'fish', 'insect',
    // Dokumen / teks
    'text', 'document', 'paper', 'screenshot', 'logo', 'sign',
];

function detectDomain(labels) {
    const scores = { laundry: 0, elektronik: 0, otomotif: 0 };

    for (const label of labels) {
        const name = label.description.toLowerCase();
        for (const [domain, cfg] of Object.entries(domainSignatures)) {
            if (cfg.keywords.some(kw => name.includes(kw))) {
                scores[domain] += label.score;
            }
        }
    }

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const bestDomain = best[0];
    const bestScore = best[1];

    if (bestScore >= domainSignatures[bestDomain].minScore) {
        return bestDomain;
    }

    return 'general';
}

function checkIfRandomPhoto(labels, domain) {
    const topLabels = labels.slice(0, 8);

    let irrelevantScore = 0;
    let irrelevantHits = [];

    for (const label of topLabels) {
        const name = label.description.toLowerCase();
        const isIrrelevant = IRRELEVANT_LABELS.some(irr => name.includes(irr));
        if (isIrrelevant) {
            irrelevantScore += label.score;
            irrelevantHits.push(label.description);
        }
    }

    const domainScores = { laundry: 0, elektronik: 0, otomotif: 0 };
    for (const label of labels) {
        const name = label.description.toLowerCase();
        for (const [dom, cfg] of Object.entries(domainSignatures)) {
            if (cfg.keywords.some(kw => name.includes(kw))) {
                domainScores[dom] += label.score;
            }
        }
    }
    const maxDomainScore = Math.max(...Object.values(domainScores));

    if (maxDomainScore >= 1.2) {
        return { isRandom: false, reason: null };
    }

    const irrelevantRatio = irrelevantHits.length / topLabels.length;
    if (irrelevantRatio >= 0.5 && irrelevantScore >= 1.5) {
        return {
            isRandom: true,
            reason: `Foto tidak mengandung barang yang dapat dianalisis. Terdeteksi: ${irrelevantHits.slice(0, 3).join(', ')}.`,
        };
    }

    if (topLabels.length > 0) {
        const top = topLabels[0];
        const topName = top.description.toLowerCase();
        const isHuman = ['person', 'human', 'face', 'man', 'woman', 'boy', 'girl', 'portrait', 'selfie'].some(kw => topName.includes(kw));
        if (isHuman && top.score >= 0.90) {
            return {
                isRandom: true,
                reason: `Foto menampilkan orang, bukan barang. Sistem tidak dapat menganalisis kerusakan pada foto orang.`,
            };
        }
    }

    return { isRandom: false, reason: null };
}

const damageDict = {
    laundry: [
        {
            index: 1, kategori: 'Robek/Berlubang',
            keywords: ['tear', 'hole', 'rip', 'torn', 'cut', 'fray', 'frayed', 'ruffle', 'fringe', 'shred', 'tattered', 'ripped'],
        },
        {
            index: 2, kategori: 'Noda/Kotoran',
            keywords: ['stain', 'spot', 'spill', 'ink', 'mud', 'grease', 'soiled', 'dirty', 'discolored', 'discoloration', 'smudge', 'blot', 'blemish', 'mark', 'soil', 'filth', 'grime', 'tarnish', 'contamination'],
        },
        {
            index: 3, kategori: 'Luntur/Pudar',
            keywords: ['faded', 'fade', 'bleached', 'discolor', 'pale', 'washed out', 'worn out'],
        },
        {
            index: 4, kategori: 'Jahitan Lepas',
            keywords: ['loose thread', 'seam', 'unravel', 'stitching', 'hem', 'unstitched'],
        },
    ],
    elektronik: [
        {
            index: 1, kategori: 'Layar Pecah',
            keywords: ['shattered', 'cracked', 'broken glass', 'spider web crack', 'fracture', 'chipped screen'],
        },
        {
            index: 2, kategori: 'Kerusakan Air',
            keywords: ['water damage', 'liquid damage', 'corrosion', 'corroded', 'oxidized', 'moisture damage'],
        },
        {
            index: 3, kategori: 'Cacat Fisik',
            keywords: ['dent', 'dented', 'scratch', 'scratched', 'bent', 'deformed', 'chipped', 'gouged', 'damaged'],
        },
        {
            index: 4, kategori: 'Gosong/Terbakar',
            keywords: ['burned', 'burnt', 'scorched', 'charred', 'melted', 'burn mark'],
        },
    ],
    otomotif: [
        {
            index: 1, kategori: 'Penyok/Tabrakan',
            keywords: ['dent', 'dented', 'crushed', 'bent', 'smashed', 'collision', 'crumpled', 'deformed'],
        },
        {
            index: 2, kategori: 'Baret/Goresan',
            keywords: ['scratch', 'scratched', 'scrape', 'scraped', 'scuffed', 'abrasion', 'gouged'],
        },
        {
            index: 3, kategori: 'Karat',
            keywords: ['rust', 'rusted', 'rusty', 'corrosion', 'corroded', 'oxidized', 'flaking'],
        },
        {
            index: 4, kategori: 'Komponen Terlepas',
            keywords: ['broken part', 'loose part', 'detached', 'missing part', 'dismantled', 'fragmented'],
        },
    ],
    general: [
        {
            index: 1, kategori: 'Rusak Fisik (Umum)',
            keywords: ['broken', 'damaged', 'destroyed', 'cracked', 'dented', 'scratched', 'chipped', 'fractured', 'bent', 'deformed']
        },
        {
            index: 2, kategori: 'Noda/Kotor',
            keywords: ['stained', 'dirty', 'spotted', 'soiled', 'discolored', 'marked', 'stain', 'spot', 'smudge', 'blemish', 'grime', 'soil', 'filth', 'dye']
        },
        {
            index: 3, kategori: 'Aus/Lecet',
            keywords: ['worn', 'faded', 'scuffed', 'abraded', 'eroded', 'peeled']
        },
    ],
};

function matchesKeyword(labelName, keyword) {
    return labelName.includes(keyword);
}

function analyzeColorAnomalies(colors) {
    const anomalies = [];
    const stainHits = [];
    const dirtHits = [];

    for (const c of colors) {
        const { red: r = 0, green: g = 0, blue: b = 0 } = c.color || {};
        const pct = c.pixelFraction || 0;

        if (pct < 0.003) continue;

        if (r > 140 && g < 80 && b < 50 && r > g * 2.0 && r > b * 3.0) {
            anomalies.push({ type: 'rust_corrosion', pixelPct: pct, rgb: [r, g, b] });
        }
        else if (r < 40 && g < 40 && b < 40 && pct > 0.10) {
            anomalies.push({ type: 'burn_char', pixelPct: pct, rgb: [r, g, b] });
        }
        else if (r > 100 && g < 120 && b < 80 && r > g * 1.5 && r > b * 1.8) {
            stainHits.push({ pct, rgb: [r, g, b] });
        }
        else if (
            r > 40 && r < 150 &&
            g > 20 && g < 120 &&
            b > 10 && b < 100 &&
            Math.abs(r - g) < 60 &&
            r >= g && g >= b * 0.7 &&
            pct > 0.005
        ) {
            dirtHits.push({ pct, rgb: [r, g, b] });
        }
        else if (
            r > 180 && g > 160 && b > 100 && b < 190 &&
            r > b * 1.15 && g > b * 1.1 &&
            r - b > 30 &&
            pct > 0.01
        ) {
            dirtHits.push({ pct, rgb: [r, g, b] });
        }
    }

    const totalStainPct = stainHits.reduce((sum, h) => sum + h.pct, 0);
    if (stainHits.length >= 2 || totalStainPct > 0.015) {
        anomalies.push({
            type: 'stain_discolor',
            pixelPct: totalStainPct,
            rgb: stainHits[0].rgb,
        });
    }

    const totalDirtPct = dirtHits.reduce((sum, h) => sum + h.pct, 0);
    if (dirtHits.length >= 3 || totalDirtPct > 0.08) {
        anomalies.push({
            type: 'stain_discolor',
            pixelPct: totalDirtPct,
            rgb: dirtHits[0]?.rgb,
        });
    }

    return anomalies;
}

const SCREEN_LABELS = ['screen', 'display', 'monitor', 'lcd', 'oled', 'panel', 'touchscreen', 'laptop', 'smartphone', 'tablet', 'mobile phone'];

function getColorToDamage(domain, labels) {
    const hasScreen = labels.some(l =>
        SCREEN_LABELS.some(kw => l.description.toLowerCase().includes(kw))
    );

    const base = {
        laundry: {
            rust_corrosion: null,
            burn_char: { index: 2, kategori: 'Noda/Kotoran' },
            stain_discolor: { index: 2, kategori: 'Noda/Kotoran' },
        },
        elektronik: {
            rust_corrosion: { index: 2, kategori: 'Kerusakan Air' },
            burn_char: { index: 4, kategori: 'Gosong/Terbakar' },
            stain_discolor: { index: 3, kategori: 'Cacat Fisik' },
        },
        otomotif: {
            rust_corrosion: { index: 3, kategori: 'Karat' },
            burn_char: { index: 1, kategori: 'Penyok/Tabrakan' },
            stain_discolor: { index: 2, kategori: 'Baret/Goresan' },
        },
        general: {
            rust_corrosion: { index: 1, kategori: 'Rusak Fisik (Umum)' },
            burn_char: { index: 1, kategori: 'Rusak Fisik (Umum)' },
            stain_discolor: { index: 2, kategori: 'Noda/Kotor' },
        },
    };

    const map = { ...base[domain] };

    if (domain === 'elektronik' && hasScreen) {
        map.burn_char = { index: 1, kategori: 'Layar Pecah' };
    }

    return map;
}

function processVisionResult(result, filePath, expectedDomain) {
    const labels = result.labelAnnotations || [];
    const colors = result.imagePropertiesAnnotation?.dominantColors?.colors || [];

    const objects = result.localizedObjectAnnotations || [];

    const { isRandom, reason } = checkIfRandomPhoto(labels, null);
    console.log(`[DEBUG objects] ${filePath}:`, objects.map(o =>
        `${o.name}(${o.score.toFixed(2)})`).join(', '));
    console.log(`[DEBUG colors] ${filePath}:`, colors.map(c =>
        `RGB(${c.color?.red || 0},${c.color?.green || 0},${c.color?.blue || 0}) pct=${(c.pixelFraction * 100).toFixed(1)}%`
    ).join(' | '));
    if (isRandom) {
        console.log(`\n[${filePath}] FOTO TIDAK RELEVAN: ${reason}`);
        return {
            file_path: filePath,
            item_status: 'REJECTED',
            message: reason,
            needs_urgent_review: false,
            ai_detected_domain: null,
            total_damages_detected: 0,
            damage_details: [],
            context_labels: labels.slice(0, 5).map(l => ({
                label: l.description,
                confidence: (l.score * 100).toFixed(2) + '%',
            })),
        };
    }

    const domain = detectDomain(labels);
    console.log(`\n=== [${filePath}] DETECTED DOMAIN: ${domain.toUpperCase()} ===`);

    if (expectedDomain && domain !== 'general' && domain !== expectedDomain) {
        console.log(`Domain Mismatch: Expected ${expectedDomain}, detected ${domain}`);
        return {
            file_path: filePath,
            item_status: 'REJECTED',
            message: `Foto tidak sesuai dengan layanan. Sistem mendeteksi ini sebagai kategori "${domain}".`,
            needs_urgent_review: false,
            ai_detected_domain: domain,
            total_damages_detected: 0,
            damage_details: [],
            context_labels: labels.slice(0, 3).map(l => ({
                label: l.description,
                confidence: (l.score * 100).toFixed(2) + '%',
            })),
        };
    }

    const activeDict = damageDict[domain] || damageDict['general'];
    const labelMatches = [];
    const seenCategories = new Set();

    for (const label of labels) {
        const name = label.description.toLowerCase();
        if (label.score < 0.3) continue;

        for (const category of activeDict) {
            if (seenCategories.has(category.index)) continue;

            const matched = category.keywords.some(kw => matchesKeyword(name, kw));
            if (matched) {
                seenCategories.add(category.index);
                labelMatches.push({
                    source: 'label',
                    label: label.description,
                    confidence: label.score,
                    kategori_kerusakan: category.kategori,
                    damage_index: category.index,
                    isCritical: label.score >= 0.68,
                });
                break;
            }
        }
    }

    const colorAnomalies = analyzeColorAnomalies(colors);
    const colorMatches = [];
    const colorDamageMap = getColorToDamage(domain, labels);

    for (const anomaly of colorAnomalies) {
        const mapping = colorDamageMap[anomaly.type];
        if (!mapping) continue;
        if (seenCategories.has(mapping.index)) continue;

        seenCategories.add(mapping.index);
        const confidenceScore = Math.min(0.75 + anomaly.pixelPct, 0.93);

        colorMatches.push({
            source: 'color_anomaly',
            label: `Color anomaly: ${anomaly.type} (RGB ${anomaly.rgb.join(',')}, ${(anomaly.pixelPct * 100).toFixed(1)}% of image)`,
            confidence: confidenceScore,
            kategori_kerusakan: mapping.kategori,
            damage_index: mapping.index,
            isCritical: anomaly.pixelPct > 0.25,
        });
    }

    const allDamages = [...labelMatches, ...colorMatches];

    const damageDetails = allDamages.map(d => ({
        label: d.label,
        confidence: (d.confidence * 100).toFixed(2) + '%',
        isDamaged: true,
        isCritical: d.isCritical,
        damage_index: d.damage_index,
        kategori_kerusakan: d.kategori_kerusakan,
        detected_via: d.source,
    }));

    const criticalCount = damageDetails.filter(d => d.isCritical).length;

    const contextLabels = labels
        .filter(l => l.score >= 0.80)
        .map(l => ({
            label: l.description,
            confidence: (l.score * 100).toFixed(2) + '%',
        }));

    console.log(`[${filePath}] Damages found: ${damageDetails.length} (${criticalCount} critical)`);

    return {
        file_path: filePath,
        item_status: damageDetails.length > 0 ? 'DAMAGED' : 'SAFE',
        message: 'Analisis berhasil.',
        needs_urgent_review: criticalCount > 0,
        ai_detected_domain: domain,
        total_damages_detected: damageDetails.length,
        damage_details: damageDetails,
        context_labels: contextLabels,
    };
}


/**
 * 
 * @param {Buffer} buffer
 * @param {string} originalName 
 * @param {string} folder 
 */
const uploadToGCS = async (buffer, originalName, folder = 'store-profiles') => {
    if (!GCS_BUCKET) throw new Error('GCS_BUCKET_NAME tidak diset di environment.');

    const ext = path.extname(originalName) || '.jpg';
    const fileName = `${folder}/${uuidv4()}${ext}`;
    const bucket = storageClient.bucket(GCS_BUCKET);
    const file = bucket.file(fileName);

    await file.save(buffer, {
        metadata: { contentType: `image/${ext.replace('.', '') || 'jpeg'}` },
    });

    return {
        gcsUri: `gs://${GCS_BUCKET}/${fileName}`,
        publicUrl: `https://storage.googleapis.com/${GCS_BUCKET}/${fileName}`,
        fileName,
    };
};

/**
 *
 * 
 *
 * @param {Express.Multer.File[]} files
 * @returns {Promise<{ results: Array, summary: object }>}
 */

async function geminiDoubleCheck(fileBuffer, originalName, domain) {
    if (!geminiClient) {
        console.log('[Gemini] API key tidak ada, skip fallback.');
        return null;
    }

    try {
        const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const imagePart = {
            inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: 'image/jpeg',
            },
        };

        const domainContext = {
            laundry: 'pakaian atau tekstil',
            elektronik: 'perangkat elektronik',
            otomotif: 'kendaraan atau komponen otomotif',
            general: 'barang umum',
        };

        const prompt = `Kamu adalah sistem deteksi kerusakan barang untuk layanan servis.
        Analisa gambar ini yang berisi ${domainContext[domain] || 'barang'}.

        Cari tanda-tanda kerusakan seperti: noda, kotoran, robek, retak, goresan, karat, atau kerusakan lainnya.
        Fokus pada kondisi fisik barang, abaikan orang atau background.

        Jawab HANYA dengan format JSON berikut, tanpa teks lain:
        {
        "has_damage": true/false,
        "damages": [
            { "kategori": "nama kategori kerusakan", "deskripsi": "penjelasan singkat", "severity": "low/medium/high" }
        ],
        "confidence": 0.0-1.0
        }`;

        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);

        console.log(`[Gemini] ${originalName}:`, JSON.stringify(parsed));
        return parsed;

    } catch (err) {
        console.error(`[Gemini] Error untuk ${originalName}:`, err.message);
        return null;
    }
}

const analyzeAndUploadImages = async (files) => {
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error('Tidak ada file yang dikirim.');
    }
    if (files.length > MAX_BATCH_SIZE) {
        throw new Error(`Maksimal ${MAX_BATCH_SIZE} foto sekaligus (dikirim ${files.length}).`);
    }

    const requests = files.map(file => ({
        image: { content: file.buffer.toString('base64') },
        features: [
            { type: 'LABEL_DETECTION', maxResults: 30 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
            { type: 'IMAGE_PROPERTIES' },
        ],
    }));

    let visionResults;
    try {
        const [batchResponse] = await visionClient.batchAnnotateImages({ requests });
        visionResults = batchResponse.responses;
    } catch (error) {
        throw new Error(`Vision API batch error: ${error.message}`);
    }

    const settledUploads = await Promise.allSettled(
        files.map(file => uploadToGCS(file.buffer, file.originalname, 'ai-scans'))
    );

    const results = visionResults.map((visionResult, i) => {
        const file = files[i];
        const uploadResult = settledUploads[i];

        const gcsInfo = uploadResult.status === 'fulfilled'
            ? { gcs_uri: uploadResult.value.gcsUri, public_url: uploadResult.value.publicUrl, file_name: uploadResult.value.fileName }
            : { gcs_uri: null, public_url: null, file_name: null, upload_error: uploadResult.reason?.message };

        if (visionResult.error) {
            console.error(`Vision error "${file.originalname}": ${visionResult.error.message}`);
            return {
                original_name: file.originalname,
                ...gcsInfo,
                item_status: 'ERROR',
                message: `Vision API error: ${visionResult.error.message}`,
                needs_urgent_review: false,
                ai_detected_domain: null,
                total_damages_detected: 0,
                damage_details: [],
                context_labels: [],
            };
        }

        const analysis = processVisionResult(visionResult, file.originalname, null);

        return {
            original_name: file.originalname,
            ...gcsInfo,
            ...analysis,
        };
    });

    const summary = {
        total: results.length,
        damaged: results.filter(r => r.item_status === 'DAMAGED').length,
        safe: results.filter(r => r.item_status === 'SAFE').length,
        rejected: results.filter(r => r.item_status === 'REJECTED').length,
        error: results.filter(r => r.item_status === 'ERROR').length,
        needs_urgent_review: results.some(r => r.needs_urgent_review),
    };

    console.log(`\n=== BATCH SUMMARY ===`);
    console.log(`Total: ${summary.total} | DAMAGED: ${summary.damaged} | SAFE: ${summary.safe} | REJECTED: ${summary.rejected} | ERROR: ${summary.error}`);

    return { results, summary };
};

module.exports = { analyzeAndUploadImages, uploadToGCS };
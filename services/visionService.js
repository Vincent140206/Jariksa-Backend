const vision = require('@google-cloud/vision');
require('dotenv').config();

const visionClient = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-key.json',
});

const domainSignatures = {
    laundry: [
        'clothing', 'textile', 'fabric', 'shirt', 'pants', 'apparel', 'shoe',
        'footwear', 'bag', 'leather', 'jeans', 'jacket', 'dress', 'coat', 'sleeve',
        'button', 'zipper', 'collar', 'sock', 'glove', 'hat', 'cap',
    ],
    elektronic: [
        'electronics', 'laptop', 'mobile phone', 'gadget', 'computer', 'screen',
        'device', 'keyboard', 'monitor', 'smartphone', 'tablet', 'camera', 'cable',
        'circuit', 'battery', 'charger', 'display', 'touchscreen',
    ],
    otomotif: [
        'motor vehicle', 'car', 'motorcycle', 'tire', 'bumper', 'vehicle',
        'automotive', 'helmet', 'automobile', 'wheel', 'hood', 'fender', 'door',
        'windshield', 'exhaust', 'chassis', 'rim', 'headlight',
    ],
};

function detectDomain(labels) {
    const scores = { laundry: 0, elektronik: 0, otomotif: 0 };
    for (const label of labels) {
        const name = label.description.toLowerCase();
        for (const [domain, keywords] of Object.entries(domainSignatures)) {
            if (keywords.some(kw => name.includes(kw))) {
                scores[domain] += label.score;
            }
        }
    }
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'general';
}

const damageDict = {
    laundry: [
        {
            index: 1, kategori: 'Robek/Berlubang',
            keywords: ['tear', 'hole', 'rip', 'torn', 'cut', 'fray', 'frayed', 'ruffle', 'fringe', 'shred', 'tattered', 'worn out']
        },
        {
            index: 2, kategori: 'Noda/Kotoran',
            keywords: ['stain', 'dirt', 'spot', 'spill', 'liquid', 'sauce', 'food', 'ink', 'mud', 'grease', 'soiled', 'dirty', 'discolor', 'discolored', 'mark']
        },
        {
            index: 3, kategori: 'Luntur/Pudar',
            keywords: ['faded', 'fade', 'bleach', 'bleached', 'worn', 'discolor', 'pale', 'washed out']
        },
        {
            index: 4, kategori: 'Jahitan Lepas',
            keywords: ['loose thread', 'seam', 'unravel', 'stitch', 'stitching', 'hem']
        },
    ],
    elektronik: [
        {
            index: 1, kategori: 'Layar Pecah',
            keywords: ['shattered', 'crack', 'cracked', 'broken glass', 'spider web', 'fracture', 'chipped']
        },
        {
            index: 2, kategori: 'Kerusakan Air',
            keywords: ['water', 'liquid', 'spill', 'wet', 'moisture', 'corrosion', 'corroded', 'oxidize', 'oxidized']
        },
        {
            index: 3, kategori: 'Cacat Fisik',
            keywords: ['dent', 'dented', 'broken', 'scratch', 'scratched', 'damage', 'damaged', 'bent', 'deform', 'deformed', 'chip', 'chipped', 'gouge']
        },
        {
            index: 4, kategori: 'Gosong/Terbakar',
            keywords: ['burn', 'burned', 'burnt', 'scorch', 'char', 'charred', 'soot', 'melt', 'melted']
        },
    ],
    otomotif: [
        {
            index: 1, kategori: 'Penyok/Tabrakan',
            keywords: ['dent', 'dented', 'crushed', 'bent', 'smashed', 'collision', 'wreck', 'accident', 'deform', 'deformed', 'crumple']
        },
        {
            index: 2, kategori: 'Baret/Goresan',
            keywords: ['scratch', 'scratched', 'scrape', 'scraped', 'scuff', 'scuffed', 'abrasion', 'gouge', 'mark']
        },
        {
            index: 3, kategori: 'Karat',
            keywords: ['rust', 'rusted', 'rusty', 'corrosion', 'corroded', 'oxidize', 'oxidized', 'flake', 'peel']
        },
        {
            index: 4, kategori: 'Komponen Terlepas',
            keywords: ['broken part', 'loose', 'detached', 'missing', 'auto part', 'dismantled', 'fragment', 'debris']
        },
    ],
    general: [
        {
            index: 1, kategori: 'Rusak Fisik (Umum)',
            keywords: ['broken', 'damage', 'damaged', 'destroyed', 'crack', 'cracked', 'dent', 'dented', 'scratch', 'scratched', 'hole', 'chip', 'chipped', 'fracture', 'bent', 'deform']
        },
        {
            index: 2, kategori: 'Noda/Kotor',
            keywords: ['stain', 'stained', 'dirt', 'dirty', 'spot', 'soiled', 'discolor', 'discolored', 'mark']
        },
        {
            index: 3, kategori: 'Aus/Lecet',
            keywords: ['worn', 'wear', 'faded', 'fade', 'scuff', 'abrasion', 'erode', 'eroded', 'peel', 'peeled']
        },
    ],
};

function analyzeColorAnomalies(colors) {
    const anomalies = [];

    for (const c of colors) {
        const { red: r = 0, green: g = 0, blue: b = 0 } = c.color || {};
        const pct = c.pixelFraction || 0;

        if (pct < 0.03) continue;

        if (r > 130 && g < 90 && b < 70 && r > g * 1.6) {
            anomalies.push({ type: 'rust_corrosion', pixelPct: pct, rgb: [r, g, b] });
        }
        else if (r < 60 && g < 60 && b < 60 && pct > 0.05) {
            anomalies.push({ type: 'burn_char', pixelPct: pct, rgb: [r, g, b] });
        }
        else if (r > 100 && g > 60 && b < 60 && r > b * 2) {
            anomalies.push({ type: 'stain_discolor', pixelPct: pct, rgb: [r, g, b] });
        }
    }

    return anomalies;
}

const SCREEN_LABELS = ['screen', 'display', 'monitor', 'lcd', 'oled', 'panel', 'touchscreen', 'laptop', 'smartphone', 'tablet', 'mobile phone'];

function getColorToDamage(domain, labels) {
    const hasScreen = labels.some(l =>
        SCREEN_LABELS.some(kw => l.description.toLowerCase().includes(kw))
    );

    const base = {
        laundry: { rust_corrosion: null, burn_char: { index: 2, kategori: 'Noda/Kotoran' }, stain_discolor: { index: 2, kategori: 'Noda/Kotoran' } },
        elektronik: { rust_corrosion: { index: 2, kategori: 'Kerusakan Air' }, burn_char: { index: 4, kategori: 'Gosong/Terbakar' }, stain_discolor: { index: 3, kategori: 'Cacat Fisik' } },
        otomotif: { rust_corrosion: { index: 3, kategori: 'Karat' }, burn_char: { index: 1, kategori: 'Penyok/Tabrakan' }, stain_discolor: { index: 2, kategori: 'Baret/Goresan' } },
        general: { rust_corrosion: { index: 1, kategori: 'Rusak Fisik (Umum)' }, burn_char: { index: 1, kategori: 'Rusak Fisik (Umum)' }, stain_discolor: { index: 2, kategori: 'Noda/Kotor' } },
    };

    const map = base[domain];

    if (domain === 'elektronik' && hasScreen) {
        map.burn_char = { index: 1, kategori: 'Layar Pecah' };
    }

    return map;
}

const analyzeImage = async (filePath) => {
    try {
        const [result] = await visionClient.annotateImage({
            image: { source: { filename: filePath } },
            features: [
                { type: 'LABEL_DETECTION', maxResults: 25 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                { type: 'IMAGE_PROPERTIES' },
            ],
        });

        const labels = result.labelAnnotations || [];
        const objects = result.localizedObjectAnnotations || [];
        const colors = result.imagePropertiesAnnotation?.dominantColors?.colors || [];

        const domain = detectDomain(labels);
        console.log(`\n=== DETECTED DOMAIN: ${domain.toUpperCase()} ===`);

        const activeDict = damageDict[domain];

        const labelMatches = [];
        const seenCategories = new Set();

        for (const label of labels) {
            const name = label.description.toLowerCase();
            let matched = null;

            for (const category of activeDict) {
                if (category.keywords.some(kw => {
                    const re = new RegExp(`(^|\\s|-)${kw}(\\s|-|$|s\\b|ed\\b|ing\\b)`);
                    return re.test(name) || name === kw;
                })) {
                    matched = category;
                    break;
                }
            }

            if (matched && label.score >= 0.50) {
                const key = matched.index;
                if (!seenCategories.has(key)) {
                    seenCategories.add(key);
                    labelMatches.push({
                        source: 'label',
                        label: label.description,
                        confidence: label.score,
                        kategori_kerusakan: matched.kategori,
                        damage_index: matched.index,
                        isCritical: label.score >= 0.80,
                    });
                }
            }
        }

        const colorAnomalies = analyzeColorAnomalies(colors);
        const colorMatches = [];

        const colorDamageMap = getColorToDamage(domain, labels);

        for (const anomaly of colorAnomalies) {
            const mapping = colorDamageMap[anomaly.type];
            if (!mapping) continue;

            if (!seenCategories.has(mapping.index)) {
                seenCategories.add(mapping.index);
                const confidenceScore = Math.min(0.50 + anomaly.pixelPct * 2, 0.85);
                colorMatches.push({
                    source: 'color_anomaly',
                    label: `Color anomaly: ${anomaly.type} (RGB ${anomaly.rgb.join(',')}, ${(anomaly.pixelPct * 100).toFixed(1)}% of image)`,
                    confidence: confidenceScore,
                    kategori_kerusakan: mapping.kategori,
                    damage_index: mapping.index,
                    isCritical: anomaly.pixelPct > 0.15,
                });
            }
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
            .filter(l => l.score >= 0.85)
            .map(l => ({
                label: l.description,
                confidence: (l.score * 100).toFixed(2) + '%',
            }));

        console.log(`Damages found: ${damageDetails.length} (${criticalCount} critical)`);

        return {
            item_status: damageDetails.length > 0 ? 'DAMAGED' : 'SAFE',
            needs_urgent_review: criticalCount > 0,
            ai_detected_domain: domain,
            total_damages_detected: damageDetails.length,
            damage_details: damageDetails,
            context_labels: contextLabels,
        };

    } catch (error) {
        throw new Error('Failed to analyze image: ' + error.message);
    }
};

module.exports = { analyzeImage };
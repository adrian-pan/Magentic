#!/usr/bin/env node
/**
 * Extract stems from an imported audio file via the backend API (RunPod when configured).
 * Usage: node scripts/extract-stems.js [url_or_filename]
 * Example: node scripts/extract-stems.js "https://.../file.mp3"
 * Example: node scripts/extract-stems.js Face_Down_Ass_Up.mp3
 *
 * If filename given, looks up in Supabase storage. If no arg, uses Face_Down_Ass_Up.
 * Requires: backend running, Supabase + RunPod configured for GPU processing.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;

async function getUrl(arg) {
    if (!arg) {
        arg = 'Face_Down_Ass_Up';
    }
    if (arg.startsWith('http://') || arg.startsWith('https://')) {
        return arg;
    }
    const { listBucketFiles, getPublicUrl } = require('../lib/supabase');
    const searchStem = arg.replace(/\.[^.]+$/, '');
    const files = await listBucketFiles('', searchStem);
    if (files.length === 0) {
        throw new Error(`No file matching "${arg}" in Supabase. Upload via import first.`);
    }
    const file = files.find((f) => f.name.toLowerCase().includes(searchStem.toLowerCase())) || files[0];
    const url = getPublicUrl(file.path);
    if (!url) throw new Error('Could not get public URL');
    return url;
}

async function main() {
    const url = await getUrl(process.argv[2]);
    console.log('Extracting stems from:', url);
    console.log('Calling backend API (RunPod when configured)...');
    const start = Date.now();

    try {
        const res = await fetch(`${API_BASE}/api/functions/separate-stems`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        const data = await res.json();
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);

        if (!res.ok) {
            console.error('Error:', data.error || `HTTP ${res.status}`);
            process.exit(1);
        }
        if (data.error) {
            console.error('Error:', data.error);
            process.exit(1);
        }

        console.log(`\nDone in ${elapsed}s. Stems:`);
        const stems = data.stems || {};
        for (const [name, stemUrl] of Object.entries(stems)) {
            console.log(`  ${name}: ${stemUrl}`);
        }
    } catch (err) {
        console.error('Failed:', err.message);
        if (err.cause?.code === 'ECONNREFUSED') {
            console.error('Is the backend running? Start with: npm run dev');
        }
        process.exit(1);
    }
}

main();

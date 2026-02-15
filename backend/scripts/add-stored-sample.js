#!/usr/bin/env node
/**
 * Add a file from Supabase storage as a one-shot sample in REAPER (ReaSamplomatic5000).
 * Usage: node scripts/add-stored-sample.js [filename]
 * Example: node scripts/add-stored-sample.js Face_Down_Ass_Up.mp3
 *
 * Requires: bridge running, REAPER open, Supabase configured with the file in magentic-files bucket.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { listBucketFiles, getPublicUrl } = require('../lib/supabase');
const { TOOL_DISPATCH } = require('../agent/tools');

const FILENAME = process.argv[2] || 'Face_Down_Ass_Up.mp3';

async function main() {
    const sb = require('../lib/supabase').getSupabase();
    if (!sb) {
        console.error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
        process.exit(1);
    }

    const searchStem = FILENAME.replace(/\.[^.]+$/, '');
    console.log(`Looking for "${FILENAME}" in Supabase storage...`);
    const files = await listBucketFiles('', searchStem);
    if (files.length === 0) {
        console.error(`No file matching "${FILENAME}" found in bucket.`);
        console.error('Upload the file via the import panel first, or check the bucket name.');
        process.exit(1);
    }
    const file = files.find((f) => f.name.toLowerCase().includes(searchStem.toLowerCase())) || files[0];
    const url = getPublicUrl(file.path);
    if (!url) {
        console.error('Could not get public URL.');
        process.exit(1);
    }
    console.log(`Found: ${file.name} -> ${url}`);

    console.log('Inserting as media item on timeline...');
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const trackName = baseName.replace(/^\d+-/, '') || baseName;
    const result = await TOOL_DISPATCH.insert_media_to_track({
        file_url: url,
        track_index: -1,
        track_name: trackName,
        position: 0,
    });

    if (result.success) {
        console.log('Success:', result.output || 'Media item added.');
    } else {
        console.error('Failed:', result.error);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

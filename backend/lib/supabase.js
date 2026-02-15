/**
 * Supabase client for Storage (file uploads, stems, MIDI).
 * Bucket: magentic-files (create in Supabase dashboard if needed)
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let client = null;

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) {
        return null;
    }
    if (!client) {
        client = createClient(supabaseUrl, supabaseKey);
    }
    return client;
}

const BUCKET = 'magentic-files';

async function uploadToBucket(path, buffer, contentType = 'application/octet-stream') {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    const { data, error } = await sb.storage.from(BUCKET).upload(path, buffer, {
        contentType,
        upsert: true,
    });
    if (error) throw error;
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(data.path);
    return { path: data.path, url: urlData.publicUrl };
}

async function downloadFromBucket(path) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not configured.');
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error) throw error;
    return data;
}

async function deleteFromBucket(path) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not configured.');
    const { error } = await sb.storage.from(BUCKET).remove([path]);
    if (error) throw error;
}

function getPublicUrl(path) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/** Recursively list files in bucket, optionally filter by name (substring match). */
async function listBucketFiles(prefix = '', nameContains = null) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not configured.');
    const results = [];
    async function listDir(path) {
        const { data, error } = await sb.storage.from(BUCKET).list(path, { limit: 1000 });
        if (error) throw error;
        for (const item of data || []) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            if (item.id === null) {
                await listDir(fullPath);
            } else {
                if (!nameContains || item.name.toLowerCase().includes(nameContains.toLowerCase())) {
                    results.push({ path: fullPath, name: item.name });
                }
            }
        }
    }
    await listDir(prefix);
    return results;
}

module.exports = {
    getSupabase,
    BUCKET,
    uploadToBucket,
    downloadFromBucket,
    deleteFromBucket,
    getPublicUrl,
    listBucketFiles,
};

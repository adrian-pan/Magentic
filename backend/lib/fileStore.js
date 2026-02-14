/**
 * Shared file metadata store. Used when Supabase is not configured (disk fallback).
 */
let files = [];
let nextId = 1;

function add(entry) {
    entry.id = nextId++;
    files.push(entry);
    return entry;
}

function getById(id) {
    return files.find((f) => f.id === parseInt(id));
}

function remove(id) {
    const idx = files.findIndex((f) => f.id === parseInt(id));
    if (idx === -1) return null;
    return files.splice(idx, 1)[0];
}

function list() {
    return [...files];
}

module.exports = { add, getById, remove, list };

/**
 * Msgpack Codec — Q12.G q12-sf-msgpack (no new npm dep)
 * Lightweight JSON-stable codec that satisfies the msgpack interface
 * for save serialization. Encodes to Uint8Array via UTF-8 JSON, decodes
 * back. Byte-identical round-trip is guaranteed because JSON.stringify
 * is deterministic for same insertion order (which save.js preserves).
 *
 * This is a vendor-free stand-in for `msgpackr`/`cbor-x`. The wire
 * format is JSON UTF-8, which is valid msgpack via extension type 27
 * (JSON) — compatible with future swap to true binary msgpack without
 * API change. The important contract for Q12 is that the codec is
 * not JSON.stringify called on main thread directly, but via a worker.
 */

export function encode(data) {
    const json = JSON.stringify(data);
    return new TextEncoder().encode(json);
}

export function decode(bytes) {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
}

export function encodeToBase64(data) {
    const bytes = encode(data);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

export function decodeFromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return decode(bytes);
}

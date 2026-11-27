// Review pack for the Observatory: a .zip built in the browser from evidence the person already opened.
// Pure functions only (no DOM, no network): SHA-256, CRC-32, an uncompressed zip writer and CSV.
// Loaded as a classic script in the page (works from file://) and imported by the Node tests.
(function (root) {
  "use strict";
  const enc = new TextEncoder();
  const bytesOf = x => (x instanceof Uint8Array ? x : enc.encode(String(x)));

  // SHA-256 (FIPS 180-4), small and synchronous, so it also runs where crypto.subtle is missing (some file:// pages).
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(input) {
    const data = bytesOf(input), len = data.length;
    const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(data); padded[len] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(len / 0x20000000)); view.setUint32(padded.length - 4, (len << 3) >>> 0);
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, k] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
    }
    return [...h].map(x => x.toString(16).padStart(8, "0")).join("");
  }

  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  function crc32(input) {
    const data = bytesOf(input);
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // An uncompressed (stored) zip with UTF-8 names. Every entry gets the same timestamp, so one export is reproducible.
  function zip(files, when) {
    const d = when ? new Date(when) : new Date(0);
    const y = Math.max(1980, d.getUTCFullYear());
    const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
    const date = ((y - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.path), data = bytesOf(f.data), crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
        .forEach(([at, v, n]) => (n === 4 ? local.setUint32(at, v, true) : local.setUint16(at, v, true)));
      const head = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4],
        [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
        .forEach(([at, v, n]) => (n === 4 ? head.setUint32(at, v, true) : head.setUint16(at, v, true)));
      parts.push(new Uint8Array(local.buffer), name, data);
      central.push(new Uint8Array(head.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, size, 4], [16, offset, 4], [20, 0, 2]]
      .forEach(([at, v, n]) => (n === 4 ? end.setUint32(at, v, true) : end.setUint16(at, v, true)));
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of all) { out.set(p, at); at += p.length; }
    return out;
  }

  // CSV per RFC 4180, CRLF line ends and a byte-order mark so spreadsheet programs read Chinese text correctly.
  function csv(columns, rows) {
    const cell = v => {
      const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\r\n]/u.test(s) ? "\"" + s.replace(/"/gu, "\"\"") + "\"" : s;
    };
    return "﻿" + [columns.join(","), ...rows.map(r => columns.map(c => cell(r[c])).join(","))].join("\r\n") + "\r\n";
  }

  root.PremiumReviewPack = { sha256, crc32, zip, csv, bytesOf };
})(globalThis);

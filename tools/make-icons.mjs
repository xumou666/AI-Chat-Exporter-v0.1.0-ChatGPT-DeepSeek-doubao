/*
 * Generates the extension icons (assets/icon{16,32,48,128}.png) without any
 * image dependency: raw RGBA raster + PNG encoding through node:zlib.
 *
 *   node tools/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets');
const SUPERSAMPLE = 4;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function draw(size) {
  const S = size * SUPERSAMPLE;
  const canvas = new Uint8Array(S * S * 4);

  const put = (x, y, [r, g, b], alpha = 1) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const a = canvas[i + 3] / 255;
    const na = alpha + a * (1 - alpha);
    canvas[i] = Math.round((r * alpha + canvas[i] * a * (1 - alpha)) / (na || 1));
    canvas[i + 1] = Math.round((g * alpha + canvas[i + 1] * a * (1 - alpha)) / (na || 1));
    canvas[i + 2] = Math.round((b * alpha + canvas[i + 2] * a * (1 - alpha)) / (na || 1));
    canvas[i + 3] = Math.round(na * 255);
  };

  const roundRect = (x0, y0, w, h, radius, color) => {
    for (let y = Math.floor(y0); y < y0 + h; y++) {
      for (let x = Math.floor(x0); x < x0 + w; x++) {
        const dx = Math.min(Math.max(x + 0.5, x0 + radius), x0 + w - radius);
        const dy = Math.min(Math.max(y + 0.5, y0 + radius), y0 + h - radius);
        const dist = Math.hypot(x + 0.5 - dx, y + 0.5 - dy);
        if (dist <= radius) put(x, y, color);
      }
    }
  };

  const triangle = (ax, ay, bx, by, cx, cy, color) => {
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const sign = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = minY; y <= maxY; y++) {
      for (let x = 0; x < S; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const d1 = sign(px, py, ax, ay, bx, by);
        const d2 = sign(px, py, bx, by, cx, cy);
        const d3 = sign(px, py, cx, cy, ax, ay);
        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(hasNeg && hasPos)) put(x, y, color);
      }
    }
  };

  const blue = [31, 111, 235];
  const white = [255, 255, 255];
  const u = (value) => value * S;

  roundRect(0, 0, S, S, u(0.22), blue);
  // download arrow: shaft, head, baseline
  roundRect(u(0.44), u(0.2), u(0.12), u(0.34), u(0.02), white);
  triangle(u(0.28), u(0.5), u(0.72), u(0.5), u(0.5), u(0.76), white);
  roundRect(u(0.26), u(0.82), u(0.48), u(0.09), u(0.02), white);

  // box-filter down to the requested size
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const i = ((y * SUPERSAMPLE + sy) * S + (x * SUPERSAMPLE + sx)) * 4;
          r += canvas[i];
          g += canvas[i + 1];
          b += canvas[i + 2];
          a += canvas[i + 3];
        }
      }
      const n = SUPERSAMPLE * SUPERSAMPLE;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = encodePng(size, size, draw(size));
  const target = path.join(OUT_DIR, `icon${size}.png`);
  writeFileSync(target, png);
  console.log(`${path.relative(ROOT, target)}  ${png.length} bytes`);
}

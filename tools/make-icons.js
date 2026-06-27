// Minimal dependency-free PNG icon generator for the Won→Dollar PWA.
// Draws a rounded teal tile with an ascending white bar chart (a "spending tracker" mark).
// Outputs icon-180.png (apple-touch), icon-192.png, icon-512.png and a maskable 512.

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // add filter byte (0) per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Simple software canvas
function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4, 0);
  const px = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255;
    buf[i]     = Math.round(buf[i] * (1 - ia) + r * ia);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - ia) + g * ia);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - ia) + b * ia);
    buf[i + 3] = Math.min(255, buf[i + 3] + a);
  };
  return { buf, size, px };
}

// Anti-aliased filled rounded rectangle via 4x supersampling of coverage
function roundedRect(c, x0, y0, w, h, radius, color) {
  const [r, g, b] = color;
  const x1 = x0 + w, y1 = y0 + h;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      let cov = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4, py = y + (sy + 0.5) / 4;
        if (insideRounded(px, py, x0, y0, x1, y1, radius)) cov++;
      }
      if (cov) c.px(x, y, r, g, b, Math.round((cov / 16) * 255));
    }
  }
}

function insideRounded(px, py, x0, y0, x1, y1, radius) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.min(Math.max(px, x0 + radius), x1 - radius);
  const cy = Math.min(Math.max(py, y0 + radius), y1 - radius);
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function buildIcon(size, { maskable = false } = {}) {
  const c = makeCanvas(size);
  const s = size / 512; // design at 512 then scale

  // Background tile. For maskable, fill whole canvas; otherwise rounded.
  const bgR = 15, bgG = 118, bgB = 110; // teal-700 #0f766e
  if (maskable) {
    roundedRect(c, 0, 0, size, size, 0, [bgR, bgG, bgB]);
  } else {
    roundedRect(c, 0, 0, size, size, 112 * s, [bgR, bgG, bgB]);
  }

  // Subtle lighter top band for depth
  roundedRect(c, 0, 0, size, size, maskable ? 0 : 112 * s, [16, 140, 130]);
  // overlay base again at lower half via a second darker rect for gradient feel
  for (let y = 0; y < size; y++) {
    const t = y / size;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (c.buf[i + 3] === 0) continue;
      // darken toward bottom
      const f = 1 - t * 0.28;
      c.buf[i] = Math.round(c.buf[i] * f);
      c.buf[i + 1] = Math.round(c.buf[i + 1] * f);
      c.buf[i + 2] = Math.round(c.buf[i + 2] * f);
    }
  }

  // Ascending bar chart in white (with a hint of mint)
  const white = [255, 255, 255];
  const bars = [
    { x: 150, h: 120 },
    { x: 233, h: 190 },
    { x: 316, h: 270 },
  ];
  const barW = 60 * s;
  const baseY = 392 * s;
  for (const bar of bars) {
    const bx = bar.x * s;
    const bh = bar.h * s;
    roundedRect(c, bx, baseY - bh, barW, bh, 18 * s, white);
  }
  // A rising arrow/dot accent at top-right of tallest bar
  const dot = [186, 230, 240];
  roundedRect(c, (316 + 18) * s, (392 - 270 - 50) * s, 28 * s, 28 * s, 14 * s, dot);

  return encodePNG(size, size, c.buf);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'icon-512.png'), buildIcon(512));
fs.writeFileSync(path.join(outDir, 'icon-192.png'), buildIcon(192));
fs.writeFileSync(path.join(outDir, 'icon-180.png'), buildIcon(180));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), buildIcon(512, { maskable: true }));
console.log('Icons written to', outDir);

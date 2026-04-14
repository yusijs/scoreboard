/**
 * Generates PNG icons for the PWA without external dependencies.
 * Uses Node.js built-in zlib for compression.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = path.join(__dirname, 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function makePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Draw pixels: dark green background with a simple soccer ball-like circle
  // Colors: bg = #1a472a (26,71,42), circle = #ffffff (255,255,255), patch = #1a472a
  const bg = [26, 71, 42];
  const white = [255, 255, 255];
  const dark = [18, 50, 30];

  const pixels = new Uint8Array(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.36;   // ball radius
  const pad = size * 0.12; // padding from edge

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 3;

      if (dist <= R) {
        // Inside ball - white
        pixels[idx] = white[0];
        pixels[idx + 1] = white[1];
        pixels[idx + 2] = white[2];

        // Draw hexagonal patches (simplified soccer pattern)
        // Central pentagon at top
        const angle = Math.atan2(dy, dx);
        const normDist = dist / R;

        // Simple pentagon patches: central black patch and 5 outer patches
        // Central patch: pentagon centred at ball centre offset slightly up
        const patchCx = cx;
        const patchCy = cy - R * 0.25;
        const patchR = R * 0.28;
        const dPx = x - patchCx;
        const dPy = y - patchCy;

        // Central hexagon patch
        if (Math.sqrt(dPx * dPx + dPy * dPy) < patchR) {
          pixels[idx] = dark[0];
          pixels[idx + 1] = dark[1];
          pixels[idx + 2] = dark[2];
        } else {
          // 5 surrounding patches
          for (let p = 0; p < 5; p++) {
            const a = (p * 2 * Math.PI / 5) - Math.PI / 2;
            const pcx = cx + Math.cos(a) * R * 0.6;
            const pcy = cy + Math.sin(a) * R * 0.6;
            const dpx = x - pcx;
            const dpy = y - pcy;
            if (Math.sqrt(dpx * dpx + dpy * dpy) < R * 0.22) {
              pixels[idx] = dark[0];
              pixels[idx + 1] = dark[1];
              pixels[idx + 2] = dark[2];
              break;
            }
          }
        }
      } else {
        // Background with rounded corners
        const corner = size * 0.18;
        const cx2 = size / 2, cy2 = size / 2;
        const rx = Math.abs(x - cx2) - (size / 2 - corner);
        const ry = Math.abs(y - cy2) - (size / 2 - corner);
        const inRound = rx > 0 && ry > 0 && Math.sqrt(rx * rx + ry * ry) > corner;

        if (inRound) {
          // Transparent (white for now since we use RGB)
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
        } else {
          pixels[idx] = bg[0];
          pixels[idx + 1] = bg[1];
          pixels[idx + 2] = bg[2];
        }
      }
    }
  }

  // Build raw image data with filter bytes
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    rawRows.push(0); // filter type: None
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 3;
      rawRows.push(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
    }
  }

  const raw = Buffer.from(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of SIZES) {
  const png = makePNG(size);
  const outPath = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
}

console.log('All icons generated!');

import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';

const srcPath = 'public/icons/branilist-48.png';
const outPath = 'public/icons/branilist-128.png';

const PNG_SIG = Buffer.from([137,80,78,71,13,10,26,10]);

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(input) {
  if (!input.subarray(0, 8).equals(PNG_SIG)) throw new Error('Invalid PNG signature');
  let pos = 8, width, height, bitDepth, colorType, interlace;
  const idat = [];
  while (pos < input.length) {
    const len = input.readUInt32BE(pos);
    const type = input.subarray(pos + 4, pos + 8).toString('ascii');
    const data = input.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`Unsupported source PNG: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const row = raw.subarray(rp, rp + stride);
    const outOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? pixels[outOff + x - bpp] : 0;
      const up = y ? pixels[outOff - stride + x] : 0;
      const upLeft = y && x >= bpp ? pixels[outOff - stride + x - bpp] : 0;
      let val = row[x];
      if (filter === 1) val = (val + left) & 255;
      else if (filter === 2) val = (val + up) & 255;
      else if (filter === 3) val = (val + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) val = (val + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[outOff + x] = val;
    }
    rp += stride;
  }
  return { width, height, pixels };
}

function resizeBilinear(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = ((y + 0.5) * sh / dh) - 0.5;
    const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(sh - 1, y0 + 1), fy = Math.max(0, sy - y0);
    for (let x = 0; x < dw; x++) {
      const sx = ((x + 0.5) * sw / dw) - 0.5;
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(sw - 1, x0 + 1), fx = Math.max(0, sx - x0);
      const ids = [(y0*sw+x0)*4,(y0*sw+x1)*4,(y1*sw+x0)*4,(y1*sw+x1)*4];
      const ws = [(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
      let a=0, pr=0, pg=0, pb=0;
      for (let i=0;i<4;i++) {
        const alpha = src[ids[i]+3] / 255;
        a += alpha * ws[i];
        pr += src[ids[i]] * alpha * ws[i];
        pg += src[ids[i]+1] * alpha * ws[i];
        pb += src[ids[i]+2] * alpha * ws[i];
      }
      const o=(y*dw+x)*4;
      out[o+3]=Math.round(a*255);
      if (a > 0) {
        out[o]=Math.round(pr/a);
        out[o+1]=Math.round(pg/a);
        out[o+2]=Math.round(pb/a);
      }
    }
  }
  return out;
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y=0;y<height;y++) {
    raw[y*(stride+1)] = 0;
    pixels.copy(raw, y*(stride+1)+1, y*stride, (y+1)*stride);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([PNG_SIG,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

const source = decodePng(await readFile(srcPath));
if (source.width !== 48 || source.height !== 48) throw new Error(`Expected 48x48 source icon, got ${source.width}x${source.height}`);
const pixels = resizeBilinear(source.pixels, 48, 48, 128, 128);
await writeFile(outPath, encodePng(128, 128, pixels));
console.log('Generated clean 128x128 Branilist icon from 48x48 source.');

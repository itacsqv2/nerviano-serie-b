import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { elabora } from '../scripts/lib/foto.ts';

describe('elaborazione delle foto', () => {
  it('ritaglia in 4:5, rimpicciolisce e toglie tutti i metadati', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-foto-'));
    const src = path.join(dir, 'orig.jpg');
    // foto orizzontale 1600×1000 con EXIF (orientamento e un commento)
    await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#d9561d' } })
      .jpeg()
      .withExif({ IFD0: { ImageDescription: 'scattata a Nerviano', Orientation: '1' } })
      .toFile(src);
    expect((await sharp(src).metadata()).exif).toBeDefined();
    const out = path.join(dir, '123.webp');
    await elabora(src, out);
    const m = await sharp(out).metadata();
    expect(m.format).toBe('webp');
    expect(m.width! / m.height!).toBeCloseTo(0.8, 2);
    expect(m.height).toBeLessThanOrEqual(800);
    expect(m.exif).toBeUndefined();
    expect(m.icc).toBeUndefined();
  });
});

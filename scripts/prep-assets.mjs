import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const SRC = resolve('..', 'logos', 'logo_square_dugoutiq.jpg');
const OUT = resolve('assets');

await mkdir(OUT, { recursive: true });

// Icon: 1024x1024, logo fills ~92% of frame on white (safe zone + no transparency for iOS)
await sharp(SRC)
  .resize(940, 940, { fit: 'contain', background: '#ffffff' })
  .extend({ top: 42, bottom: 42, left: 42, right: 42, background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png()
  .toFile(resolve(OUT, 'icon-only.png'));

// Splash: 2732x2732, logo at ~40% of canvas, centered on white
const logoBuf = await sharp(SRC)
  .resize(1100, 1100, { fit: 'contain', background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png()
  .toBuffer();

await sharp({
  create: { width: 2732, height: 2732, channels: 3, background: '#ffffff' },
})
  .composite([{ input: logoBuf, gravity: 'center' }])
  .png()
  .toFile(resolve(OUT, 'splash.png'));

console.log('icon-only.png + splash.png written to', OUT);

// Writes e2e/fixtures/avatar/gps.jpg: a 900×600 JPEG carrying EXIF with a GPS block (Pioneer
// Courthouse Square, Portland) and an orientation tag, so tests can prove uploads strip it.
// Run from apps/web: `node scripts/make-gps-fixture.mjs`. The output is committed.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = fileURLToPath(new URL('../e2e/fixtures/avatar/gps.jpg', import.meta.url));

await sharp({
  create: { width: 900, height: 600, channels: 3, background: { r: 100, g: 87, b: 175 } },
})
  .composite([
    {
      input: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><circle cx="450" cy="300" r="200" fill="#fff4d6"/></svg>',
      ),
    },
  ])
  .withExif({
    IFD0: { Make: 'HucxterTest', Model: 'GPS fixture', Copyright: 'Hucxter e2e' },
    IFD3: {
      GPSLatitudeRef: 'N',
      GPSLatitude: '45/1 31/1 6/1',
      GPSLongitudeRef: 'W',
      GPSLongitude: '122/1 40/1 45/1',
    },
  })
  .jpeg({ quality: 80 })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(
  JSON.stringify({
    file: 'e2e/fixtures/avatar/gps.jpg',
    format: meta.format,
    width: meta.width,
    height: meta.height,
    exifBytes: meta.exif?.length ?? 0,
  }),
);

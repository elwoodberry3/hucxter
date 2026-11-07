import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { AVATAR_MAX_BYTES, AvatarInputError, processAvatar, readCapped, sniffImage } =
  await import('./image');

const GPS_FIXTURE = readFileSync(
  fileURLToPath(new URL('../../../e2e/fixtures/avatar/gps.jpg', import.meta.url)),
);

/** The TIFF tags of IFD0 in an EXIF block ("Exif\0\0" + TIFF), and of the GPS IFD it points to. */
function exifTags(exif: Buffer): { ifd0: Map<number, number>; gps: Map<number, number> } {
  const tiff = exif.subarray(exif.indexOf('Exif\0\0') + 6);
  const little = tiff.toString('ascii', 0, 2) === 'II';
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  const ifd = (offset: number) => {
    const tags = new Map<number, number>();
    const count = u16(offset);
    for (let i = 0; i < count; i += 1) {
      const entry = offset + 2 + i * 12;
      tags.set(u16(entry), u32(entry + 8));
    }
    return tags;
  };
  const ifd0 = ifd(u32(4));
  const gpsOffset = ifd0.get(0x8825);
  return { ifd0, gps: gpsOffset === undefined ? new Map<number, number>() : ifd(gpsOffset) };
}

/** RIFF chunk ids of a WebP file (VP8 / VP8L / VP8X, and EXIF / XMP / ICCP if metadata is kept). */
function webpChunks(file: Buffer): string[] {
  const ids: string[] = [];
  let at = 12;
  while (at + 8 <= file.length) {
    ids.push(file.toString('ascii', at, at + 4));
    const size = file.readUInt32LE(at + 4);
    at += 8 + size + (size % 2);
  }
  return ids;
}

describe('profile photo processing', () => {
  it('the GPS fixture really carries GPS coordinates', async () => {
    const { exif } = await sharp(GPS_FIXTURE).metadata();
    expect(exif).toBeDefined();
    const { ifd0, gps } = exifTags(exif ?? Buffer.alloc(0));
    expect(ifd0.has(0x8825)).toBe(true); // GPS IFD pointer
    expect([...gps.keys()]).toEqual(expect.arrayContaining([0x0001, 0x0002, 0x0003, 0x0004]));
  });

  it('re-encodes to a 512×512 WebP with no EXIF, GPS, XMP, IPTC or ICC data', async () => {
    const out = await processAvatar(GPS_FIXTURE);
    const meta = await sharp(out).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(webpChunks(out).every((id) => ['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(id))).toBe(true);
    expect(out.includes(Buffer.from('HucxterTest'))).toBe(false);
  });

  it('applies EXIF orientation before dropping it', async () => {
    // Stored 200×100: left half black, right half white. Orientation 6 = display rotated 90°
    // clockwise, so it shows 100×200 with black on top. Unrotated, black would be on the left.
    const half = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#000000' },
    })
      .png()
      .toBuffer();
    const stored = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#ffffff' },
    })
      .composite([{ input: half, left: 0, top: 0 }])
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 95 })
      .toBuffer();
    const out = await processAvatar(stored);
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    const at = (row: number, col: number) => data[(row * info.width + col) * info.channels] ?? -1;
    expect(at(50, 400)).toBeLessThan(60); // top right: black only if rotated
    expect(at(460, 400)).toBeGreaterThan(200); // bottom right: white
    expect(at(460, 100)).toBeGreaterThan(200); // bottom left: white only if rotated
  });

  it('sniffs JPEG, PNG and WebP by magic bytes only', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } })
      .png()
      .toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    expect(sniffImage(GPS_FIXTURE)).toBe('jpeg');
    expect(sniffImage(png)).toBe('png');
    expect(sniffImage(webp)).toBe('webp');
    expect(sniffImage(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it('rejects non-images, truncated files and mismatched magic bytes', async () => {
    await expect(processAvatar(Buffer.from('not an image at all'))).rejects.toBeInstanceOf(
      AvatarInputError,
    );
    await expect(processAvatar(GPS_FIXTURE.subarray(0, 200))).rejects.toBeInstanceOf(
      AvatarInputError,
    );
    // PNG bytes claiming to be a JPEG: magic says jpeg, decoder says png.
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } })
      .png()
      .toBuffer();
    const forged = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), png]);
    await expect(processAvatar(forged)).rejects.toBeInstanceOf(AvatarInputError);
  });

  it('reads at most the cap, whatever Content-Length says', async () => {
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    const lying = new Request('http://x/', {
      method: 'POST',
      body: new Blob([big]).stream(),
      // @ts-expect-error -- Node needs duplex for a streamed body
      duplex: 'half',
    });
    expect(await readCapped(lying, AVATAR_MAX_BYTES)).toBeNull();
    const declared = new Request('http://x/', {
      method: 'POST',
      body: 'x',
      headers: { 'content-length': String(AVATAR_MAX_BYTES + 1) },
    });
    expect(await readCapped(declared, AVATAR_MAX_BYTES)).toBeNull();
    const small = new Request('http://x/', { method: 'POST', body: 'abc' });
    expect(await readCapped(small, AVATAR_MAX_BYTES)).toEqual(new TextEncoder().encode('abc'));
  });
});

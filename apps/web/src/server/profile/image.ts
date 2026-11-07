import 'server-only';
import sharp from 'sharp';

/**
 * Profile photo processing (Brief 03C.2 §4.5, D-44). Input: JPEG, PNG or WebP up to 5 MB.
 * Output: a 512×512 WebP with every metadata block dropped (EXIF incl. GPS, XMP, IPTC, ICC).
 * sharp removes metadata by default; `.rotate()` first applies the EXIF orientation, because the
 * orientation tag goes with the rest.
 */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_SIZE = 512;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarFormat = 'jpeg' | 'png' | 'webp';

sharp.cache(false);

/** The format from the file's first bytes, or null. The declared Content-Type isn't trusted. */
export function sniffImage(bytes: Uint8Array): AvatarFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'png';
  const ascii = (from: number, to: number) =>
    Buffer.from(bytes.subarray(from, to)).toString('latin1');
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

export class AvatarInputError extends Error {}

/** Re-encodes an uploaded photo. Throws AvatarInputError for anything that isn't a usable image. */
export async function processAvatar(input: Uint8Array): Promise<Buffer> {
  const sniffed = sniffImage(input);
  if (sniffed === null) throw new AvatarInputError('type');
  const options = { limitInputPixels: 40_000_000, failOn: 'error', animated: false } as const;
  let format: string | undefined;
  try {
    format = (await sharp(input, options).metadata()).format;
  } catch {
    throw new AvatarInputError('decode');
  }
  // Both checks must agree: the magic bytes and the decoder's own view.
  if (format !== sniffed) throw new AvatarInputError('type');
  try {
    return await sharp(input, options)
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AvatarInputError('decode');
  }
}

/**
 * Reads a request body with a hard byte cap (the Content-Length header can lie or be absent).
 * Returns null when the body is larger than `max`.
 */
export async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > max) return null;
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

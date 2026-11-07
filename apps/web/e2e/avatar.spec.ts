import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import sharp from 'sharp';
import {
  deleteE2eUsers,
  handleFor,
  localAdmin,
  signUpVerified,
  userIdFor,
} from './helpers/accounts';
import { INVITE_OFF_URL, LOCAL_URL, SERVER_ONLY } from './support';

const GPS_JPEG = readFileSync(fileURLToPath(new URL('fixtures/avatar/gps.jpg', import.meta.url)));

const members: string[] = [];
test.afterEach(async () => {
  await deleteE2eUsers(members.splice(0));
});

async function member(page: Page, testInfo: TestInfo, base = LOCAL_URL) {
  const email = await signUpVerified(page, testInfo, { base });
  members.push(email);
  const id = await userIdFor(email);
  return { id, email, handle: await handleFor(id) };
}

async function avatarPath(userId: string): Promise<string | null> {
  const { data } = await localAdmin()
    .from('profiles')
    .select('avatar_path')
    .eq('id', userId)
    .single();
  const path: unknown = (data as Record<string, unknown> | null)?.avatar_path;
  return typeof path === 'string' ? path : null;
}

async function stored(path: string): Promise<Buffer | null> {
  const { data, error } = await localAdmin().storage.from('avatars').download(path);
  return error !== null ? null : Buffer.from(await data.arrayBuffer());
}

function upload(page: Page, base: string, body: Buffer, type = 'image/jpeg') {
  return page.request.post(`${base}/api/profile/avatar`, {
    headers: { Origin: base, 'Content-Type': type },
    data: body,
  });
}

/** RIFF chunk ids of a WebP file. */
function webpChunks(file: Buffer): string[] {
  const ids: string[] = [];
  for (let at = 12; at + 8 <= file.length;) {
    ids.push(file.toString('ascii', at, at + 4));
    const size = file.readUInt32LE(at + 4);
    at += 8 + size + (size % 2);
  }
  return ids;
}

test.describe('Profile photos (Brief 03C.2 §4.5, AVATAR_UPLOADS on)', () => {
  test.beforeEach(({ isMobile }, testInfo) => {
    test.skip(isMobile || testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
  });

  test('a GPS-tagged photo is stored as a 512×512 WebP with no metadata', async ({
    page,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    const input = await sharp(GPS_JPEG).metadata();
    expect(input.exif?.length ?? 0).toBeGreaterThan(0);

    const response = await upload(page, LOCAL_URL, GPS_JPEG);
    expect(response.status()).toBe(200);
    const path = await avatarPath(owner.id);
    expect(path).toMatch(/^[0-9a-f-]{36}\.webp$/);
    const file = await stored(path ?? '');
    expect(file).not.toBeNull();
    const meta = await sharp(file ?? Buffer.alloc(0)).metadata();
    const chunks = webpChunks(file ?? Buffer.alloc(0));
    const proof = {
      input: {
        format: input.format,
        width: input.width,
        height: input.height,
        exifBytes: input.exif?.length ?? 0,
      },
      stored: {
        format: meta.format,
        width: meta.width,
        height: meta.height,
        exif: meta.exif === undefined ? 'none' : meta.exif.length,
        xmp: meta.xmp === undefined ? 'none' : meta.xmp.length,
        iptc: meta.iptc === undefined ? 'none' : meta.iptc.length,
        icc: meta.icc === undefined ? 'none' : meta.icc.length,
        riffChunks: chunks,
        containsCameraMake: (file ?? Buffer.alloc(0)).includes(Buffer.from('HucxterTest')),
      },
    };
    // Printed for the PR (GPS proof).
    console.log(`GPS_PROOF ${JSON.stringify(proof)}`);
    expect(proof.stored).toMatchObject({
      format: 'webp',
      width: 512,
      height: 512,
      exif: 'none',
      xmp: 'none',
      iptc: 'none',
      icc: 'none',
      containsCameraMake: false,
    });
    expect(chunks.every((id) => ['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(id))).toBe(true);

    // The profile shows it, from the exact Storage origin the CSP allows.
    const profile = await page.goto(`${LOCAL_URL}/u/${owner.handle}`);
    const csp = profile?.headers()['content-security-policy'] ?? '';
    const origin = new URL(process.env.SUPABASE_URL ?? '').origin;
    expect(csp).toContain(`img-src 'self' data: blob:`);
    expect(csp.match(/img-src[^;]*/)?.[0]).toContain(origin);
    const img = page.getByRole('main').locator('header img').first();
    await expect(img).toHaveAttribute(
      'src',
      `${origin}/storage/v1/object/public/avatars/${path ?? ''}`,
    );
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(512);
  });

  test('replacing deletes the old file; removing deletes it and shows initials', async ({
    page,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    expect((await upload(page, LOCAL_URL, GPS_JPEG)).status()).toBe(200);
    const first = await avatarPath(owner.id);
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    expect((await upload(page, LOCAL_URL, png, 'image/png')).status()).toBe(200);
    const second = await avatarPath(owner.id);
    expect(second).not.toBe(first);
    expect(await stored(first ?? '')).toBeNull();
    expect(await stored(second ?? '')).not.toBeNull();

    const removed = await page.request.delete(`${LOCAL_URL}/api/profile/avatar`, {
      headers: { Origin: LOCAL_URL },
    });
    expect(removed.status()).toBe(200);
    expect(await avatarPath(owner.id)).toBeNull();
    expect(await stored(second ?? '')).toBeNull();
    await page.goto(`${LOCAL_URL}/u/${owner.handle}`);
    await expect(
      page.getByRole('main').locator('header [data-avatar="initials"]').first(),
    ).toHaveText('S');
  });

  test('wrong types, forged bytes, oversize, cross-origin and guests are refused', async ({
    page,
    playwright,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>');
    expect((await upload(page, LOCAL_URL, svg, 'image/svg+xml')).status()).toBe(415);
    expect((await upload(page, LOCAL_URL, svg, 'image/jpeg')).status()).toBe(422);
    expect((await upload(page, LOCAL_URL, Buffer.from('GIF89a'), 'image/png')).status()).toBe(422);
    expect((await upload(page, LOCAL_URL, Buffer.alloc(0), 'image/jpeg')).status()).toBe(400);
    const oversize = Buffer.concat([GPS_JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    expect((await upload(page, LOCAL_URL, oversize)).status()).toBe(413);
    const refused = await upload(page, LOCAL_URL, svg, 'image/jpeg');
    expect(await refused.json()).toEqual({ error: 'Choose a JPEG, PNG or WebP photo up to 5 MB.' });

    const crossOrigin = await page.request.post(`${LOCAL_URL}/api/profile/avatar`, {
      headers: { Origin: 'https://evil.example', 'Content-Type': 'image/jpeg' },
      data: GPS_JPEG,
    });
    expect(crossOrigin.status()).toBe(403);
    const guest = await playwright.request.newContext();
    expect(
      (
        await guest.post(`${LOCAL_URL}/api/profile/avatar`, {
          headers: { Origin: LOCAL_URL, 'Content-Type': 'image/jpeg' },
          data: GPS_JPEG,
        })
      ).status(),
    ).toBe(401);
    await guest.dispose();
    expect(await avatarPath(owner.id)).toBeNull();
  });

  test('deleting the account holds the handle and queues the photo for deletion', async ({
    page,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    expect((await upload(page, LOCAL_URL, GPS_JPEG)).status()).toBe(200);
    const path = await avatarPath(owner.id);
    await page.goto(`${LOCAL_URL}/settings/account`);
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/?deleted=1`);
    const { data: jobs } = await localAdmin()
      .from('jobs')
      .select('kind, payload')
      .eq('kind', 'storage_delete_avatar')
      .contains('payload', { path });
    expect(jobs).toHaveLength(1);
    const { data: hold } = await localAdmin()
      .from('handle_holds')
      .select('user_id, reason')
      .eq('handle', owner.handle);
    expect(hold).toEqual([{ user_id: null, reason: 'account_deleted' }]);
    expect((await page.request.get(`${LOCAL_URL}/u/${owner.handle}`)).status()).toBe(404);
  });
});

test.describe('Profile photos off (AVATAR_UPLOADS=off on :3102)', () => {
  test.beforeEach(({ isMobile }, testInfo) => {
    test.skip(isMobile || testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
  });

  test('the route is 404, the CSP has no Storage origin, stored photos show as initials', async ({
    page,
  }, testInfo) => {
    const owner = await member(page, testInfo, INVITE_OFF_URL);
    expect((await upload(page, INVITE_OFF_URL, GPS_JPEG)).status()).toBe(404);
    // A photo stored while photos were on is ignored while they're off.
    await localAdmin()
      .from('profiles')
      .update({ avatar_path: '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d.webp' })
      .eq('id', owner.id);
    const response = await page.goto(`${INVITE_OFF_URL}/u/${owner.handle}`);
    const origin = new URL(process.env.SUPABASE_URL ?? '').origin;
    expect(response?.headers()['content-security-policy']).not.toContain(origin);
    expect(await page.content()).not.toContain('/storage/v1/object/public/avatars/');
    await expect(
      page.getByRole('main').locator('header [data-avatar="initials"]').first(),
    ).toHaveText('S');
  });
});

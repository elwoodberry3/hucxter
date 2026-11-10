import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * A 3-second, 360×640 MP4 test video (moving colour bars), recorded by headless Chromium with
 * MediaRecorder, so CI needs no ffmpeg. The sell e2e uploads it, and the fake video provider plays
 * it back as video/mp4, a type Mux Player recognises (Brief 03C.1b H6). VP9 first: Playwright's
 * Linux Chromium can't decode H.264. Generated once into e2e/fixtures/fake-video/ (git-ignored).
 */
export const FAKE_VIDEO = join(dirname(fileURLToPath(import.meta.url)), 'fake-video', 'sample.mp4');

export async function ensureFakeVideo(): Promise<string> {
  if (existsSync(FAKE_VIDEO)) return FAKE_VIDEO;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const base64 = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 640;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('no 2d context');
      const stream = canvas.captureStream(24);
      const mimeType = ['video/mp4;codecs=vp9', 'video/mp4;codecs=avc1', 'video/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (mimeType === undefined) throw new Error('MediaRecorder cannot record MP4');
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start(250);
      const started = performance.now();
      await new Promise<void>((resolve) => {
        const draw = () => {
          const t = (performance.now() - started) / 1000;
          ['#6457af', '#257a4a', '#c8372c', '#545072'].forEach((color, i) => {
            context.fillStyle = color;
            context.fillRect((i * 90 + t * 60) % 360, 0, 90, 640);
          });
          if (t < 3) requestAnimationFrame(draw);
          else resolve();
        };
        draw();
      });
      recorder.stop();
      await stopped;
      const buffer = await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer();
      let binary = '';
      for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
      return btoa(binary);
    });
    mkdirSync(dirname(FAKE_VIDEO), { recursive: true });
    writeFileSync(FAKE_VIDEO, Buffer.from(base64, 'base64'));
    return FAKE_VIDEO;
  } finally {
    await browser.close();
  }
}

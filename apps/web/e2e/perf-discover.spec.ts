import { mkdirSync, writeFileSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { LOCAL_URL, viewFrom } from './support';

/**
 * Discover lab baseline for 3E (Brief 03 Milestone 3D). Opt-in: `PERF=1 pnpm exec playwright test
 * perf-discover --project=desktop-1440 --project=mobile-chromium`. Production build on :3103
 * (fake video, MP4 from this origin, not Mux HLS), 12 seeded listings, cold cache per run, no
 * network throttling; the 390 run adds a 4× CPU slowdown. Chromium only: WebKit has no LCP,
 * layout-shift or event-timing entries. Reports the median of 3 runs.
 *
 * - LCP: last largest-contentful-paint entry before the first input.
 * - CLS: sum of layout-shift values without recent input (one session; the page is short-lived).
 * - INP proxy: the longest event-timing entry for a ↓ key press and a tap on Next.
 * - JS: summed transferSize of script resources loaded by the route (compressed bytes).
 */
const RUNS = 3;
const CASES = {
  'desktop-1440': {
    label: '1440',
    device: 'Desktop Chrome',
    zip: '59401',
    viewport: { width: 1440, height: 900 },
    cpu: 1,
  },
  'mobile-chromium': {
    label: '390',
    device: 'Pixel 7',
    zip: '59801',
    viewport: { width: 390, height: 844 },
    cpu: 4,
  },
} as const;

interface Sample {
  lcpMs: number;
  cls: number;
  inpProxyMs: number;
  jsKb: number;
  jsFiles: number;
  lcpElement: string;
  shifts: string[];
}

const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
});

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
};

test('Discover lab baseline: LCP, CLS, INP proxy, JS transferred', async ({
  browser,
}, testInfo) => {
  test.skip(process.env.PERF !== '1', 'opt-in lab run (PERF=1)');
  const setup = CASES[testInfo.project.name as keyof typeof CASES] as
    (typeof CASES)[keyof typeof CASES] | undefined;
  test.skip(setup === undefined, 'Chromium projects only (desktop-1440 and mobile-chromium)');
  if (setup === undefined) return;
  test.setTimeout(300_000);

  for (let i = 0; i < 12; i += 1) {
    seeded.push(
      await seedListing(testInfo, {
        zip: setup.zip,
        title: `Perf lamp ${String(i + 1)}`,
        priceCents: 1500 + i * 100,
        publishedDaysAgo: i * 0.01,
      }),
    );
  }

  const samples: Sample[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const context = await browser.newContext({
      ...devices[setup.device],
      viewport: setup.viewport,
    });
    await viewFrom(context, setup.zip, 1);
    const page = await context.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as {
        __perf: {
          lcp: number;
          lcpElement: string;
          cls: number;
          shifts: string[];
          events: number[];
        };
      };
      w.__perf = { lcp: 0, lcpElement: '', cls: 0, shifts: [], events: [] };
      // Which element: tag, role, data-* names and the nearest landmark (no text content).
      const describe = (node: Node | null | undefined) => {
        if (!(node instanceof Element)) return node?.nodeName ?? 'none';
        const role = node.getAttribute('role');
        const data = node.getAttributeNames().filter((name) => name.startsWith('data-'));
        const landmark = node.closest('header, nav, main, footer, aside, [role]');
        return [
          node.tagName.toLowerCase(),
          role === null ? '' : `[role=${role}]`,
          ...data.map((name) => `[${name}]`),
          landmark === null || landmark === node
            ? ''
            : ` in ${landmark.tagName.toLowerCase()}${landmark.getAttribute('role') === null ? '' : `[role=${landmark.getAttribute('role') ?? ''}]`}`,
        ].join('');
      };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__perf.lcp = entry.startTime;
          w.__perf.lcpElement = describe(
            (entry as PerformanceEntry & { element?: Element }).element,
          );
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
            sources?: { node?: Node | null }[];
          };
          if (shift.hadRecentInput) continue;
          w.__perf.cls += shift.value;
          const nodes = (shift.sources ?? []).map((source) => describe(source.node)).join(', ');
          w.__perf.shifts.push(`${shift.value.toFixed(4)} ${nodes}`);
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const timing = entry as PerformanceEntry & { interactionId?: number };
          if ((timing.interactionId ?? 0) > 0) w.__perf.events.push(entry.duration);
        }
      }).observe({
        type: 'event',
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    });
    if (setup.cpu > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: setup.cpu });
    }

    await page.goto(`${LOCAL_URL}/discover`, { waitUntil: 'load' });
    const first = page.locator('[data-feed-item]').first();
    await expect(first).toBeVisible();
    await expect(first).not.toHaveAttribute('data-playback', 'loading', { timeout: 30_000 });
    await page.waitForTimeout(1000);
    const lcp = await page.evaluate(
      () => (window as unknown as { __perf: { lcp: number; lcpElement: string } }).__perf,
    );

    // Interactions: ↓ with focus in the feed, then a tap on Next.
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-feed-item][data-active="true"]')).not.toHaveAttribute(
      'data-id',
      (await first.getAttribute('data-id')) ?? '',
    );
    await page.getByRole('button', { name: 'Next video' }).click();
    await page.waitForTimeout(1000);

    const result = await page.evaluate(() => {
      const w = window as unknown as {
        __perf: { cls: number; shifts: string[]; events: number[] };
      };
      const scripts = performance
        .getEntriesByType('resource')
        .filter(
          (entry) =>
            (entry as PerformanceResourceTiming).initiatorType === 'script' ||
            (entry.name.split('?')[0] ?? '').endsWith('.js'),
        ) as PerformanceResourceTiming[];
      return {
        cls: w.__perf.cls,
        shifts: w.__perf.shifts,
        inp: Math.max(0, ...w.__perf.events),
        jsBytes: scripts.reduce((sum, entry) => sum + entry.transferSize, 0),
        jsFiles: scripts.length,
      };
    });
    samples.push({
      lcpMs: Math.round(lcp.lcp),
      cls: Number(result.cls.toFixed(4)),
      inpProxyMs: Math.round(result.inp),
      jsKb: Math.round(result.jsBytes / 1024),
      jsFiles: result.jsFiles,
      lcpElement: lcp.lcpElement,
      shifts: result.shifts,
    });
    await context.close();
  }

  const summary = {
    viewport: setup.label,
    cpuSlowdown: setup.cpu,
    runs: samples,
    median: {
      lcpMs: median(samples.map((s) => s.lcpMs)),
      cls: median(samples.map((s) => s.cls)),
      inpProxyMs: median(samples.map((s) => s.inpProxyMs)),
      jsKb: median(samples.map((s) => s.jsKb)),
    },
  };
  mkdirSync('test-results/perf', { recursive: true });
  writeFileSync(`test-results/perf/discover-${setup.label}.json`, JSON.stringify(summary, null, 2));
  console.log(`discover perf ${setup.label}: ${JSON.stringify(summary.median)}`);
  expect(samples).toHaveLength(RUNS);
});

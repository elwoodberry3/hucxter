'use client';

import { parseFeedItems } from '@hucxter/contracts';
import type { FeedItem, ListingCard } from '@hucxter/contracts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { KeyboardEvent } from 'react';
import { useViewer } from '@/components/auth/viewer-context';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { SheetSize } from '@/components/ui/bottom-sheet';
import { isEditable } from '@/lib/editable';
import { DetailsSheet } from './details-sheet';
import { FeedCard } from './feed-card';
import type { FeedPlayerHandle } from './feed-player';
import { fetchItem } from './item-data';
import type { ItemEntry } from './item-data';
import styles from './discover.module.css';

const SOUND_KEY = 'hx:discover:sound';
/** An item counts as viewed (discover_item_viewed) after this long as the active item. */
const VIEWED_AFTER_MS = 1000;
/** Load the next page when the active item is this close to the end. */
const LOAD_MORE_WITHIN = 3;

// Sound choice for the session (sessionStorage; falls back to memory when storage is blocked).
let soundInMemory = false;
const soundListeners = new Set<() => void>();

function readSound(): boolean {
  try {
    return window.sessionStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return soundInMemory;
  }
}

function writeSound(on: boolean): void {
  soundInMemory = on;
  try {
    window.sessionStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the in-memory value lasts for this page.
  }
  for (const listener of soundListeners) listener();
}

function subscribeSound(listener: () => void): () => void {
  soundListeners.add(listener);
  return () => {
    soundListeners.delete(listener);
  };
}

const subscribeNothing = () => () => undefined;

// Back from /l/[id] reopens the details sheet at the size it had (sessionStorage, 30 minutes).
const RETURN_KEY = 'hx:discover:return';
const RETURN_TTL_MS = 30 * 60 * 1000;

interface SheetState {
  id: string;
  size: SheetSize;
}

function urlItem(): string | null {
  return new URL(window.location.href).searchParams.get('l');
}

function readReturn(): SheetState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(RETURN_KEY);
    if (raw === null) return null;
    const value = JSON.parse(raw) as { id?: unknown; size?: unknown; at?: unknown };
    const fresh = typeof value.at === 'number' && Date.now() - value.at < RETURN_TTL_MS;
    if (!fresh || typeof value.id !== 'string' || value.id !== urlItem()) return null;
    return { id: value.id, size: value.size === 'expanded' ? 'expanded' : 'peek' };
  } catch {
    return null;
  }
}

function writeReturn(sheet: SheetState): void {
  try {
    window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ ...sheet, at: Date.now() }));
  } catch {
    // Storage blocked: Back still returns to the item, with the sheet closed.
  }
}

function clearReturn(): void {
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing stored.
  }
}

function beacon(body: Record<string, string>): void {
  void fetch('/api/discover/view', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/** Slow or data-saving connections: the next item gets no player until it is active. */
function savesData(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  if (connection === undefined) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === '2g' ||
    connection.effectiveType === 'slow-2g'
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(query.matches);
    };
    update();
    query.addEventListener('change', update);
    return () => {
      query.removeEventListener('change', update);
    };
  }, []);
  return reduced;
}

function listings(items: FeedItem[]): ListingCard[] {
  return items.flatMap((item) => (item.type === 'listing' ? [item.listing] : []));
}

const SHORTCUTS: [string, string][] = [
  ['J or ↓', 'Next video'],
  ['K or ↑', 'Previous video'],
  ['Space', 'Play or pause'],
  ['M', 'Sound on or off'],
  ['S', 'Save'],
  ['?', 'Show these shortcuts'],
];

export interface DiscoverFeedProps {
  items: FeedItem[];
  nextCursor: string | null;
  startMissingId: string | null;
  startedMidway: boolean;
}

/**
 * Discover (Brief 03 Milestone 3D): a full-height vertical feed of nearby listing videos. One item
 * is active at a time (the one most in view); it and the next one mount a player, every other item
 * is a poster. The URL holds the active item (`?l=`, replaced, not pushed, so Back leaves the
 * feed). Touch scrolls snap; desktop scrolls freely (no scroll-jacking), with Previous/Next buttons
 * and keyboard shortcuts that work only while focus is inside the feed.
 */
export function DiscoverFeed({
  items: initialItems,
  nextCursor: initialCursor,
  startMissingId,
  startedMidway,
}: DiscoverFeedProps) {
  const verified = useViewer().status === 'verified';
  const hintId = useId();
  const [cards, setCards] = useState<ListingCard[]>(() => listings(initialItems));
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [active, setActive] = useState(0);
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const soundOn = useSyncExternalStore(subscribeSound, readSound, () => false);
  const lowData = useSyncExternalStore(subscribeNothing, savesData, () => false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Safe to read during hydration: BottomSheet renders nothing until mounted on the client.
  const [sheet, setSheet] = useState<SheetState | null>(readReturn);
  const reduced = useReducedMotion();
  const router = useRouter();
  /** While set, the URL keeps this item (restoring a position) instead of following `active`. */
  const restoring = useRef<string | null>(null);
  const regionRef = useRef<HTMLElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<string, FeedPlayerHandle>());
  const requested = useRef(new Set<string>());
  const viewed = useRef(new Set<string>());
  const pagingFrom = useRef<string | null>(null);

  useEffect(() => {
    beacon({});
  }, []);

  // Restore the item in the URL. A Back navigation can render the feed from an earlier visit's
  // data: scroll to the item when it is loaded, else fetch the feed again starting there.
  useEffect(() => {
    const target = urlItem();
    if (target === null || target === cards[0]?.id || startMissingId !== null) return;
    restoring.current = target;
    const element = feedRef.current?.querySelector<HTMLElement>(`[data-id="${target}"]`);
    if (element === null || element === undefined) {
      router.refresh();
      return;
    }
    element.scrollIntoView({ block: 'start', behavior: 'auto' });
    // Mount-only: later URL changes come from this feed itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The restored sheet has been shown; forget it.
  useEffect(() => {
    if (sheet !== null) clearReturn();
  }, [sheet]);

  // The feed fills the viewport below whatever sits above it (header, category bar, notices).
  useEffect(() => {
    const region = regionRef.current;
    const feed = feedRef.current;
    if (region === null || feed === null) return;
    const measure = () => {
      const top = feed.getBoundingClientRect().top + window.scrollY;
      region.style.setProperty('--hx-feed-top', `${String(Math.round(top))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  // The active item is the one at least 60% in view.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed === null) return;
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const index = Number((record.target as HTMLElement).dataset.index);
          if (Number.isInteger(index)) setActive(index);
        }
      },
      { root: feed, threshold: 0.6 },
    );
    for (const element of feed.querySelectorAll('[data-feed-item]')) observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [cards.length]);

  const activeCard = cards[active];

  // URL holds the active item; replace, so Back leaves Discover instead of stepping through items.
  useEffect(() => {
    if (activeCard === undefined) return;
    if (restoring.current !== null) {
      if (activeCard.id !== restoring.current) return;
      restoring.current = null;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get('l') === activeCard.id) return;
    url.searchParams.set('l', activeCard.id);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  }, [activeCard]);

  // Details and playback for the active and next items only.
  const load = useCallback((id: string) => {
    setEntries((current) => ({ ...current, [id]: { status: 'loading' } }));
    void fetchItem(id).then((entry) => {
      setEntries((current) => ({ ...current, [id]: entry }));
    });
  }, []);

  useEffect(() => {
    for (const card of [cards[active], cards[active + 1]]) {
      if (card === undefined || requested.current.has(card.id)) continue;
      requested.current.add(card.id);
      load(card.id);
    }
  }, [active, cards, load]);

  // discover_item_viewed after a second as the active item (once per item per page).
  useEffect(() => {
    if (activeCard === undefined || activeCard.own === true) return;
    if (viewed.current.has(activeCard.id)) return;
    const id = activeCard.id;
    const timer = window.setTimeout(() => {
      if (document.hidden) return;
      viewed.current.add(id);
      beacon({ listingId: id });
    }, VIEWED_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeCard]);

  // Next page when the active item nears the end (one request per cursor).
  useEffect(() => {
    if (nextCursor === null || active < cards.length - LOAD_MORE_WITHIN) return;
    if (pagingFrom.current === nextCursor) return;
    pagingFrom.current = nextCursor;
    void fetch(`/api/discover?after=${encodeURIComponent(nextCursor)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { items?: unknown; nextCursor?: unknown };
        const more = listings(parseFeedItems(Array.isArray(body.items) ? body.items : []));
        setCards((current) => {
          const seen = new Set(current.map((card) => card.id));
          return [...current, ...more.filter((card) => !seen.has(card.id))];
        });
        setNextCursor(typeof body.nextCursor === 'string' ? body.nextCursor : null);
      })
      .catch(() => {
        // Stop paging; the end-of-feed note shows.
        setNextCursor(null);
      });
  }, [active, cards.length, nextCursor]);

  const goTo = useCallback(
    (index: number) => {
      const feed = feedRef.current;
      const target = feed?.querySelector<HTMLElement>(`[data-index="${String(index)}"]`);
      if (target === null || target === undefined) return;
      target.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      target.focus({ preventScroll: true });
    },
    [reduced],
  );

  const toggleSound = useCallback(() => {
    writeSound(!readSound());
  }, []);

  const retry = useCallback(
    (id: string) => {
      setAttempts((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
      load(id);
    },
    [load],
  );

  // Single-key shortcuts only while focus is inside the feed, never while typing, in a sheet or
  // with a modifier held (WCAG 2.2 SC 2.1.4). Arrow keys and the buttons always work.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    const target = event.target;
    if (isEditable(target) || target instanceof HTMLSelectElement) return;
    if (target instanceof Element && target.closest('[role="dialog"], dialog') !== null) return;
    if (document.documentElement.dataset.sheetOpen !== undefined) return;
    const onControl =
      target instanceof HTMLButtonElement ||
      target instanceof HTMLAnchorElement ||
      (target instanceof Element && target.closest('mux-player') !== null);
    const key = event.key;
    if (key === 'ArrowDown' || key === 'j' || key === 'J') {
      goTo(Math.min(active + 1, cards.length - 1));
    } else if (key === 'ArrowUp' || key === 'k' || key === 'K') {
      goTo(Math.max(active - 1, 0));
    } else if (key === ' ' && !onControl) {
      if (activeCard !== undefined) handles.current.get(activeCard.id)?.toggle();
    } else if (key === 'm' || key === 'M') {
      toggleSound();
    } else if (key === 's' || key === 'S') {
      feedRef.current
        ?.querySelector<HTMLElement>(`[data-index="${String(active)}"] [data-feed-save] button`)
        ?.click();
    } else if (key === '?') {
      setShortcutsOpen(true);
    } else {
      return;
    }
    event.preventDefault();
  };

  const openDetails = useCallback((id: string) => {
    handles.current.get(id)?.pause();
    setSheet({ id, size: 'peek' });
  }, []);

  const sheetCard = sheet === null ? undefined : cards.find((card) => card.id === sheet.id);

  const mounted = useMemo(() => {
    const ids = new Set<string>();
    const current = cards[active];
    const next = cards[active + 1];
    if (current !== undefined) ids.add(current.id);
    if (next !== undefined && !lowData) ids.add(next.id);
    return ids;
  }, [active, cards, lowData]);

  return (
    <section
      ref={regionRef}
      className={styles.region}
      aria-label="Discover videos near you"
      aria-describedby={hintId}
      onKeyDown={onKeyDown}
    >
      <p id={hintId} className="visually-hidden">
        Keyboard shortcuts while you’re in the feed: J or Down arrow for the next video, K or Up
        arrow for the previous one, Space to play or pause, M for sound, S to save, and question
        mark for this list.
      </p>
      {startMissingId === null ? null : (
        <p className={styles.note} role="status">
          That video isn’t in your feed. <Link href={`/l/${startMissingId}`}>View the listing</Link>
        </p>
      )}
      <div ref={feedRef} className={styles.feed}>
        <div role="feed" aria-label="Videos">
          {cards.map((card, index) => (
            <FeedCard
              key={card.id}
              card={card}
              index={index}
              setSize={nextCursor === null ? cards.length : -1}
              active={index === active}
              entry={entries[card.id]}
              attempt={attempts[card.id] ?? 0}
              mountPlayer={mounted.has(card.id)}
              autoplay={!reduced && sheet === null}
              reducedMotion={reduced}
              soundOn={soundOn}
              onToggleSound={toggleSound}
              onRetry={retry}
              verified={verified}
              backToNewest={startedMidway && index === 0}
              onDetails={() => {
                openDetails(card.id);
              }}
              registerHandle={(handle) => {
                if (handle === null) handles.current.delete(card.id);
                else handles.current.set(card.id, handle);
              }}
            />
          ))}
        </div>
        {nextCursor === null && cards.length > 0 ? (
          <p className={styles.end}>
            That’s everything near you for now. <Link href="/sell">Sell something</Link>
          </p>
        ) : null}
      </div>
      <div className={styles.nav} role="group" aria-label="Move through videos">
        <button
          type="button"
          className={styles.navButton}
          onClick={() => {
            goTo(active - 1);
          }}
          disabled={active === 0}
          aria-label="Previous video"
        >
          <ChevronUp size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => {
            goTo(active + 1);
          }}
          disabled={active >= cards.length - 1}
          aria-label="Next video"
        >
          <ChevronDown size={22} aria-hidden="true" />
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {activeCard === undefined ? '' : `Item ${String(active + 1)}: ${activeCard.title}`}
      </p>
      {sheet === null || sheetCard === undefined ? null : (
        <DetailsSheet
          card={sheetCard}
          entry={entries[sheetCard.id]}
          size={sheet.size}
          onSizeChange={(size) => {
            setSheet({ id: sheetCard.id, size });
          }}
          onClose={() => {
            setSheet(null);
          }}
          onRetry={() => {
            retry(sheetCard.id);
          }}
          onNavigate={(href) => {
            if (href === `/l/${sheetCard.id}`) writeReturn(sheet);
          }}
        />
      )}
      <BottomSheet
        open={shortcutsOpen}
        onClose={() => {
          setShortcutsOpen(false);
        }}
        title="Keyboard shortcuts"
      >
        <p className={styles.sheetNote}>These work while you’re in the feed, not while typing.</p>
        <dl className={styles.shortcuts}>
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </BottomSheet>
    </section>
  );
}

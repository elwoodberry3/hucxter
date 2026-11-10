import { ListingDetail } from '@hucxter/contracts';
import { z } from 'zod';
import type { PlayerSource } from '@/components/video/player-common';

const Source = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('mux'),
    playbackId: z.string().min(1),
    tokens: z.object({ playback: z.string(), thumbnail: z.string(), storyboard: z.string() }),
  }),
  z.object({ kind: z.literal('file'), src: z.string().min(1), poster: z.string().min(1) }),
]);

const Item = z.object({
  detail: ListingDetail,
  saved: z.boolean(),
  own: z.boolean(),
  source: Source.nullable(),
  rows: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
});

export interface ItemData {
  detail: ListingDetail;
  saved: boolean;
  own: boolean;
  source: PlayerSource | null;
  /** Labelled attributes for the details sheet (Condition first). */
  rows: { label: string; value: string }[];
}

/**
 * A feed item's state. `gone` (the item left the feed: sold, deleted, removed, in review) is final
 * for the session: no player, no retry. `error` (network or 5xx) offers Try again.
 */
export type ItemEntry =
  | { status: 'loading' }
  | { status: 'ok'; data: ItemData }
  | { status: 'gone' }
  | { status: 'error' };

export async function fetchItem(id: string): Promise<ItemEntry> {
  try {
    const response = await fetch(`/api/discover/items/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (response.status === 404) return { status: 'gone' };
    if (!response.ok) return { status: 'error' };
    const parsed = Item.safeParse(await response.json());
    return parsed.success ? { status: 'ok', data: parsed.data } : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

'use client';

import { formatPrice } from '@hucxter/contracts';
import type { ListingCard } from '@hucxter/contracts';
import { Info, LoaderCircle, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ReportButton } from '@/components/listing/report-button';
import { SaveButton } from '@/components/listing/save-button';
import { ShareButton } from '@/components/listing/share-button';
import { StatusBadge } from '@/components/listing/status-badge';
import { FeedPlayer } from './feed-player';
import type { FeedPlayerHandle, PlaybackState } from './feed-player';
import type { ItemEntry } from './item-data';
import styles from './discover.module.css';

/**
 * One Discover item: poster first (fixed 9:16 box, so nothing shifts), the player when this item
 * is active or next, the overlay (price, title, distance bucket, area, status) over a scrim, and
 * the actions rail. No likes, comments, counts or ratings (D-43, D-46).
 */
export function FeedCard({
  card,
  index,
  setSize,
  active,
  entry,
  attempt,
  mountPlayer,
  autoplay,
  reducedMotion,
  soundOn,
  onToggleSound,
  onRetry,
  verified,
  backToNewest,
  registerHandle,
  onDetails,
}: {
  card: ListingCard;
  index: number;
  /** aria-setsize: the total when known, else -1. */
  setSize: number;
  active: boolean;
  entry: ItemEntry | undefined;
  /** Bumped by Try again, to remount the player with fresh tokens. */
  attempt: number;
  mountPlayer: boolean;
  autoplay: boolean;
  reducedMotion: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onRetry: (id: string) => void;
  verified: boolean;
  backToNewest: boolean;
  registerHandle: (handle: FeedPlayerHandle | null) => void;
  /** Opens the details sheet for this item. */
  onDetails: () => void;
}) {
  const [playback, setPlayback] = useState<PlaybackState>('loading');
  const [handle, setHandle] = useState<FeedPlayerHandle | null>(null);
  const gone = entry?.status === 'gone';
  const data = entry?.status === 'ok' ? entry.data : null;
  const source = data?.source ?? null;
  const own = data?.own ?? card.own === true;
  const price = formatPrice(card.price_cents);
  const place = `${card.distance_bucket} · ${card.area_label}`;
  const label = `${card.title}, ${price}, ${card.distance_bucket}, ${card.area_label}`;
  const showPlayer = mountPlayer && source !== null && !gone;

  const onState = useCallback((state: PlaybackState) => {
    setPlayback(state);
  }, []);

  const bindHandle = useCallback(
    (next: FeedPlayerHandle | null) => {
      setHandle(next);
      registerHandle(next);
    },
    // registerHandle is a fresh closure each render; the id it captures doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id],
  );

  const failed =
    !gone &&
    (entry?.status === 'error' || playback === 'error' || (data !== null && source === null));
  const paused = playback === 'paused' || playback === 'blocked';
  const showPlay =
    showPlayer &&
    !failed &&
    (playback === 'blocked' || (reducedMotion && paused) || (!autoplay && paused));

  return (
    <article
      className={styles.item}
      data-feed-item
      data-index={index}
      data-id={card.id}
      data-active={active ? 'true' : undefined}
      data-playback={showPlayer ? playback : 'poster'}
      aria-label={label}
      aria-posinset={index + 1}
      aria-setsize={setSize}
      tabIndex={-1}
    >
      <div className={styles.stage}>
        <div className={styles.video} data-gone={gone ? 'true' : undefined}>
          {/* Decorative: the item's name is on the article and in the overlay. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin poster route; next/image adds inline styles */}
          <img
            className={styles.poster}
            src={card.poster_url}
            alt=""
            width={360}
            height={640}
            loading={index < 2 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
          />
          {showPlayer ? (
            <FeedPlayer
              key={attempt}
              source={source}
              title={card.title}
              active={active}
              autoplay={autoplay}
              muted={!soundOn}
              onState={onState}
              handleRef={bindHandle}
            />
          ) : null}

          {showPlayer && !failed ? (
            <button
              type="button"
              className={styles.tapLayer}
              aria-label={playback === 'playing' ? `Pause ${card.title}` : `Play ${card.title}`}
              onClick={() => {
                handle?.toggle();
              }}
            >
              {showPlay ? (
                <span className={styles.bigPlay}>
                  <Play size={28} aria-hidden="true" />
                  <span>{playback === 'blocked' ? 'Tap to play' : 'Play'}</span>
                </span>
              ) : playback === 'playing' || playback === 'paused' ? (
                <span className={styles.smallState} data-state={playback} aria-hidden="true">
                  {playback === 'playing' ? <Pause size={18} /> : <Play size={18} />}
                </span>
              ) : null}
            </button>
          ) : null}

          {active && showPlayer && (playback === 'buffering' || playback === 'slow') ? (
            <p className={styles.status} role="status">
              <LoaderCircle size={18} aria-hidden="true" className={styles.spin} />
              {playback === 'slow' ? 'Slow connection. Still trying…' : 'Loading video'}
            </p>
          ) : null}

          {gone ? (
            <p className={styles.message} role="status">
              This item is no longer available
            </p>
          ) : failed && (active || entry?.status === 'error') ? (
            <div className={styles.message} role="alert">
              <p>This video isn’t available right now.</p>
              <button
                type="button"
                className={styles.retry}
                onClick={() => {
                  setPlayback('loading');
                  onRetry(card.id);
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : null}

          <div className={styles.scrim}>
            {backToNewest ? (
              <Link href="/discover" className={styles.newest}>
                Back to newest
              </Link>
            ) : null}
            <p className={styles.price}>
              <span>{price}</span>
              <StatusBadge status={card.status} />
            </p>
            <h2 className={styles.title}>{card.title}</h2>
            <p className={styles.place}>{place}</p>
          </div>
        </div>

        <div className={styles.rail} role="group" aria-label={`Actions for ${card.title}`}>
          {gone ? null : (
            <span className={styles.railItem}>
              <button
                type="button"
                className={styles.railButton}
                aria-label={`Details for ${card.title}`}
                aria-haspopup="dialog"
                data-feed-details
                onClick={onDetails}
              >
                <Info size={20} aria-hidden="true" />
              </button>
              <span className={styles.railLabel} aria-hidden="true">
                Details
              </span>
            </span>
          )}
          {own || gone ? null : (
            <span data-feed-save className={styles.railItem}>
              <SaveButton
                listingId={card.id}
                title={card.title}
                initialSaved={card.saved === true}
                variant="icon"
                className={styles.railButton}
              />
              <span className={styles.railLabel} aria-hidden="true">
                Save
              </span>
            </span>
          )}
          <span className={styles.railItem}>
            <ShareButton
              className={styles.railButton}
              labelClassName="visually-hidden"
              path={`/l/${card.id}`}
              title={card.title}
              ariaLabel={`Share ${card.title}`}
            />
            <span className={styles.railLabel} aria-hidden="true">
              Share
            </span>
          </span>
          {own ? null : (
            <span className={styles.railItem}>
              <ReportButton
                target={{ kind: 'listing', listingId: card.id }}
                verified={verified}
                className={styles.railButton}
                labelClassName="visually-hidden"
              />
              <span className={styles.railLabel} aria-hidden="true">
                Report
              </span>
            </span>
          )}
          <span className={styles.railItem}>
            <button
              type="button"
              className={styles.railButton}
              aria-pressed={soundOn}
              aria-label="Sound"
              onClick={onToggleSound}
            >
              {soundOn ? (
                <Volume2 size={20} aria-hidden="true" />
              ) : (
                <VolumeX size={20} aria-hidden="true" />
              )}
            </button>
            <span className={styles.railLabel} aria-hidden="true">
              {soundOn ? 'Sound on' : 'Muted'}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}

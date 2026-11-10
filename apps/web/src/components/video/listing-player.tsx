'use client';

import MuxPlayer from '@mux/mux-player-react/lazy';
import type { MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { useRef } from 'react';
import { PLAYER_DEFAULTS, announcePlay, sourceProps, useSinglePlayer } from './player-common';
import type { PlayerSource } from './player-common';
import styles from './listing-player.module.css';

export type { PlayerSource } from './player-common';

/**
 * Listing video (hucxter-video-pipeline): signed Mux playback, tap to play, captions, speed and
 * fullscreen from Mux Player. Shares its settings and the one-player-at-a-time rule with the
 * Discover feed (player-common.ts).
 */
export function ListingPlayer({ source, title }: { source: PlayerSource; title: string }) {
  const ref = useRef<MuxPlayerRefAttributes | null>(null);
  useSinglePlayer(ref);

  return (
    <MuxPlayer
      {...PLAYER_DEFAULTS}
      {...sourceProps(source)}
      ref={ref}
      className={styles.player ?? ''}
      title={title}
      preload="metadata"
      loading="viewport"
      onPlay={() => {
        announcePlay(ref.current);
      }}
    />
  );
}

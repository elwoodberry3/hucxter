'use client';

import MuxPlayer from '@mux/mux-player-react/lazy';
import type { MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { useEffect, useRef } from 'react';
import styles from './listing-player.module.css';

export type PlayerSource =
  | {
      kind: 'mux';
      playbackId: string;
      tokens: { playback: string; thumbnail: string; storyboard: string };
    }
  | { kind: 'file'; src: string; poster: string };

// One player plays at a time (Brief 03C.1 §3.4): starting one pauses every other.
const PLAY_EVENT = 'hx:player-play';

/**
 * Listing video (hucxter-video-pipeline): signed Mux playback, tap to play, captions, speed and
 * fullscreen from Mux Player. Mux Data tracking and its cookies are off (no litix.io beacons;
 * D-05 consent comes first), and remote playback is off so Chrome never loads the Cast SDK.
 */
export function ListingPlayer({ source, title }: { source: PlayerSource; title: string }) {
  const ref = useRef<MuxPlayerRefAttributes | null>(null);

  useEffect(() => {
    // Mux Player forwards this to its <video>; media-chrome then never touches `remote`.
    ref.current?.setAttribute('disableremoteplayback', '');
    const onOtherPlay = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== ref.current) ref.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => {
      window.removeEventListener(PLAY_EVENT, onOtherPlay);
    };
  }, []);

  const common = {
    ref,
    className: styles.player ?? '',
    title,
    streamType: 'on-demand' as const,
    playsInline: true,
    preload: 'metadata',
    disableTracking: true,
    disableCookies: true,
    disablePictureInPicture: true,
    noVolumePref: true,
    loading: 'viewport' as const,
    onPlay: () => {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: ref.current }));
    },
  };

  return source.kind === 'mux' ? (
    <MuxPlayer {...common} playbackId={source.playbackId} tokens={source.tokens} />
  ) : (
    <MuxPlayer {...common} src={source.src} poster={source.poster} />
  );
}

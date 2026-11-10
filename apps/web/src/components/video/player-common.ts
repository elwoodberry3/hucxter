'use client';

import type { MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { useEffect } from 'react';
import type { RefObject } from 'react';

export type PlayerSource =
  | {
      kind: 'mux';
      playbackId: string;
      tokens: { playback: string; thumbnail: string; storyboard: string };
    }
  | { kind: 'file'; src: string; poster: string };

// One player plays at a time (Brief 03C.1 §3.4, 3D): starting one pauses every other.
export const PLAY_EVENT = 'hx:player-play';

/** Tell every other player on the page to pause. Call from a player's `play` event. */
export function announcePlay(player: MuxPlayerRefAttributes | null): void {
  window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: player }));
}

/**
 * Joins the one-player-at-a-time rule: pauses this player when another starts. Also turns off
 * remote playback (Mux Player forwards the attribute to its <video>, so media-chrome never loads
 * the Cast SDK).
 */
export function useSinglePlayer(ref: RefObject<MuxPlayerRefAttributes | null>): void {
  useEffect(() => {
    ref.current?.setAttribute('disableremoteplayback', '');
    const onOtherPlay = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== ref.current) ref.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => {
      window.removeEventListener(PLAY_EVENT, onOtherPlay);
    };
  }, [ref]);
}

/**
 * Mux Player settings every Hucxter player shares (hucxter-video-pipeline): Mux Data tracking and
 * its cookies off (no litix.io beacons; D-05 consent comes first), inline on iOS, no picture in
 * picture, no stored volume preference.
 */
export const PLAYER_DEFAULTS = {
  streamType: 'on-demand',
  playsInline: true,
  disableTracking: true,
  disableCookies: true,
  disablePictureInPicture: true,
  noVolumePref: true,
} as const;

type MuxTokens = Extract<PlayerSource, { kind: 'mux' }>['tokens'];

/** The source props for a PlayerSource (signed Mux playback, or the local fake file). */
export function sourceProps(
  source: PlayerSource,
): { playbackId: string; tokens: MuxTokens } | { src: string; poster: string } {
  return source.kind === 'mux'
    ? { playbackId: source.playbackId, tokens: source.tokens }
    : { src: source.src, poster: source.poster };
}

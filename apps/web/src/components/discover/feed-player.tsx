'use client';

import MuxPlayer from '@mux/mux-player-react/lazy';
import type { MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import {
  PLAYER_DEFAULTS,
  announcePlay,
  sourceProps,
  useSinglePlayer,
} from '@/components/video/player-common';
import type { PlayerSource } from '@/components/video/player-common';
import styles from './discover.module.css';

export type PlaybackState =
  'loading' | 'playing' | 'paused' | 'blocked' | 'buffering' | 'slow' | 'error';

export interface FeedPlayerHandle {
  /** Play or pause from a user gesture (tap, Space). */
  toggle: () => void;
  play: () => void;
  pause: () => void;
}

/** Waiting longer than this shows the buffering state; much longer, the poor-network state. */
const BUFFERING_MS = 500;
const SLOW_MS = 4000;

/**
 * One Discover video (Brief 03 Milestone 3D). Only the active and next items mount one, so at most
 * two players hold a source. The active one starts muted when the browser allows autoplay (and
 * reduced motion is off); a refused play() shows the blocked-autoplay state. It pauses when it
 * stops being active and when the tab is hidden, and never resumes on its own. Hotkeys are off:
 * the feed owns the keyboard (shortcuts only while focus is in the feed).
 */
export function FeedPlayer({
  source,
  title,
  active,
  autoplay,
  muted,
  onState,
  handleRef,
}: {
  source: PlayerSource;
  title: string;
  active: boolean;
  /** Start playing when this item becomes active (off for reduced motion). */
  autoplay: boolean;
  muted: boolean;
  onState: (state: PlaybackState) => void;
  handleRef?: Ref<FeedPlayerHandle>;
}) {
  const ref = useRef<MuxPlayerRefAttributes | null>(null);
  const waitTimers = useRef<number[]>([]);
  const onStateRef = useRef(onState);
  useSinglePlayer(ref);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  const clearWait = useCallback(() => {
    for (const timer of waitTimers.current) window.clearTimeout(timer);
    waitTimers.current = [];
  }, []);

  const startPlay = useCallback(
    (fromGesture: boolean) => {
      const player = ref.current;
      if (player === null) return;
      player.muted = muted;
      player.play().catch(() => {
        if (!player.muted && !fromGesture) {
          // Sound was on from an earlier tap, but this browser wants a fresh gesture for sound:
          // try muted before giving up.
          player.muted = true;
          player.play().catch(() => {
            onStateRef.current('blocked');
          });
          return;
        }
        onStateRef.current('blocked');
      });
    },
    [muted],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      toggle: () => {
        const player = ref.current;
        if (player === null) return;
        if (player.paused) startPlay(true);
        else player.pause();
      },
      play: () => {
        startPlay(true);
      },
      pause: () => {
        ref.current?.pause();
      },
    }),
    [startPlay],
  );

  // Active: try to start (when allowed). Not active: pause, at once.
  useEffect(() => {
    const player = ref.current;
    if (player === null) return;
    if (!active) {
      player.pause();
      return;
    }
    if (autoplay && player.readyState >= 1) startPlay(false);
  }, [active, autoplay, startPlay]);

  useEffect(() => {
    if (ref.current !== null) ref.current.muted = muted;
  }, [muted]);

  // Hidden tab: pause. Coming back doesn't resume; the viewer taps to play.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) ref.current?.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearWait();
      // Unmounted (the item left the two-player window): back to the poster.
      onStateRef.current('loading');
    };
  }, [clearWait]);

  const onWaiting = () => {
    if (waitTimers.current.length > 0) return;
    waitTimers.current = [
      window.setTimeout(() => {
        onStateRef.current('buffering');
      }, BUFFERING_MS),
      window.setTimeout(() => {
        onStateRef.current('slow');
      }, SLOW_MS),
    ];
  };

  return (
    <MuxPlayer
      {...PLAYER_DEFAULTS}
      {...sourceProps(source)}
      ref={ref}
      className={styles.player ?? ''}
      title={title}
      nohotkeys
      noMutedPref
      preload={active ? 'auto' : 'metadata'}
      loading="page"
      onLoadedMetadata={() => {
        if (active && autoplay && !document.hidden) startPlay(false);
        else onStateRef.current('paused');
      }}
      onPlay={() => {
        announcePlay(ref.current);
      }}
      onPlaying={() => {
        clearWait();
        onStateRef.current('playing');
      }}
      onPause={() => {
        clearWait();
        onStateRef.current('paused');
      }}
      onWaiting={onWaiting}
      onStalled={onWaiting}
      onError={() => {
        clearWait();
        onStateRef.current('error');
      }}
    />
  );
}

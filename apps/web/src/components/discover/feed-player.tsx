'use client';

import MuxPlayer from '@mux/mux-player-react/lazy';
import type { MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  const reportRef = useRef<((state: PlaybackState) => void) | null>(null);
  const activeRef = useRef(active);
  const autoplayRef = useRef(autoplay);
  useSinglePlayer(ref);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  const clearWait = useCallback(() => {
    for (const timer of waitTimers.current) window.clearTimeout(timer);
    waitTimers.current = [];
  }, []);

  const startPlay = useCallback(
    (fromGesture: boolean, report: (state: PlaybackState) => void) => {
      const player = ref.current;
      if (player === null) return;
      player.muted = muted;
      player.play().catch(() => {
        if (!player.muted && !fromGesture) {
          // Sound was on from an earlier tap, but this browser wants a fresh gesture for sound:
          // try muted before giving up.
          player.muted = true;
          player.play().catch(() => {
            report('blocked');
          });
          return;
        }
        report('blocked');
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
        if (player.paused) startPlay(true, reportRef.current ?? onStateRef.current);
        else player.pause();
      },
      play: () => {
        startPlay(true, reportRef.current ?? onStateRef.current);
      },
      pause: () => {
        ref.current?.pause();
      },
    }),
    [startPlay],
  );

  // The lazy player's element exists only once its code has loaded, and a short local video can
  // be ready before React's props attach, so listen natively and start from its current state.
  const [element, setElement] = useState<MuxPlayerRefAttributes | null>(null);
  const attach = useCallback((node: MuxPlayerRefAttributes | null) => {
    ref.current = node;
    setElement(node);
  }, []);

  useEffect(() => {
    if (element === null) return;
    element.setAttribute('disableremoteplayback', '');
    let blocked = false;
    const report = (state: PlaybackState) => {
      // A refused autoplay stays "blocked" (media-chrome may pause after it) until it plays.
      if (state === 'playing') blocked = false;
      if (blocked && state === 'paused') return;
      if (state === 'blocked') blocked = true;
      onStateRef.current(state);
    };
    const onReady = () => {
      if (activeRef.current && autoplayRef.current && !document.hidden) {
        startPlay(false, report);
      } else {
        report('paused');
      }
    };
    const onWaiting = () => {
      if (waitTimers.current.length > 0) return;
      waitTimers.current = [
        window.setTimeout(() => {
          report('buffering');
        }, BUFFERING_MS),
        window.setTimeout(() => {
          report('slow');
        }, SLOW_MS),
      ];
    };
    const handlers: [string, () => void][] = [
      ['loadedmetadata', onReady],
      [
        'play',
        () => {
          announcePlay(element);
        },
      ],
      [
        'playing',
        () => {
          clearWait();
          report('playing');
        },
      ],
      [
        'pause',
        () => {
          clearWait();
          report('paused');
        },
      ],
      ['waiting', onWaiting],
      ['stalled', onWaiting],
      [
        'error',
        () => {
          clearWait();
          report('error');
        },
      ],
    ];
    for (const [name, handler] of handlers) element.addEventListener(name, handler);
    reportRef.current = report;
    if (element.readyState >= 1) onReady();
    return () => {
      for (const [name, handler] of handlers) element.removeEventListener(name, handler);
      reportRef.current = null;
    };
  }, [element, clearWait, startPlay]);

  // Becoming active: start (when allowed). No longer active: pause at once.
  useEffect(() => {
    activeRef.current = active;
    autoplayRef.current = autoplay;
    if (element === null) return;
    if (!active) {
      element.pause();
      return;
    }
    if (autoplay && element.readyState >= 1 && element.paused) {
      startPlay(false, reportRef.current ?? onStateRef.current);
    }
  }, [active, autoplay, element, startPlay]);

  useEffect(() => {
    if (ref.current !== null) ref.current.muted = muted;
  }, [element, muted]);

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

  return (
    <MuxPlayer
      {...PLAYER_DEFAULTS}
      {...sourceProps(source)}
      ref={attach}
      className={styles.player ?? ''}
      title={title}
      nohotkeys
      noMutedPref
      preload={active ? 'auto' : 'metadata'}
      loading="page"
    />
  );
}

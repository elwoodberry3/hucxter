'use client';

import {
  HANDLE_MESSAGES,
  HANDLE_STATUS_MESSAGES,
  handleProblem,
  normalizeHandle,
} from '@hucxter/contracts';
import type { HandleStatus } from '@hucxter/contracts';
import { useEffect, useRef, useState } from 'react';
import { checkHandle } from '@/app/actions/profile';

const CHECK_DELAY_MS = 400;

export type Tone = 'good' | 'bad' | 'neutral';
export interface HandleNote {
  tone: Tone;
  text: string;
}

const TONES: Record<HandleStatus, Tone> = {
  available: 'good',
  yours: 'neutral',
  taken: 'bad',
  held: 'bad',
  reserved: 'bad',
  invalid: 'bad',
  limited: 'neutral',
};

/**
 * Handle availability as someone types (settings, /welcome reset). Format problems are answered
 * locally; the server is asked after a pause, and only the latest answer counts. Returns null
 * while the field still holds `current`.
 */
export function useHandleCheck(raw: string, current: string | null): HandleNote | null {
  const value = normalizeHandle(raw);
  const unchanged = value === current;
  const problem = unchanged ? null : handleProblem(value);
  const [answer, setAnswer] = useState<{ value: string; note: HandleNote } | null>(null);
  const latest = useRef(0);
  useEffect(() => {
    if (value === current || handleProblem(value) !== null) return;
    const request = ++latest.current;
    const timer = window.setTimeout(() => {
      checkHandle(value).then(
        (status) => {
          if (request !== latest.current) return;
          setAnswer({ value, note: { tone: TONES[status], text: HANDLE_STATUS_MESSAGES[status] } });
        },
        () => {
          if (request !== latest.current) return;
          setAnswer({ value, note: { tone: 'neutral', text: HANDLE_STATUS_MESSAGES.limited } });
        },
      );
    }, CHECK_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, current]);
  if (unchanged) return null;
  if (problem !== null) return { tone: 'bad', text: HANDLE_MESSAGES[problem] };
  return answer?.value === value ? answer.note : { tone: 'neutral', text: 'Checking…' };
}

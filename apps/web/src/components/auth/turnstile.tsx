'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      size: 'flexible';
      appearance: 'interaction-only';
    },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/**
 * Loads Cloudflare's script once. Inserted by our own (nonce-trusted) bundle, so the CSP's
 * 'strict-dynamic' allows it; frame-src allows only challenges.cloudflare.com.
 */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile !== undefined) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.turnstile === undefined) reject(new Error('Turnstile unavailable'));
      else resolve(window.turnstile);
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.append(script);
  });
  return loading;
}

export interface TurnstileHandle {
  /** Tokens are single-use: reset after every submit. */
  reset: () => void;
}

/**
 * Cloudflare Turnstile (D-08), shown only when CAPTCHA_PROVIDER=turnstile. Interaction-only: most
 * people never see a challenge. Reports the token (or null when it expires) to the parent.
 */
export function Turnstile({
  siteKey,
  onToken,
  ref,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widget.current !== null) window.turnstile?.reset(widget.current);
      callback.current(null);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || container.current === null) return;
        widget.current = api.render(container.current, {
          sitekey: siteKey,
          callback: (token) => {
            callback.current(token);
          },
          'expired-callback': () => {
            callback.current(null);
          },
          'error-callback': () => {
            callback.current(null);
          },
          size: 'flexible',
          appearance: 'interaction-only',
        });
      })
      .catch(() => {
        callback.current(null);
      });
    return () => {
      cancelled = true;
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  return <div ref={container} data-testid="turnstile" />;
}

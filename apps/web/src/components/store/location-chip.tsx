'use client';

import { RADIUS_OPTIONS_MI } from '@hucxter/contracts';
import type { RadiusMi } from '@hucxter/contracts';
import { ChevronDown, LocateFixed, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useMemo, useRef, useState, useTransition } from 'react';
import { setLocationByZip, setLocationFromCoordinates } from '@/app/actions/location';
import type { LocationResult } from '@/app/actions/location';
import { track } from '@/lib/analytics';
import { useDismiss } from '@/lib/use-dismiss';
import styles from './location.module.css';

function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export interface ChipLocation {
  zip: string;
  areaLabel: string;
  radiusMi: RadiusMi;
  isGuess: boolean;
  guessSource: 'ip' | 'default' | null;
}

/**
 * Location chip + popover (storefront-ia §1). A guess shows as "Near Celina 75009?" until the
 * viewer confirms or changes it. Saves ZIP + radius only (first-party cookie, server action).
 */
export function LocationChip({
  location,
  defaultRadiusMi,
}: {
  location: ChipLocation | null;
  defaultRadiusMi: RadiusMi;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const refs = useMemo(() => [triggerRef, panelRef], []);
  const id = useId();
  const radius = location?.radiusMi ?? defaultRadiusMi;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, close, refs);

  const finish = (result: LocationResult, source: 'zip' | 'browser') => {
    if (!result.ok) {
      setError(result.error);
      setStatus('');
      return;
    }
    setError('');
    setStatus(`Location set to ${result.areaLabel} ${result.zip}.`);
    track({ name: 'location_changed', zip: result.zip, source });
    close(true);
    router.refresh();
  };

  const label =
    location === null
      ? 'Set your location'
      : `Near ${location.areaLabel} ${location.zip}${location.isGuess ? '?' : ''}`;

  return (
    <div className={styles.anchor}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.chip}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          setError('');
          if (!open) requestAnimationFrame(() => zipRef.current?.focus());
        }}
      >
        <MapPin size={18} aria-hidden="true" />
        <span className={styles.chipText}>
          <span className={styles.chipLabel}>{label}</span>
          <span className={styles.chipAction}>Change</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-label="Your location"
        className={styles.popover}
        hidden={!open}
      >
        {location?.isGuess === true ? (
          <div className={styles.guess}>
            <p>
              {location.guessSource === 'ip' ? 'We guessed ' : 'We’re showing '}
              <strong>
                {location.areaLabel} {location.zip}
              </strong>
              {location.guessSource === 'ip' ? ' from your approximate location.' : ' to start.'} Is
              that your area?
            </p>
            <button
              type="button"
              className={styles.secondary}
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  finish(await setLocationByZip({ zip: location.zip, radiusMi: radius }), 'zip');
                });
              }}
            >
              Yes, use {location.areaLabel}
            </button>
          </div>
        ) : null}

        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(async () => {
              finish(
                await setLocationByZip({
                  zip: formText(data, 'zip'),
                  radiusMi: Number(formText(data, 'radius')),
                }),
                'zip',
              );
            });
          }}
        >
          <label htmlFor={`${id}-zip`} className={styles.label}>
            ZIP code
          </label>
          <input
            ref={zipRef}
            id={`${id}-zip`}
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            pattern="[0-9]{5}"
            defaultValue={location?.zip}
            aria-invalid={error === '' ? undefined : true}
            aria-describedby={error === '' ? undefined : `${id}-error`}
            className={styles.input}
          />
          <label htmlFor={`${id}-radius`} className={styles.label}>
            Distance
          </label>
          <select
            id={`${id}-radius`}
            name="radius"
            defaultValue={String(radius)}
            className={styles.input}
          >
            {RADIUS_OPTIONS_MI.map((miles) => (
              <option key={miles} value={miles}>
                Within {miles} mi
              </option>
            ))}
          </select>
          <button type="submit" className={styles.primary} disabled={pending}>
            Update location
          </button>
        </form>

        <button
          type="button"
          className={styles.locate}
          disabled={pending}
          onClick={() => {
            if (!('geolocation' in navigator)) {
              setError('Your browser can’t share your location. Enter your ZIP code instead.');
              return;
            }
            setStatus('Finding your location…');
            navigator.geolocation.getCurrentPosition(
              (position) => {
                startTransition(async () => {
                  finish(
                    await setLocationFromCoordinates({
                      lat: Math.round(position.coords.latitude * 100) / 100,
                      lon: Math.round(position.coords.longitude * 100) / 100,
                      radiusMi: radius,
                    }),
                    'browser',
                  );
                });
              },
              () => {
                setStatus('');
                setError('We couldn’t get your location. Enter your ZIP code instead.');
              },
              { enableHighAccuracy: false, maximumAge: 600_000, timeout: 10_000 },
            );
          }}
        >
          <LocateFixed size={16} aria-hidden="true" />
          Use my current location
        </button>

        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
        <p className="visually-hidden" role="status">
          {status}
        </p>
        <p className={styles.privacy}>
          We keep only your ZIP code and distance, in a cookie on this browser.
        </p>
      </div>
    </div>
  );
}

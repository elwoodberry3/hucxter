'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { HeroArt } from '@/components/art/hero-art';
import { track } from '@/lib/analytics';
import type { HeroSlide } from '@/lib/house-content';
import styles from './home.module.css';

const ADVANCE_MS = 7000;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/**
 * House hero carousel (storefront-ia §3): up to 3 slides, auto-advance off by default, with a
 * play/pause control. Auto-advance is unavailable under prefers-reduced-motion and pauses while
 * the pointer or focus is inside.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [held, setHeld] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
  const id = useId();
  const count = slides.length;
  const autoAdvancing = playing && !held && !reducedMotion && count > 1;

  useEffect(() => {
    if (!autoAdvancing) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, ADVANCE_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [autoAdvancing, count]);

  if (count === 0) return null;
  const go = (next: number) => {
    setIndex((next + count) % count);
  };

  return (
    <section
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => {
        setHeld(true);
      }}
      onMouseLeave={() => {
        setHeld(false);
      }}
      onFocus={() => {
        setHeld(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      <div className={styles.heroSlides} aria-live={autoAdvancing ? 'off' : 'polite'}>
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.id}
            id={`${id}-slide-${String(slideIndex)}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${String(slideIndex + 1)} of ${String(count)}: ${slide.title}`}
            className={styles.heroSlide}
            hidden={slideIndex !== index}
          >
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>{slide.eyebrow}</p>
              <h2 className={styles.heroTitle}>{slide.title}</h2>
              <p className={styles.heroBody}>{slide.body}</p>
              <Link
                href={slide.cta.href}
                className={styles.heroCta}
                onClick={() => {
                  track({ name: 'hero_clicked', slide: slide.id });
                }}
              >
                {slide.cta.label}
              </Link>
            </div>
            <div className={styles.heroArt}>
              <HeroArt art={slide.art} />
            </div>
          </div>
        ))}
      </div>

      {count > 1 ? (
        <div className={styles.heroControls}>
          {reducedMotion ? null : (
            <button
              type="button"
              className={styles.heroButton}
              aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
              onClick={() => {
                setPlaying((value) => !value);
              }}
            >
              {playing ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            className={styles.heroButton}
            aria-label="Previous slide"
            aria-controls={`${id}-slide-${String(index)}`}
            onClick={() => {
              go(index - 1);
            }}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className={styles.heroDots}>
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                className={styles.heroDot}
                aria-label={`Show slide ${String(slideIndex + 1)}: ${slide.title}`}
                aria-current={slideIndex === index ? 'true' : undefined}
                onClick={() => {
                  go(slideIndex);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.heroButton}
            aria-label="Next slide"
            aria-controls={`${id}-slide-${String(index)}`}
            onClick={() => {
              go(index + 1);
            }}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

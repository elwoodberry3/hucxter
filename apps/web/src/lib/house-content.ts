import type { FeedItem } from '@hucxter/contracts';

/**
 * House (editorial) content for the storefront. Never listings, counts, ratings, or claims about
 * inventory size. Seasonal entries carry date windows; a CMS/table can replace this file later.
 */

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
  art: 'holiday' | 'sell' | 'safety';
  /** Inclusive ISO dates (UTC). Omitted means always on. */
  window?: { start: string; end: string };
}

export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: 'holiday-finds',
    eyebrow: 'Seasonal',
    title: 'Holiday finds near you',
    body: 'Gifts, decor, and party gear from people in your area. Pick it up this week.',
    cta: { label: 'Browse Home & Living', href: '/c/home' },
    art: 'holiday',
    window: { start: '2026-10-15', end: '2027-01-05' },
  },
  {
    id: 'sell-in-seconds',
    eyebrow: 'Selling',
    title: 'Sell it in seconds',
    body: 'Film it, post it, meet up. Your video does the talking.',
    cta: { label: 'Start selling', href: '/sell' },
    art: 'sell',
  },
  {
    id: 'meet-safely',
    eyebrow: 'Safety',
    title: 'Meet safely',
    body: 'Trade in public exchange spots, bring a friend, and check the item before you pay.',
    cta: { label: 'Read meetup tips', href: '/meetup-tips' },
    art: 'safety',
  },
];

/** Slides active on `now` (max 3). */
export function activeSlides(now: Date = new Date()): HeroSlide[] {
  const today = now.toISOString().slice(0, 10);
  return HERO_SLIDES.filter(
    (slide) =>
      slide.window === undefined || (slide.window.start <= today && today <= slide.window.end),
  ).slice(0, 3);
}

export interface HousePromo {
  id: string;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  icon: 'safety' | 'how' | 'sell';
}

export const PROMO_STRIP: readonly HousePromo[] = [
  {
    id: 'safety-tips',
    title: 'Meet in public, every time',
    body: 'Simple habits that make local trades safe for buyers and sellers.',
    href: '/meetup-tips',
    linkLabel: 'Safety tips',
    icon: 'safety',
  },
  {
    id: 'how-it-works',
    title: 'How Hucxter works',
    body: 'Short videos, local buyers, and a quick meetup. No shipping.',
    href: '/how-it-works',
    linkLabel: 'Learn more',
    icon: 'how',
  },
  {
    id: 'first-sale',
    title: 'Make your first sale',
    body: 'What to film, how to price, and how to arrange a pickup.',
    href: '/how-selling-works',
    linkLabel: 'Selling guide',
    icon: 'sell',
  },
];

/**
 * The home feed. Phase I has no listings table, so it holds only the house promo slot that
 * reserves space for FairXchange (D-30). Listing items will be added by Brief 04.
 */
export function homeFeed(): FeedItem[] {
  return [
    {
      type: 'sponsored',
      id: 'house-garage-weekend',
      sponsored: {
        sponsor: { kind: 'house', name: 'Hucxter' },
        headline: 'Clearing out the garage this weekend?',
        body: 'Film each item in a few seconds and let nearby buyers come to you.',
        cta_label: 'See how selling works',
        href: '/how-selling-works',
        art_key: 'misc',
      },
      disclosure: 'Promoted by Hucxter',
      why_shown: 'Hucxter promotes its own features in this spot. It isn’t based on your activity.',
    },
  ];
}

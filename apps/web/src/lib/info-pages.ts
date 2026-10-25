/**
 * Footer pages that don't exist yet. Each renders the "Coming soon" page at its final URL, so links
 * never 404 and won't change when the real page ships.
 */
export interface InfoPage {
  title: string;
  /** One honest sentence about what the page will cover. */
  summary: string;
}

export const INFO_PAGES = {
  'how-it-works': {
    title: 'How Hucxter works',
    summary: 'Film an item, post it, and meet a nearby buyer in a public place.',
  },
  'how-selling-works': {
    title: 'How selling works',
    summary: 'A step-by-step guide to posting a video listing and arranging a safe meetup.',
  },
  'seller-safety': {
    title: 'Seller safety',
    summary: 'Tips for sellers on pricing, messaging, and meeting buyers safely.',
  },
  'meetup-tips': {
    title: 'Meetup tips',
    summary: 'How to meet in public exchange spots, bring a friend, and check items before paying.',
  },
  'report-a-problem': {
    title: 'Report a problem',
    summary: 'A way to report a listing, a member, or a problem with Hucxter.',
  },
  help: { title: 'Help center', summary: 'Answers to common questions about buying and selling.' },
  contact: { title: 'Contact', summary: 'How to reach the Hucxter team.' },
  about: {
    title: 'About Hucxter',
    summary: 'Who we are and why we are building a local marketplace.',
  },
  careers: { title: 'Careers', summary: 'Open roles at Hucxter.' },
  press: { title: 'Press', summary: 'News and media resources.' },
  terms: { title: 'Terms of Service', summary: 'The terms for using Hucxter.' },
  privacy: { title: 'Privacy Policy', summary: 'What data Hucxter collects and how it is used.' },
  'prohibited-items': {
    title: 'Prohibited items',
    summary: 'Items that can’t be listed on Hucxter. The full list is being finalized.',
  },
} as const satisfies Record<string, InfoPage>;

export type InfoPageSlug = keyof typeof INFO_PAGES;

export function infoPage(slug: string): InfoPage | undefined {
  return Object.hasOwn(INFO_PAGES, slug) ? INFO_PAGES[slug as InfoPageSlug] : undefined;
}

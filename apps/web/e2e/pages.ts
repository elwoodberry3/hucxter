/** Every shell page and its expected heading. */
export const PAGES = [
  { path: '/', heading: 'Feed', nav: 'Feed' },
  { path: '/search', heading: 'Search', nav: 'Search' },
  { path: '/sell', heading: 'Sell', nav: 'Sell' },
  { path: '/messages', heading: 'Messages', nav: 'Messages' },
  { path: '/saved', heading: 'Saved', nav: 'Saved' },
  { path: '/listings', heading: 'My Listings', nav: 'My Listings' },
  { path: '/profile', heading: 'Profile', nav: 'Profile' },
  { path: '/admin', heading: 'Admin', nav: null },
] as const;

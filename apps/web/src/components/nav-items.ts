import { Bookmark, CircleUser, House, MessageCircle, Package, Plus, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Primary sidebar destinations (hucxter-design-system § Layout). Admin is role-gated and not listed. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Feed', icon: House },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/sell', label: 'Sell', icon: Plus },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/listings', label: 'My Listings', icon: Package },
  { href: '/profile', label: 'Profile', icon: CircleUser },
];

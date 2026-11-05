'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/** What client UI needs to know about the viewer. No ids, emails, or phone numbers. */
export interface ViewerSummary {
  status: 'guest' | 'unverified' | 'verified';
  displayName: string | null;
  isStaff: boolean;
}

const GUEST: ViewerSummary = { status: 'guest', displayName: null, isStaff: false };
const ViewerContext = createContext<ViewerSummary>(GUEST);

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: ViewerSummary;
  children: ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ViewerSummary {
  return useContext(ViewerContext);
}

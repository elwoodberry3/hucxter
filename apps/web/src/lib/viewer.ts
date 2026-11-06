import 'server-only';
import type { ViewerSummary } from '@/components/auth/viewer-context';
import { loadMember } from '@/server/auth/member';

export type Viewer =
  | { kind: 'guest' }
  | {
      kind: 'member';
      id: string;
      isStaff: boolean;
      verified: boolean;
      displayName: string | null;
      homeZip: string | null;
    };

/** The client-safe summary (no ids) for header, tab bar, and gated buttons. */
export async function getViewerSummary(): Promise<ViewerSummary> {
  const viewer = await getViewer();
  if (viewer.kind === 'guest') return { status: 'guest', displayName: null, isStaff: false };
  return {
    status: viewer.verified ? 'verified' : 'unverified',
    displayName: viewer.displayName,
    isStaff: viewer.isStaff,
  };
}

/** The current viewer for rendering (header, menus). Gates use `requireVerifiedMember()`. */
export async function getViewer(): Promise<Viewer> {
  const member = await loadMember();
  if (member === null) return { kind: 'guest' };
  return {
    kind: 'member',
    id: member.userId,
    isStaff: member.verified && member.isStaff,
    verified: member.verified,
    displayName: member.displayName,
    homeZip: member.homeZip,
  };
}

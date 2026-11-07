import 'server-only';
import type { ViewerSummary } from '@/components/auth/viewer-context';
import { loadMemberForDisplay } from '@/server/auth/member';
import { avatarUrl } from './avatar';

export type Viewer =
  | { kind: 'guest' }
  | {
      kind: 'member';
      id: string;
      isStaff: boolean;
      verified: boolean;
      displayName: string | null;
      handle: string | null;
      avatarPath: string | null;
      homeZip: string | null;
    };

/** The client-safe summary (no ids) for header, tab bar, and gated buttons. */
export async function getViewerSummary(): Promise<ViewerSummary> {
  const viewer = await getViewer();
  if (viewer.kind === 'guest') {
    return { status: 'guest', displayName: null, handle: null, avatarUrl: null, isStaff: false };
  }
  return {
    status: viewer.verified ? 'verified' : 'unverified',
    displayName: viewer.displayName,
    handle: viewer.handle,
    avatarUrl: avatarUrl(viewer.avatarPath),
    isStaff: viewer.isStaff,
  };
}

/** The current viewer for rendering (header, menus). Gates use `requireVerifiedMember()`. */
export async function getViewer(): Promise<Viewer> {
  const member = await loadMemberForDisplay();
  if (member === null) return { kind: 'guest' };
  return {
    kind: 'member',
    id: member.userId,
    isStaff: member.verified && member.isStaff,
    verified: member.verified,
    displayName: member.displayName,
    handle: member.handle,
    avatarPath: member.avatarPath,
    homeZip: member.homeZip,
  };
}

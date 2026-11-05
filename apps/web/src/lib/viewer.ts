import 'server-only';
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

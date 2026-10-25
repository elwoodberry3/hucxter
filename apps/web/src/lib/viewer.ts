import 'server-only';

export type Viewer = { kind: 'guest' } | { kind: 'member'; id: string; isStaff: boolean };

/** The current viewer. Everyone is a guest until accounts ship in Brief 03. */
// eslint-disable-next-line @typescript-eslint/require-await -- reads the session in Brief 03
export async function getViewer(): Promise<Viewer> {
  return { kind: 'guest' };
}

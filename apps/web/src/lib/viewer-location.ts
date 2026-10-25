import 'server-only';
import type { RadiusMi } from '@hucxter/contracts';

export interface ViewerLocation {
  zip: string;
  areaLabel: string;
  radiusMi: RadiusMi;
  /** True until the viewer confirms or changes it (an IP- or default-based guess). */
  isGuess: boolean;
}

/** Viewer location. Implemented with the location chip (Brief 02 step 8). */
// eslint-disable-next-line @typescript-eslint/require-await -- becomes async with the cookie lookup
export async function getViewerLocation(): Promise<ViewerLocation | null> {
  return null;
}

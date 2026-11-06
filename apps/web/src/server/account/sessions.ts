import 'server-only';
import { z } from 'zod';
import { sessionClient } from '../supabase-server';
import { deviceLabel } from './device-label';

const SessionRows = z.array(
  z.object({
    id: z.string(),
    created_at: z.string(),
    user_agent: z.string().nullable(),
    is_current: z.boolean(),
  }),
);

export interface SessionSummary {
  id: string;
  device: string;
  createdAt: string;
  isCurrent: boolean;
}

/** The member's active sessions: device label and created time only (no IP). */
export async function listMySessions(): Promise<SessionSummary[]> {
  const supabase = await sessionClient();
  const result = await supabase.rpc('my_sessions');
  if (result.error !== null) return [];
  return SessionRows.parse(result.data).map((row) => ({
    id: row.id,
    device: deviceLabel(row.user_agent),
    createdAt: row.created_at,
    isCurrent: row.is_current,
  }));
}

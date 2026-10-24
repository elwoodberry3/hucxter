import { z } from 'zod';

/** Body of `GET /api/health`. Exposes nothing beyond status, app version and git commit. */
export const HealthResponse = z
  .object({
    status: z.literal('ok'),
    version: z.string().min(1),
    commit: z.string().min(1),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponse>;

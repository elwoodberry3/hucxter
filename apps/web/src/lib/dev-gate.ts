import 'server-only';
import { notFound } from 'next/navigation';
import { serverConfig } from './env';

/** True where /dev routes and demo fixtures may render (local and QA only). */
export function devRoutesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !serverConfig(env).isProduction;
}

/** 404s unless /dev routes are enabled. Fails closed if config can't be read. */
export function assertDevRoutesEnabled(): void {
  let enabled: boolean;
  try {
    enabled = devRoutesEnabled();
  } catch {
    enabled = false;
  }
  if (!enabled) notFound();
}

import { deleteE2eUsers } from './helpers/accounts';

/** Removes leftover e2e accounts (local stack only, e2e addresses only) so test numbers are free. */
export default async function globalSetup(): Promise<void> {
  await deleteE2eUsers();
}

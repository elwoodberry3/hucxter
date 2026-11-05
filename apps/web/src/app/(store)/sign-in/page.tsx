import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Sign in' };

// Signed-in members are sent on to `next` (verified) or /welcome (AuthPage).
export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { next, error } = await searchParams;
  return <AuthPage mode="sign-in" next={next} error={error} />;
}

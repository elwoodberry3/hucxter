import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Sign in' };

// Members will be redirected to `next` (or /) here once accounts exist (Brief 03).
export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { next } = await searchParams;
  return <AuthPage mode="sign-in" next={next} />;
}

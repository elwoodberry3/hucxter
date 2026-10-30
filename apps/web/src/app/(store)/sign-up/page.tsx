import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  const { next } = await searchParams;
  return <AuthPage mode="sign-up" next={next} />;
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/env';
import { authHref, safeNextPath } from '@/lib/next-path';
import { destinationAfterSignIn } from '@/server/auth/destination';
import { CLOSED_TEST_MESSAGE, GOOGLE_FAILED } from '@/server/auth/errors';
import { loadMemberForDisplay } from '@/server/auth/member';
import { AuthMethods } from './auth-methods';
import styles from './auth.module.css';

const ERROR_COPY: Record<string, string> = {
  cancelled: 'Google sign-in was cancelled. Choose a way to continue.',
  failed: GOOGLE_FAILED,
};

/** Shared layout for /sign-in and /sign-up: Continue with Google · Continue with email (D-34). */
export async function AuthPage({
  mode,
  next,
  error,
}: {
  mode: 'sign-in' | 'sign-up';
  next: unknown;
  error: unknown;
}) {
  const safeNext = safeNextPath(next);
  // Already signed in: carry on (verified → next, otherwise onboarding).
  const member = await loadMemberForDisplay();
  if (member !== null) redirect(destinationAfterSignIn(member, safeNext));

  const { captcha } = authConfig();
  const signUp = mode === 'sign-up';
  const closedTest = error === 'closed_test';
  const errorCopy = typeof error === 'string' ? (ERROR_COPY[error] ?? null) : null;

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        <h1 id="auth-title" className={styles.title}>
          {signUp ? 'Create your Hucxter account' : 'Sign in to Hucxter'}
        </h1>
        {closedTest ? (
          <p role="alert" className={styles.closed}>
            {CLOSED_TEST_MESSAGE}
          </p>
        ) : (
          <>
            <p className={styles.lede}>
              {signUp
                ? 'An account lets you message sellers, save items, and sell to people nearby.'
                : 'Sign in to message sellers, save items, and sell.'}
              {safeNext === null ? '' : ' You’ll come back to where you were afterwards.'}
            </p>
            <AuthMethods
              next={safeNext}
              captchaSiteKey={captcha.provider === 'turnstile' ? captcha.siteKey : null}
              initialError={errorCopy}
            />
          </>
        )}
        {signUp ? (
          <ul className={styles.requirements}>
            <li>You’ll confirm your email and your phone number by text message.</li>
            <li>You must be 18 or older.</li>
            <li>We’ll ask for your home ZIP code to show items near you.</li>
          </ul>
        ) : null}
        <p className={styles.switch}>
          {signUp ? 'Already have an account? ' : 'New here? '}
          <Link href={authHref(safeNext, signUp ? '/sign-in' : '/sign-up')}>
            {signUp ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </div>
  );
}

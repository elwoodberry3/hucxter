import Link from 'next/link';
import { AuthMethods } from './auth-methods';
import styles from './auth.module.css';
import { authHref, safeNextPath } from '@/lib/next-path';

/** Shared layout for /sign-in and /sign-up (UI only until Brief 03). */
export function AuthPage({ mode, next }: { mode: 'sign-in' | 'sign-up'; next: unknown }) {
  const safeNext = safeNextPath(next);
  const signUp = mode === 'sign-up';
  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        <h1 id="auth-title" className={styles.title}>
          {signUp ? 'Create your Hucxter account' : 'Sign in to Hucxter'}
        </h1>
        <p className={styles.lede}>
          {signUp
            ? 'An account lets you message sellers, save items, and sell to people nearby.'
            : 'Sign in to message sellers, save items, and sell.'}
          {safeNext === null ? '' : ' You’ll come back to where you were afterwards.'}
        </p>
        <AuthMethods />
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

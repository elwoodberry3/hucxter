import { ONBOARDING_STEPS } from '@hucxter/contracts';
import type { OnboardingStep } from '@hucxter/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/actions/account';
import { ResetStep } from '@/components/onboarding/reset-step';
import { AgeStep, NameStep, PhoneStep, ZipStep } from '@/components/onboarding/steps';
import styles from '@/components/auth/auth.module.css';
import { authConfig } from '@/lib/env';
import { safeNextPath } from '@/lib/next-path';
import { getViewerLocation } from '@/lib/viewer-location';
import { CLOSED_TEST_MESSAGE } from '@/server/auth/errors';
import { requireSignedIn } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Finish setting up', robots: { index: false } };

const TITLES: Record<OnboardingStep, string> = {
  phone: 'Verify your phone',
  age: 'Confirm your age',
  zip: 'Set your home ZIP',
  name: 'Choose a display name',
};

const LEDES: Record<OnboardingStep, string> = {
  phone: 'Every Hucxter member verifies a mobile number. It keeps the marketplace local and real.',
  age: 'Hucxter is for adults.',
  zip: 'Your home ZIP sets where we look for items by default.',
  name: 'This is how buyers and sellers will see you.',
};

/**
 * Onboarding gate (D-34): phone → 18+ → home ZIP → display name, one step per screen. Resumable:
 * the step comes from the server's view of the account, so reloads and returning later land on the
 * right step. When done, returns to the safe `next`. A staff-required reset (Brief 03C.2) asks for
 * a new display name and handle instead.
 */
export default async function WelcomePage({ searchParams }: PageProps<'/welcome'>) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  const member = await requireSignedIn(next ?? '/');
  if (member.nextStep === null) redirect(next ?? '/');

  if (member.nextStep === 'closed_test') {
    return (
      <div className={styles.page}>
        <section className={styles.card} aria-labelledby="welcome-title">
          <h1 id="welcome-title" className={styles.title}>
            Closed test
          </h1>
          <p role="alert" className={styles.closed}>
            {CLOSED_TEST_MESSAGE}
          </p>
          <form action={signOut}>
            <button type="submit" className={styles.secondaryButton}>
              Sign out
            </button>
          </form>
        </section>
      </div>
    );
  }

  if (member.nameResetRequired && member.nextStep === 'name') {
    return (
      <div className={styles.page}>
        <section className={styles.card} aria-labelledby="welcome-title">
          <h1 id="welcome-title" className={styles.title}>
            Choose a new name and handle
          </h1>
          <p className={styles.lede}>
            Our team reset your display name and handle because they didn’t follow the community
            guidelines. Choose new ones to keep using Hucxter.
          </p>
          <ResetStep next={next} />
        </section>
      </div>
    );
  }

  const step = member.nextStep;
  const index = ONBOARDING_STEPS.indexOf(step);
  const { captcha } = authConfig();
  const location = step === 'zip' ? await getViewerLocation() : null;

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="welcome-title">
        <p className={styles.progress}>
          Step {index + 1} of {ONBOARDING_STEPS.length}
        </p>
        <ol className={styles.steps} aria-hidden="true">
          {ONBOARDING_STEPS.map((name, i) => (
            <li key={name} data-done={i <= index ? 'true' : undefined} />
          ))}
        </ol>
        <h1 id="welcome-title" className={styles.title}>
          {TITLES[step]}
        </h1>
        <p className={styles.lede}>{LEDES[step]}</p>
        {step === 'phone' ? (
          <PhoneStep
            next={next}
            captchaSiteKey={captcha.provider === 'turnstile' ? captcha.siteKey : null}
          />
        ) : null}
        {step === 'age' ? <AgeStep next={next} /> : null}
        {step === 'zip' ? (
          <ZipStep next={next} initialZip={member.homeZip ?? location?.zip ?? ''} />
        ) : null}
        {step === 'name' ? <NameStep next={next} initialName={member.displayName ?? ''} /> : null}
      </section>
    </div>
  );
}

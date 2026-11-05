import type { OnboardingStep } from '@hucxter/contracts';

/** What the server knows about a signed-in member (D-34). No email or phone number. */
export interface MemberState {
  userId: string;
  emailConfirmed: boolean;
  phoneVerified: boolean;
  ageAttested: boolean;
  homeZip: string | null;
  displayName: string | null;
  /** False only when INVITE_ONLY is on and the account email isn't invited. */
  invited: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  /** Verified = email confirmed + phone verified + 18+ + home ZIP (+ invited when invite-only). */
  verified: boolean;
  /** The next /welcome step, `closed_test` for an uninvited account, or null when done. */
  nextStep: OnboardingStep | 'closed_test' | null;
}

export interface VerificationInput {
  userId: string;
  emailConfirmedAt: string | null;
  phoneConfirmedAt: string | null;
  phone: string | null;
  profile: { displayName: string | null; homeZip: string | null; ageAttestedAt: string | null };
  roles: string[];
  invited: boolean;
  inviteOnly: boolean;
}

/** Pure: derives verification and the next onboarding step. */
export function verificationState(input: VerificationInput): MemberState {
  const invited = !input.inviteOnly || input.invited;
  const emailConfirmed = input.emailConfirmedAt !== null;
  const phoneVerified =
    input.phoneConfirmedAt !== null && input.phone !== null && input.phone !== '';
  const ageAttested = input.profile.ageAttestedAt !== null;
  const homeZip = input.profile.homeZip;
  const verified = invited && emailConfirmed && phoneVerified && ageAttested && homeZip !== null;

  let nextStep: MemberState['nextStep'] = null;
  if (!invited) nextStep = 'closed_test';
  else if (!phoneVerified) nextStep = 'phone';
  else if (!ageAttested) nextStep = 'age';
  else if (homeZip === null) nextStep = 'zip';
  else if (input.profile.displayName === null) nextStep = 'name';

  const isAdmin = input.roles.includes('admin');
  return {
    userId: input.userId,
    emailConfirmed,
    phoneVerified,
    ageAttested,
    homeZip,
    displayName: input.profile.displayName,
    invited,
    isStaff: isAdmin || input.roles.includes('moderator'),
    isAdmin,
    verified,
    nextStep,
  };
}

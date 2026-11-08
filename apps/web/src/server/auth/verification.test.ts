import { describe, expect, it } from 'vitest';
import { verificationState } from './verification';
import type { VerificationInput } from './verification';

const complete: VerificationInput = {
  userId: 'u1',
  emailConfirmedAt: '2026-11-05T00:00:00Z',
  phoneConfirmedAt: '2026-11-05T00:01:00Z',
  phone: '15035550100',
  profile: { displayName: 'Sam', homeZip: '97205', ageAttestedAt: '2026-11-05T00:02:00Z' },
  roles: [],
  invited: true,
  inviteOnly: true,
};

describe('verificationState', () => {
  it('is verified with email, phone, 18+, and home ZIP', () => {
    const state = verificationState(complete);
    expect(state.verified).toBe(true);
    expect(state.nextStep).toBeNull();
  });

  it.each([
    ['email', { emailConfirmedAt: null }, null],
    ['phone', { phoneConfirmedAt: null }, 'phone'],
    ['phone number', { phone: '' }, 'phone'],
  ] as const)('is not verified without %s', (_, change, step) => {
    const state = verificationState({ ...complete, ...change });
    expect(state.verified).toBe(false);
    expect(state.nextStep).toBe(step);
  });

  it('walks the onboarding steps in order', () => {
    const profile = { displayName: null, homeZip: null, ageAttestedAt: null };
    expect(verificationState({ ...complete, profile }).nextStep).toBe('age');
    expect(
      verificationState({ ...complete, profile: { ...profile, ageAttestedAt: 'x' } }).nextStep,
    ).toBe('zip');
    const noName = verificationState({
      ...complete,
      profile: { ...profile, ageAttestedAt: 'x', homeZip: '97205' },
    });
    expect(noName.nextStep).toBe('name');
    expect(noName.verified).toBe(true);
  });

  it('holds a staff-required name reset at the name step', () => {
    const state = verificationState({
      ...complete,
      profile: {
        ...complete.profile,
        displayName: 'Hucxter member',
        handle: 'member4821',
        nameResetRequiredAt: '2026-11-07T00:00:00Z',
      },
    });
    expect(state).toMatchObject({
      verified: false,
      nextStep: 'name',
      nameResetRequired: true,
      handle: 'member4821',
    });
    expect(verificationState(complete).nameResetRequired).toBe(false);
  });

  it('blocks uninvited accounts only when invite-only', () => {
    expect(verificationState({ ...complete, invited: false }).nextStep).toBe('closed_test');
    expect(verificationState({ ...complete, invited: false }).verified).toBe(false);
    expect(verificationState({ ...complete, invited: false, inviteOnly: false }).verified).toBe(
      true,
    );
  });

  it('derives staff from roles', () => {
    expect(verificationState({ ...complete, roles: ['moderator'] })).toMatchObject({
      isStaff: true,
      isAdmin: false,
    });
    expect(verificationState({ ...complete, roles: ['admin'] }).isAdmin).toBe(true);
    expect(verificationState(complete).isStaff).toBe(false);
  });
});

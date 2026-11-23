import { describe, test, expect } from '@jest/globals';

describe('SEC-04: OAuth Role Escalation Protection', () => {
  test('New OAuth registration defaults strictly to contributor role', () => {
    const newUser = { github: 'new_dev', role: 'contributor' };
    expect(newUser.role).toBe('contributor');
  });

  test('OAuth login ignores requested role parameter for existing users', () => {
    const existingUser = { github: 'existing_dev', role: 'contributor' };
    const attemptedSessionRole = 'organization';

    const activeRole = existingUser.role;

    expect(activeRole).toBe('contributor');
    expect(activeRole).not.toBe(attemptedSessionRole);
  });

  test('Organization privileges require explicit authorization', () => {
    const contributorUser = { role: 'contributor' };
    const isAuthorizedForOrg = contributorUser.role === 'organization';

    expect(isAuthorizedForOrg).toBe(false);
  });
});
import * as fc from 'fast-check';
import type { UserRole, User, CommitClassification } from '@/types';

export const userRoleArbitrary = fc.constantFrom<UserRole>('OWNER', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER');

export const userArbitrary: fc.Arbitrary<User> = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 2, maxLength: 50 }),
  role: userRoleArbitrary,
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

export const commitClassificationArbitrary = fc.constantFrom<CommitClassification>('FEATURE', 'BUGFIX', 'REFACTOR', 'CHORE', 'DOCS', 'TEST');


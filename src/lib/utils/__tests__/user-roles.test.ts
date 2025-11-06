import { describe, it, expect } from 'vitest';
import { getUserDisplayRoles, getUserCoaches } from '../user-roles';
import { User, Role } from '@/types/user';
import { CoachingRelationshipWithUserNames } from '@/types/coaching_relationship';
import { DateTime } from 'ts-luxon';

describe('getUserDisplayRoles', () => {
  const now = DateTime.now();
  const organizationId = 'org-123';

  const createUser = (roles: Array<{ role: Role; organization_id: string | null }>): User => ({
    id: 'user-1',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    display_name: 'Test User',
    timezone: 'UTC',
    role: Role.User, // deprecated field
    roles: roles.map((r, idx) => ({
      id: `role-${idx}`,
      user_id: 'user-1',
      role: r.role,
      organization_id: r.organization_id,
      created_at: now.toISO(),
      updated_at: now.toISO(),
    })),
  });

  const createRelationship = (
    coach_id: string,
    coachee_id: string
  ): CoachingRelationshipWithUserNames => ({
    id: `rel-${coach_id}-${coachee_id}`,
    coach_id,
    coachee_id,
    organization_id: organizationId,
    coach_first_name: 'Coach',
    coach_last_name: 'Name',
    coachee_first_name: 'Coachee',
    coachee_last_name: 'Name',
    created_at: now,
    updated_at: now,
  });

  it('should return organization-specific role for a user', () => {
    const user = createUser([{ role: Role.Admin, organization_id: organizationId }]);
    const roles = getUserDisplayRoles(user, organizationId, []);

    expect(roles).toEqual(['Admin']);
  });

  it('should return SuperAdmin role when organization_id is null', () => {
    const user = createUser([{ role: Role.SuperAdmin, organization_id: null }]);
    const roles = getUserDisplayRoles(user, organizationId, []);

    expect(roles).toEqual(['SuperAdmin']);
  });

  it('should combine organization role and coaching roles', () => {
    const user = createUser([{ role: Role.Admin, organization_id: organizationId }]);
    const relationships = [createRelationship('user-1', 'user-2')];
    const roles = getUserDisplayRoles(user, organizationId, relationships);

    expect(roles).toEqual(['Admin', 'Coach']);
  });

  it('should include both Coach and Coachee roles', () => {
    const user = createUser([{ role: Role.User, organization_id: organizationId }]);
    const relationships = [
      createRelationship('user-1', 'user-2'), // user is coach
      createRelationship('user-3', 'user-1'), // user is coachee
    ];
    const roles = getUserDisplayRoles(user, organizationId, relationships);

    expect(roles).toEqual(['Coach', 'Coachee', 'User']);
  });

  it('should return roles in alphabetical order', () => {
    const user = createUser([
      { role: Role.SuperAdmin, organization_id: null },
      { role: Role.Admin, organization_id: organizationId },
    ]);
    const relationships = [
      createRelationship('user-1', 'user-2'),
      createRelationship('user-3', 'user-1'),
    ];
    const roles = getUserDisplayRoles(user, organizationId, relationships);

    expect(roles).toEqual(['Admin', 'Coach', 'Coachee', 'SuperAdmin']);
  });

  it('should not duplicate roles', () => {
    const user = createUser([{ role: Role.Admin, organization_id: organizationId }]);
    const relationships = [
      createRelationship('user-1', 'user-2'),
      createRelationship('user-1', 'user-3'), // user is coach in multiple relationships
    ];
    const roles = getUserDisplayRoles(user, organizationId, relationships);

    expect(roles).toEqual(['Admin', 'Coach']);
  });

  it('should return empty array when user has no roles in organization', () => {
    const user = createUser([{ role: Role.User, organization_id: 'other-org' }]);
    const roles = getUserDisplayRoles(user, organizationId, []);

    expect(roles).toEqual([]);
  });

  it('should handle user with no roles array', () => {
    const user = createUser([]);
    const roles = getUserDisplayRoles(user, organizationId, []);

    expect(roles).toEqual([]);
  });
});

describe('getUserCoaches', () => {
  const now = DateTime.now();
  const organizationId = 'org-123';

  const createRelationship = (
    coach_id: string,
    coachee_id: string,
    coach_first: string,
    coach_last: string
  ): CoachingRelationshipWithUserNames => ({
    id: `rel-${coach_id}-${coachee_id}`,
    coach_id,
    coachee_id,
    organization_id: organizationId,
    coach_first_name: coach_first,
    coach_last_name: coach_last,
    coachee_first_name: 'Coachee',
    coachee_last_name: 'Name',
    created_at: now,
    updated_at: now,
  });

  it('should return coach names for a user with one coach', () => {
    const relationships = [createRelationship('coach-1', 'user-1', 'John', 'Doe')];
    const coaches = getUserCoaches('user-1', relationships);

    expect(coaches).toEqual(['John Doe']);
  });

  it('should return multiple coach names for a user with multiple coaches', () => {
    const relationships = [
      createRelationship('coach-1', 'user-1', 'John', 'Doe'),
      createRelationship('coach-2', 'user-1', 'Jane', 'Smith'),
    ];
    const coaches = getUserCoaches('user-1', relationships);

    expect(coaches).toEqual(['John Doe', 'Jane Smith']);
  });

  it('should return empty array when user has no coaches', () => {
    const relationships = [createRelationship('user-1', 'coachee-1', 'John', 'Doe')];
    const coaches = getUserCoaches('user-1', relationships);

    expect(coaches).toEqual([]);
  });

  it('should return empty array when relationships array is empty', () => {
    const coaches = getUserCoaches('user-1', []);

    expect(coaches).toEqual([]);
  });

  it('should not include relationships where user is the coach', () => {
    const relationships = [
      createRelationship('user-1', 'coachee-1', 'User', 'One'), // user is coach
      createRelationship('coach-1', 'user-1', 'John', 'Doe'), // user is coachee
    ];
    const coaches = getUserCoaches('user-1', relationships);

    expect(coaches).toEqual(['John Doe']);
  });
});

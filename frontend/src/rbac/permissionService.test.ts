import { describe, it, expect } from 'vitest';
import { permissionService } from './permissionService';
import type { PermissionString } from './types';

describe('RBAC Permission Matrix & Fail-Closed Security', () => {
  it('fails closed when role is null or undefined', () => {
    const nullPerm = permissionService.hasPermission(null, 'organization:view');
    expect(nullPerm.hasPermission).toBe(false);
    expect(nullPerm.reason).toContain('User has no assigned role');

    const undefPerm = permissionService.hasPermission(undefined, 'organization:view');
    expect(undefPerm.hasPermission).toBe(false);

    expect(permissionService.hasRole(null, 'DEVELOPER')).toBe(false);
    expect(permissionService.hasRole(undefined, 'DEVELOPER')).toBe(false);
    expect(permissionService.hasAnyRole(null, ['DEVELOPER', 'ADMIN'])).toBe(false);
  });

  it('grants wildcard permissions to OWNER', () => {
    const res = permissionService.hasPermission('OWNER', 'dashboard:read' as PermissionString);
    expect(res.hasPermission).toBe(true);
    expect(permissionService.hasRole('OWNER', 'ADMIN')).toBe(true);
    expect(permissionService.hasRole('OWNER', 'OWNER')).toBe(true);
  });

  it('restricts admin/delete permissions for DEVELOPER', () => {
    const res = permissionService.hasPermission('DEVELOPER', 'organization:delete' as PermissionString);
    expect(res.hasPermission).toBe(false);
  });

  it('enforces Admin boundary: Admin cannot edit integrations or delete organization', () => {
    const orgDel = permissionService.hasPermission('ADMIN', 'organization:delete' as PermissionString);
    expect(orgDel.hasPermission).toBe(false);

    const intEdit = permissionService.hasPermission('ADMIN', 'integrations:edit' as PermissionString);
    expect(intEdit.hasPermission).toBe(false);

    const intView = permissionService.hasPermission('ADMIN', 'integrations:view' as PermissionString);
    expect(intView.hasPermission).toBe(true);
  });

  it('evaluates role hierarchy correctly for valid roles', () => {
    expect(permissionService.hasRole('ADMIN', 'DEVELOPER')).toBe(true);
    expect(permissionService.hasRole('TEAM_LEAD', 'DEVELOPER')).toBe(true);
    expect(permissionService.hasRole('DEVELOPER', 'TEAM_LEAD')).toBe(false);
    expect(permissionService.hasRole('DEVELOPER', 'ADMIN')).toBe(false);
  });
});

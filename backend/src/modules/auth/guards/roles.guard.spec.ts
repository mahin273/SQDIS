import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let permissionCache: {
    getCachedPermission: jest.Mock;
    setCachedPermission: jest.Mock;
  };
  let auditLog: { logPermissionCheck: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    permissionCache = {
      getCachedPermission: jest.fn().mockResolvedValue(null),
      setCachedPermission: jest.fn(),
    };
    auditLog = { logPermissionCheck: jest.fn() };
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      permissionCache as any,
      auditLog as any,
    );
  });

  function contextWithUser(user: any): ExecutionContext {
    function handler() {}
    class TestController {}

    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows routes with no required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextWithUser(undefined))).resolves.toBe(true);
  });

  it('denies missing users when roles are required', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    await expect(guard.canActivate(contextWithUser(undefined))).resolves.toBe(false);
  });

  it('allows higher hierarchy roles and caches/logs the decision', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.TEAM_LEAD]);
    const user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: Role.ADMIN,
    };

    await expect(guard.canActivate(contextWithUser(user))).resolves.toBe(true);

    expect(permissionCache.setCachedPermission).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      'roles:TEAM_LEAD:TestController:handler',
      true,
    );
    expect(auditLog.logPermissionCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        granted: true,
        requiredRole: Role.TEAM_LEAD,
        userRole: Role.ADMIN,
      }),
    );
  });

  it('uses cached permission decisions when available', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    permissionCache.getCachedPermission.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contextWithUser({ id: 'user-1', organizationId: 'org-1', role: Role.OWNER }),
      ),
    ).resolves.toBe(false);
    expect(permissionCache.setCachedPermission).not.toHaveBeenCalled();
  });
});

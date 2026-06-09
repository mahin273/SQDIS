import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationGuard } from './organization.guard';

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let organizationsService: { isUserMember: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    organizationsService = { isUserMember: jest.fn() };
    guard = new OrganizationGuard(reflector as unknown as Reflector, organizationsService as any);
  });

  function contextWithRequest(request: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('throws when no authenticated user is present', async () => {
    await expect(guard.canActivate(contextWithRequest({}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows non-organization-specific requests', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextWithRequest({ user: { id: 'user-1' } }))).resolves.toBe(
      true,
    );
    expect(organizationsService.isUserMember).not.toHaveBeenCalled();
  });

  it('checks membership using the decorated organization id', async () => {
    reflector.getAllAndOverride.mockReturnValue('org-1');
    organizationsService.isUserMember.mockResolvedValue(true);
    const request = { user: { id: 'user-1' }, params: { organizationId: 'ignored' } };

    await expect(guard.canActivate(contextWithRequest(request))).resolves.toBe(true);

    expect(organizationsService.isUserMember).toHaveBeenCalledWith('org-1', 'user-1');
    expect(request.organizationId).toBe('org-1');
  });

  it('throws when the user is not an organization member', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    organizationsService.isUserMember.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contextWithRequest({ user: { id: 'user-1' }, params: { organizationId: 'org-1' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

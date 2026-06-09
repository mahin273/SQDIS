import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TeamLeadOrAdminGuard } from './team-lead-or-admin.guard';

describe('TeamLeadOrAdminGuard', () => {
  let teamsService: { isTeamLead: jest.Mock };
  let guard: TeamLeadOrAdminGuard;

  beforeEach(() => {
    teamsService = { isTeamLead: jest.fn() };
    guard = new TeamLeadOrAdminGuard(teamsService as any);
  });

  function contextWithRequest(request: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  it('denies missing users', async () => {
    await expect(guard.canActivate(contextWithRequest({ params: { id: 'team-1' } }))).resolves.toBe(
      false,
    );
  });

  it('requires a team id parameter', async () => {
    await expect(
      guard.canActivate(contextWithRequest({ user: { id: 'user-1', role: Role.ADMIN }, params: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admins and owners without checking team lead status', async () => {
    await expect(
      guard.canActivate(
        contextWithRequest({ user: { id: 'user-1', role: Role.ADMIN }, params: { id: 'team-1' } }),
      ),
    ).resolves.toBe(true);
    expect(teamsService.isTeamLead).not.toHaveBeenCalled();
  });

  it('allows team leads and denies other developers', async () => {
    teamsService.isTeamLead.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      guard.canActivate(
        contextWithRequest({
          user: { id: 'lead-1', role: Role.TEAM_LEAD },
          params: { id: 'team-1' },
        }),
      ),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        contextWithRequest({
          user: { id: 'dev-1', role: Role.DEVELOPER },
          params: { id: 'team-1' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalTemplatesService } from './services/goal-templates.service';
import { GoalAchievementService } from './services/goal-achievement.service';
import { GoalHistoryService } from './services/goal-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('GoalsController Tenant Context Isolation & RBAC', () => {
  let controller: GoalsController;
  let historyService: jest.Mocked<Partial<GoalHistoryService>>;
  let goalsService: jest.Mocked<Partial<GoalsService>>;
  let reflector: Reflector;

  beforeEach(async () => {
    historyService = {
      getGoalHistory: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      calculateAchievementRateOverTime: jest.fn().mockResolvedValue([]),
      calculateTeamAchievementPercentages: jest.fn().mockResolvedValue([]),
      getGoalHistoryForReports: jest.fn().mockResolvedValue({ summary: {} }),
      snapshotGoal: jest.fn().mockResolvedValue({} as any),
    };

    goalsService = {
      findById: jest.fn().mockResolvedValue({ id: 'goal-1', organizationId: 'active-org' } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [
        { provide: GoalsService, useValue: goalsService },
        { provide: GoalTemplatesService, useValue: {} },
        { provide: GoalAchievementService, useValue: {} },
        { provide: GoalHistoryService, useValue: historyService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GoalsController>(GoalsController);
    reflector = module.get<Reflector>(Reflector);
  });

  const mockRequestWithSwitchedTenant = {
    user: { id: 'user-1', organizationId: 'default-jwt-org' },
    organizationId: 'active-switched-org',
    headers: { 'x-organization-id': 'active-switched-org' },
  };

  it('getSnapshots uses active organizationId instead of stale JWT organizationId', async () => {
    await controller.getSnapshots(mockRequestWithSwitchedTenant, { teamId: 'team-1' });

    expect(historyService.getGoalHistory).toHaveBeenCalledWith(
      'active-switched-org',
      expect.objectContaining({ teamId: 'team-1' }),
    );
  });

  it('getAchievementRate uses active organizationId instead of stale JWT organizationId', async () => {
    await controller.getAchievementRate(mockRequestWithSwitchedTenant, 'team-1', 6);

    expect(historyService.calculateAchievementRateOverTime).toHaveBeenCalledWith(
      'active-switched-org',
      'team-1',
      6,
    );
  });

  it('getTeamComparison uses active organizationId instead of stale JWT organizationId', async () => {
    await controller.getTeamComparison(mockRequestWithSwitchedTenant);

    expect(historyService.calculateTeamAchievementPercentages).toHaveBeenCalledWith(
      'active-switched-org',
      undefined,
      undefined,
    );
  });

  it('getHistoryForReports uses active organizationId instead of stale JWT organizationId', async () => {
    await controller.getHistoryForReports(mockRequestWithSwitchedTenant, 'team-1');

    expect(historyService.getGoalHistoryForReports).toHaveBeenCalledWith(
      'active-switched-org',
      expect.objectContaining({ teamId: 'team-1' }),
    );
  });

  it('snapshotGoal verifies goal against active organizationId before snapshotting', async () => {
    await controller.snapshotGoal(mockRequestWithSwitchedTenant, 'goal-1');

    expect(goalsService.findById).toHaveBeenCalledWith('goal-1', 'active-switched-org');
    expect(historyService.snapshotGoal).toHaveBeenCalledWith('goal-1');
  });

  describe('RBAC Route Guard Metadata', () => {
    it('restricts goal creation to OWNER, ADMIN, and TEAM_LEAD', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.create);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN, Role.TEAM_LEAD]);
    });

    it('restricts goal updating to OWNER, ADMIN, and TEAM_LEAD', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.update);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN, Role.TEAM_LEAD]);
    });

    it('restricts goal deletion to OWNER and ADMIN only', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.delete);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN]);
    });

    it('restricts key result additions to OWNER, ADMIN, and TEAM_LEAD', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.addKeyResult);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN, Role.TEAM_LEAD]);
    });

    it('restricts key result updates to OWNER, ADMIN, and TEAM_LEAD', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.updateKeyResult);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN, Role.TEAM_LEAD]);
    });

    it('restricts key result deletions to OWNER, ADMIN, and TEAM_LEAD', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.deleteKeyResult);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN, Role.TEAM_LEAD]);
    });

    it('restricts goal template creation to OWNER, ADMIN, and TEAM_LEAD', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.createTemplate);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN, Role.TEAM_LEAD]);
    });

    it('restricts goal template deletion to OWNER and ADMIN only', () => {
      const roles = reflector.get<Role[]>(ROLES_KEY, controller.deleteTemplate);
      expect(roles).toEqual([Role.OWNER, Role.ADMIN]);
    });
  });
});

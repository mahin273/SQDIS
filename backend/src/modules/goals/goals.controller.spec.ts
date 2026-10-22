import { Test, TestingModule } from '@nestjs/testing';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalTemplatesService } from './services/goal-templates.service';
import { GoalAchievementService } from './services/goal-achievement.service';
import { GoalHistoryService } from './services/goal-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';

describe('GoalsController Tenant Context Isolation', () => {
  let controller: GoalsController;
  let historyService: jest.Mocked<Partial<GoalHistoryService>>;
  let goalsService: jest.Mocked<Partial<GoalsService>>;

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
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GoalsController>(GoalsController);
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
});

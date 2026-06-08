import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComparisonOp, GoalStatus, MetricType } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { GoalProgressService } from './services/goal-progress.service';
import { GoalTemplatesService } from './services/goal-templates.service';
import { GoalsService } from './goals.service';

describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: {
    goal: Record<string, jest.Mock>;
    team: Record<string, jest.Mock>;
    project: Record<string, jest.Mock>;
  };
  let progressService: {
    calculateProgress: jest.Mock;
    updateGoalStatus: jest.Mock;
    getDetailedProgress: jest.Mock;
  };
  let templatesService: {
    findById: jest.Mock;
  };

  const goal = {
    id: 'goal-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Increase coverage',
    metricType: MetricType.COVERAGE,
    targetValue: 80,
    operator: ComparisonOp.GTE,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-06-01T00:00:00.000Z'),
    status: GoalStatus.ACTIVE,
    keyResults: [],
    owner: { id: 'user-1', name: 'Owner', email: 'owner@example.com', avatarUrl: null },
    project: null,
  };

  beforeEach(async () => {
    prisma = {
      goal: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      team: {
        findFirst: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
      },
    };
    progressService = {
      calculateProgress: jest.fn(() => ({
        progressPercentage: 50,
        isOnTrack: true,
        daysRemaining: 30,
        expectedProgress: 40,
        isAchieved: false,
      })),
      updateGoalStatus: jest.fn(),
      getDetailedProgress: jest.fn(),
    };
    templatesService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: GoalProgressService, useValue: progressService },
        { provide: GoalTemplatesService, useValue: templatesService },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a goal when required fields are provided', async () => {
    prisma.goal.create.mockResolvedValue(goal);

    const result = await service.create('org-1', 'user-1', {
      name: 'Increase coverage',
      metricType: MetricType.COVERAGE,
      targetValue: 80,
      operator: ComparisonOp.GTE,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
    });

    expect(prisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          ownerId: 'user-1',
          name: 'Increase coverage',
          status: GoalStatus.ACTIVE,
        }),
      }),
    );
    expect(result).toEqual(goal);
  });

  it('rejects goals whose end date is not after the start date', async () => {
    await expect(
      service.create('org-1', 'user-1', {
        name: 'Invalid dates',
        metricType: MetricType.COVERAGE,
        targetValue: 80,
        operator: ComparisonOp.GTE,
        startDate: '2026-06-01',
        endDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires metric fields when no template is used', async () => {
    await expect(
      service.create('org-1', 'user-1', {
        name: 'Incomplete goal',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prefills goal fields from a template', async () => {
    templatesService.findById.mockResolvedValue({
      id: 'template-1',
      metricType: MetricType.DQS,
      targetValue: 75,
      operator: ComparisonOp.GTE,
      durationDays: 90,
    });
    prisma.goal.create.mockResolvedValue(goal);

    await service.create('org-1', 'user-1', {
      name: 'From template',
      templateId: 'template-1',
      startDate: '2026-01-01',
    });

    expect(templatesService.findById).toHaveBeenCalledWith('template-1', 'org-1');
    expect(prisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metricType: MetricType.DQS,
          targetValue: 75,
          operator: ComparisonOp.GTE,
        }),
      }),
    );
  });

  it('returns a goal with progress details', async () => {
    prisma.goal.findFirst.mockResolvedValue(goal);

    await expect(service.findById('goal-1', 'org-1')).resolves.toMatchObject({
      id: 'goal-1',
      isOKR: false,
      progress: {
        percentage: 50,
        isOnTrack: true,
      },
    });
  });

  it('throws when a goal is not found', async () => {
    prisma.goal.findFirst.mockResolvedValue(null);

    await expect(service.findById('missing', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an existing goal', async () => {
    prisma.goal.findFirst.mockResolvedValue(goal);
    prisma.goal.delete.mockResolvedValue(goal);

    await expect(service.delete('goal-1', 'org-1')).resolves.toEqual({
      success: true,
      message: 'Goal deleted successfully',
    });
    expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: 'goal-1' } });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComparisonOp, GoalStatus, KeyResult } from '@prisma/client';
import { PrismaService } from '../../../prisma';
import { GoalProgressService } from './goal-progress.service';

describe('GoalProgressService', () => {
  let service: GoalProgressService;
  let prisma: {
    goal: Record<string, jest.Mock>;
  };

  const keyResults: KeyResult[] = [
    {
      id: 'kr-1',
      goalId: 'goal-1',
      description: 'Ship feature A',
      currentValue: 50,
      targetValue: 100,
      weight: 2,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 'kr-2',
      goalId: 'goal-1',
      description: 'Ship feature B',
      currentValue: 25,
      targetValue: 50,
      weight: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    prisma = {
      goal: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<GoalProgressService>(GoalProgressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateOKRProgress', () => {
    it('returns weighted average progress across key results', () => {
      expect(service.calculateOKRProgress(keyResults)).toBeCloseTo(50);
    });

    it('returns zero when there are no key results', () => {
      expect(service.calculateOKRProgress([])).toBe(0);
    });
  });

  describe('isOKRAchieved', () => {
    it('requires every key result to meet its target', () => {
      expect(service.isOKRAchieved(keyResults)).toBe(false);
      expect(
        service.isOKRAchieved([
          { ...keyResults[0], currentValue: 100 },
          { ...keyResults[1], currentValue: 50 },
        ]),
      ).toBe(true);
    });
  });

  describe('getKeyResultsProgress', () => {
    it('maps key results to progress details', () => {
      expect(service.getKeyResultsProgress(keyResults)).toEqual([
        expect.objectContaining({
          id: 'kr-1',
          progressPercentage: 50,
          isAchieved: false,
        }),
        expect.objectContaining({
          id: 'kr-2',
          progressPercentage: 50,
          isAchieved: false,
        }),
      ]);
    });
  });

  describe('checkAchievement', () => {
    it.each([
      { operator: ComparisonOp.GTE, current: 80, target: 80, expected: true },
      { operator: ComparisonOp.GT, current: 80, target: 80, expected: false },
      { operator: ComparisonOp.LT, current: 5, target: 10, expected: true },
      { operator: ComparisonOp.EQ, current: 42, target: 42, expected: true },
    ])(
      'returns $expected for operator $operator with current=$current and target=$target',
      ({ operator, current, target, expected }) => {
        expect(service.checkAchievement(current, target, operator)).toBe(expected);
      },
    );
  });

  describe('calculateProgress', () => {
    it('calculates progress for a simple goal', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      prisma.goal.findUnique.mockResolvedValue({
        id: 'goal-1',
        currentValue: 40,
        targetValue: 80,
        operator: ComparisonOp.GTE,
        status: GoalStatus.ACTIVE,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        keyResults: [],
      });

      await expect(service.calculateProgress('goal-1')).resolves.toMatchObject({
        goalId: 'goal-1',
        progressPercentage: 50,
        isAchieved: false,
        daysRemaining: expect.any(Number),
      });

      jest.useRealTimers();
    });
  });
});

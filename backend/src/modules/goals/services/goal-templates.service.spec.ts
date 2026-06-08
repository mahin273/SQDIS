import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComparisonOp, MetricType } from '@prisma/client';
import { PrismaService } from '../../../prisma';
import { GoalTemplatesService } from './goal-templates.service';

describe('GoalTemplatesService', () => {
  let service: GoalTemplatesService;
  let prisma: {
    goalTemplate: Record<string, jest.Mock>;
    goal: Record<string, jest.Mock>;
  };

  const template = {
    id: 'template-1',
    organizationId: 'org-1',
    name: 'Coverage sprint',
    metricType: MetricType.COVERAGE,
    targetValue: 80,
    operator: ComparisonOp.GTE,
    durationDays: 30,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      goalTemplate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      goal: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalTemplatesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<GoalTemplatesService>(GoalTemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns templates with usage counts', async () => {
    prisma.goalTemplate.findMany.mockResolvedValue([template]);
    prisma.goal.count.mockResolvedValue(3);

    await expect(service.findAll('org-1')).resolves.toEqual([
      { ...template, usageCount: 3 },
    ]);
  });

  it('returns a template by id', async () => {
    prisma.goalTemplate.findFirst.mockResolvedValue(template);

    await expect(service.findById('template-1', 'org-1')).resolves.toEqual(template);
  });

  it('throws when a template is not found', async () => {
    prisma.goalTemplate.findFirst.mockResolvedValue(null);

    await expect(service.findById('missing', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a template when the name is unique', async () => {
    prisma.goalTemplate.findFirst.mockResolvedValue(null);
    prisma.goalTemplate.create.mockResolvedValue(template);

    await expect(
      service.create('org-1', {
        name: 'Coverage sprint',
        metricType: MetricType.COVERAGE,
        targetValue: 80,
        operator: ComparisonOp.GTE,
        durationDays: 30,
      }),
    ).resolves.toEqual(template);
  });

  it('rejects duplicate template names', async () => {
    prisma.goalTemplate.findFirst.mockResolvedValue(template);

    await expect(
      service.create('org-1', {
        name: 'Coverage sprint',
        metricType: MetricType.COVERAGE,
        targetValue: 80,
        operator: ComparisonOp.GTE,
        durationDays: 30,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

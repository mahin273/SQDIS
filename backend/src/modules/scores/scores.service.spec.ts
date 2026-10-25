jest.mock('../github/github.service', () => ({
  GitHubService: class GitHubService {},
}));
jest.mock('../github/services/github-api.service', () => ({
  GitHubApiService: class GitHubApiService {},
}));

import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SCORE_QUEUE } from '../../config';
import { PrismaService } from '../../prisma';
import { GitHubService } from '../github/github.service';
import { GitHubApiService } from '../github/services/github-api.service';
import { ScoresService } from './scores.service';
import { ScoresCacheService } from './services/scores-cache.service';
import { ScoresMlClientService } from './services/scores-ml-client.service';
import { ScoreJobType } from './types';

describe('ScoresService', () => {
  let service: ScoresService;
  let prisma: {
    user: Record<string, jest.Mock>;
    dQSScore: Record<string, jest.Mock>;
    repository: Record<string, jest.Mock>;
    sQSScore: Record<string, jest.Mock>;
    organizationMember: Record<string, jest.Mock>;
    project: Record<string, jest.Mock>;
  };
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
  };
  let scoreQueue: { add: jest.Mock };

  const dqsScore = {
    id: 'dqs-1',
    developerId: 'user-1',
    score: 82.5,
    modelVersion: 'v1',
    calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
    featureValues: { commits: 10 },
    shapValues: [{ feature: 'commits', impact: 0.2 }],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
      dQSScore: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      repository: {
        findFirst: jest.fn(),
      },
      sQSScore: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      organizationMember: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      teamProjectAssignment: {
        findFirst: jest.fn(),
      },
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };
    scoreQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoresService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: ScoresMlClientService, useValue: {} },
        { provide: ScoresCacheService, useValue: cacheService },
        { provide: getQueueToken(SCORE_QUEUE), useValue: scoreQueue },
        { provide: GitHubService, useValue: {} },
        { provide: GitHubApiService, useValue: {} },
      ],
    }).compile();

    service = module.get<ScoresService>(ScoresService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('verifies developer membership before returning cached DQS score', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      memberships: [{ role: 'DEVELOPER' }],
    });
    const cached = {
      developerId: 'user-1',
      score: 90,
      modelVersion: 'v1',
      calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
      features: {},
      shapValues: [],
    };
    cacheService.get.mockResolvedValue(cached);

    await expect(service.getDQS('user-1', 'org-1')).resolves.toEqual(cached);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        memberships: {
          some: { organizationId: 'org-1' },
        },
      },
      include: {
        memberships: {
          where: { organizationId: 'org-1' },
          select: { role: true },
        },
      },
    });
    expect(cacheService.get).toHaveBeenCalledWith('dqs:score:org-1:user-1');
  });

  it('rejects DQS request before reading cache if developer does not belong to organization', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    cacheService.get.mockResolvedValue({ score: 95 });

    await expect(service.getDQS('foreign-user', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(cacheService.get).not.toHaveBeenCalled();
  });

  it('returns the latest DQS score from the database and caches it with organization scope', async () => {
    cacheService.get.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      memberships: [{ role: 'DEVELOPER' }],
    });
    prisma.dQSScore.findFirst.mockResolvedValue(dqsScore);

    await expect(service.getDQS('user-1', 'org-1')).resolves.toMatchObject({
      developerId: 'user-1',
      score: 82.5,
      modelVersion: 'v1',
    });
    expect(cacheService.set).toHaveBeenCalledWith(
      'dqs:score:org-1:user-1',
      expect.any(Object),
      expect.any(Number),
    );
  });

  it('throws when the developer is not in the organization', async () => {
    cacheService.get.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getDQS('missing', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('verifies project membership before returning cached SQS score', async () => {
    prisma.repository.findFirst.mockResolvedValue({ id: 'project-1', organizationId: 'org-1' });
    const cached = {
      projectId: 'project-1',
      score: 78,
      modelVersion: 'v1',
      calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
      riskyModules: [],
      recommendations: [],
    };
    cacheService.get.mockResolvedValue(cached);

    await expect(service.getSQS('project-1', 'org-1')).resolves.toEqual(cached);
    expect(prisma.repository.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-1', organizationId: 'org-1' },
    });
    expect(cacheService.get).toHaveBeenCalledWith('sqs:score:org-1:project-1');
  });

  it('rejects SQS request before reading cache if project does not belong to organization', async () => {
    prisma.repository.findFirst.mockResolvedValue(null);
    prisma.project.findFirst.mockResolvedValue(null);
    cacheService.get.mockResolvedValue({ score: 90 });

    await expect(service.getSQS('foreign-proj', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(cacheService.get).not.toHaveBeenCalled();
  });

  it('returns SQS history for a project', async () => {
    cacheService.get.mockResolvedValue(null);
    prisma.repository.findFirst.mockResolvedValue({ id: 'project-1' });
    prisma.sQSScore.findMany.mockResolvedValue([
      {
        id: 'sqs-1',
        score: 70,
        modelVersion: 'v1',
        calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.getSQSHistory('project-1', 'org-1', { limit: 10 }),
    ).resolves.toMatchObject({
      projectId: 'project-1',
      history: [{ id: 'sqs-1', score: 70 }],
      meta: { count: 1 },
    });
  });

  it('enqueues SQS recalculation after a new commit', async () => {
    await service.triggerSQSRecalculationOnCommit('project-1', 'org-1', 'commit-1');

    expect(scoreQueue.add).toHaveBeenCalledWith(
      ScoreJobType.SQS,
      {
        entityId: 'project-1',
        type: ScoreJobType.SQS,
        organizationId: 'org-1',
        triggeredBy: 'commit',
        commitId: 'commit-1',
      },
      expect.objectContaining({
        jobId: expect.stringMatching(new RegExp(`^${ScoreJobType.SQS}-project-1-\\d+$`)),
        removeOnComplete: true,
        removeOnFail: 100,
      }),
    );
  });

  describe('triggerRecalculation', () => {
    it('throws NotFoundException when DQS developer is not found in organization', async () => {
      prisma.organizationMember.findFirst.mockResolvedValue(null);

      await expect(
        service.triggerRecalculation('foreign-dev', 'dqs' as any, 'org-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.organizationMember.findFirst).toHaveBeenCalledWith({
        where: { userId: 'foreign-dev', organizationId: 'org-1' },
      });
      expect(scoreQueue.add).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when SQS project or repo is not found in organization', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.repository.findFirst.mockResolvedValue(null);

      await expect(
        service.triggerRecalculation('foreign-entity', 'sqs' as any, 'org-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(scoreQueue.add).not.toHaveBeenCalled();
    });

    it('enqueues DQS recalculation when developer belongs to organization', async () => {
      prisma.organizationMember.findFirst.mockResolvedValue({ id: 'mem-1', userId: 'dev-1', organizationId: 'org-1' });

      const result = await service.triggerRecalculation('dev-1', 'dqs' as any, 'org-1');

      expect(result.jobId).toBe('job-1');
      expect(scoreQueue.add).toHaveBeenCalledWith(
        ScoreJobType.DQS,
        expect.objectContaining({
          entityId: 'dev-1',
          type: ScoreJobType.DQS,
          organizationId: 'org-1',
          triggeredBy: 'manual',
        }),
        expect.any(Object),
      );
    });
  });

  describe('getRiskyModules', () => {
    it('returns empty risky modules for developer with default projectId and no assigned projects', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });
      prisma.teamProjectAssignment.findFirst.mockResolvedValue(null);

      const result = await service.getRiskyModules('default', 'org-1', {
        id: 'dev-1',
        role: 'DEVELOPER',
      });

      expect(result).toMatchObject({
        projectId: 'default',
        riskyModules: [],
        totalRiskyModules: 0,
        highCriticalCount: 0,
      });
    });

    it('aggregates risky modules across all repositories in a project', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      prisma.repository.findFirst.mockResolvedValue(null);
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        organizationId: 'org-1',
        repositories: [{ repositoryId: 'repo-1' }, { repositoryId: 'repo-2' }],
      });

      // Scores for proj-1, repo-1, repo-2
      prisma.sQSScore.findFirst
        .mockResolvedValueOnce({
          projectId: 'proj-1',
          calculatedAt: new Date('2026-01-01T00:00:00Z'),
          riskyModules: [
            { path: 'src/main.ts', risk_level: 'HIGH', riskScore: 75, reason: 'High churn' },
          ],
        })
        .mockResolvedValueOnce({
          projectId: 'repo-1',
          calculatedAt: new Date('2026-01-02T00:00:00Z'),
          riskyModules: [
            { path: 'src/auth.ts', risk_level: 'CRITICAL', riskScore: 92, reason: 'Complexity' },
          ],
        })
        .mockResolvedValueOnce({
          projectId: 'repo-2',
          calculatedAt: new Date('2026-01-03T00:00:00Z'),
          riskyModules: [
            { path: 'src/billing.ts', risk_level: 'MEDIUM', riskScore: 50, reason: 'Smells' },
          ],
        });

      const result = await service.getRiskyModules('proj-1', 'org-1', {
        id: 'admin-1',
        role: 'ADMIN',
      });

      expect(result.projectId).toBe('proj-1');
      expect(result.totalRiskyModules).toBe(3);
      expect(result.riskyModules.map((m) => m.path)).toEqual([
        'src/auth.ts',
        'src/main.ts',
        'src/billing.ts',
      ]);
    });
  });
});

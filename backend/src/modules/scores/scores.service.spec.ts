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

  it('returns cached DQS scores without hitting the database', async () => {
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
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('returns the latest DQS score from the database and caches it', async () => {
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
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('throws when the developer is not in the organization', async () => {
    cacheService.get.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getDQS('missing', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns cached SQS scores without hitting the database', async () => {
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
    expect(prisma.repository.findFirst).not.toHaveBeenCalled();
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
      { jobId: `${ScoreJobType.SQS}-project-1` },
    );
  });
});

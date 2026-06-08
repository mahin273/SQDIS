jest.mock('../github/github.service', () => ({
  GitHubService: class GitHubService {},
}));
jest.mock('../github/services/github-api.service', () => ({
  GitHubApiService: class GitHubApiService {},
}));

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommitClassification } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { AlertsService } from '../alerts/alerts.service';
import { DebtService } from '../debt/debt.service';
import { GitHubService } from '../github/github.service';
import { GitHubApiService } from '../github/services/github-api.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ScoresService } from '../scores/scores.service';
import { CommitsService } from './commits.service';
import { MlClientService } from './services';

describe('CommitsService', () => {
  let service: CommitsService;
  let prisma: {
    commit: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    emailAlias: Record<string, jest.Mock>;
    projectRepository: Record<string, jest.Mock>;
  };
  let eventEmitter: { emit: jest.Mock };
  let githubService: { getOctokitForOrganization: jest.Mock };
  let githubApiService: { fetchCommitDetails: jest.Mock };
  let mlClientService: {
    classifyCommit: jest.Mock;
    detectAnomaly: jest.Mock;
  };
  let scoresService: {
    handleIncrementalASTUpdate: jest.Mock;
    triggerSQSRecalculationOnCommit: jest.Mock;
  };
  let debtService: { scanCommit: jest.Mock };
  let onboardingService: { recordMilestone: jest.Mock };
  let alertsService: { createAnomalyAlert: jest.Mock };

  const commit = {
    id: 'commit-1',
    sha: 'abc123',
    message: 'feat: add tests',
    authorName: 'Dev User',
    authorEmail: 'dev@example.com',
    classification: CommitClassification.FEATURE,
    committedAt: new Date('2026-01-15T00:00:00.000Z'),
    repository: { id: 'repo-1', name: 'api', fullName: 'acme/api', organizationId: 'org-1' },
    developer: { id: 'user-1', name: 'Dev User', email: 'dev@example.com', avatarUrl: null },
    fileChanges: [],
  };

  beforeEach(async () => {
    prisma = {
      commit: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      emailAlias: {
        findUnique: jest.fn(),
      },
      projectRepository: {
        findMany: jest.fn(),
      },
    };
    eventEmitter = { emit: jest.fn() };
    githubService = { getOctokitForOrganization: jest.fn().mockResolvedValue({}) };
    githubApiService = {
      fetchCommitDetails: jest.fn().mockResolvedValue({
        files: [
          {
            sha: 'abc',
            filename: 'src/app.ts',
            status: 'modified',
            additions: 10,
            deletions: 2,
            changes: 12,
            patch: '@@ -1,1 +1,2 @@\n+// TODO: follow up',
          },
        ],
        stats: { additions: 10, deletions: 2 },
      }),
    };
    mlClientService = {
      classifyCommit: jest.fn().mockResolvedValue({ classification: 'FEATURE' }),
      detectAnomaly: jest.fn().mockResolvedValue(null),
    };
    scoresService = {
      handleIncrementalASTUpdate: jest.fn().mockResolvedValue(undefined),
      triggerSQSRecalculationOnCommit: jest.fn().mockResolvedValue(undefined),
    };
    debtService = { scanCommit: jest.fn().mockResolvedValue([]) };
    onboardingService = { recordMilestone: jest.fn().mockResolvedValue(undefined) };
    alertsService = { createAnomalyAlert: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommitsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: GitHubService, useValue: githubService },
        { provide: GitHubApiService, useValue: githubApiService },
        { provide: MlClientService, useValue: mlClientService },
        { provide: ScoresService, useValue: scoresService },
        { provide: DebtService, useValue: debtService },
        { provide: OnboardingService, useValue: onboardingService },
        { provide: AlertsService, useValue: alertsService },
      ],
    }).compile();

    service = module.get<CommitsService>(CommitsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated commits with metadata', async () => {
    prisma.commit.findMany.mockResolvedValue([commit]);
    prisma.commit.count.mockResolvedValue(1);

    await expect(
      service.findAll({
        organizationId: 'org-1',
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      data: [commit],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    });

    expect(prisma.commit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repository: { organizationId: 'org-1' },
        },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('applies search and anomaly filters', async () => {
    prisma.commit.findMany.mockResolvedValue([]);
    prisma.commit.count.mockResolvedValue(0);

    await service.findAll({
      organizationId: 'org-1',
      search: 'hotfix',
      anomalyOnly: true,
    });

    expect(prisma.commit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          repository: { organizationId: 'org-1' },
          anomalyFlag: true,
          OR: expect.arrayContaining([
            { message: { contains: 'hotfix', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
  });

  it('returns a commit by id with related data', async () => {
    prisma.commit.findUnique.mockResolvedValue(commit);

    await expect(service.findById('commit-1')).resolves.toEqual(commit);
  });

  it('throws when a commit is not found', async () => {
    prisma.commit.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns aggregate commit statistics', async () => {
    prisma.commit.count.mockResolvedValue(10);
    prisma.commit.aggregate.mockResolvedValue({
      _sum: { linesAdded: 100, linesDeleted: 40, filesChanged: 25 },
      _avg: { churnRatio: 0.3, linesAdded: 10, linesDeleted: 4 },
    });
    prisma.commit.groupBy.mockResolvedValue([
      { classification: CommitClassification.FEATURE, _count: 6 },
      { classification: CommitClassification.BUGFIX, _count: 4 },
    ]);

    const result = await service.getStatistics({ organizationId: 'org-1' });

    expect(result).toMatchObject({
      totalCommits: 10,
      totalLinesAdded: 100,
      totalLinesDeleted: 40,
      classificationBreakdown: {
        FEATURE: 6,
        BUGFIX: 4,
      },
      rollingAverages: expect.objectContaining({
        '7d': expect.any(Object),
        '30d': expect.any(Object),
        '90d': expect.any(Object),
      }),
    });
  });

  it('skips processing when the commit already exists', async () => {
    prisma.commit.findUnique.mockResolvedValue({
      id: 'commit-1',
      sha: 'abc123',
      linesAdded: 5,
      linesDeleted: 1,
      filesChanged: 1,
      churnRatio: 0.2,
      developerId: 'user-1',
      classification: CommitClassification.FEATURE,
    });

    await expect(
      service.processCommit(
        {
          sha: 'abc123',
          message: 'feat: add tests',
          authorEmail: 'dev@example.com',
          authorName: 'Dev User',
          repositoryFullName: 'acme/api',
          timestamp: new Date('2026-01-15T00:00:00.000Z'),
        },
        'repo-1',
        'org-1',
      ),
    ).resolves.toMatchObject({
      commitId: 'commit-1',
      sha: 'abc123',
    });

    expect(githubApiService.fetchCommitDetails).not.toHaveBeenCalled();
    expect(prisma.commit.create).not.toHaveBeenCalled();
  });

  it('processes a new commit end-to-end', async () => {
    prisma.commit.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      memberships: [{ organizationId: 'org-1' }],
    });
    prisma.commit.create.mockResolvedValue({
      id: 'commit-1',
      sha: 'abc123',
      linesAdded: 10,
      linesDeleted: 2,
      filesChanged: 1,
      churnRatio: 0.2,
      developerId: 'user-1',
      classification: CommitClassification.FEATURE,
      fileChanges: [],
    });
    prisma.projectRepository.findMany.mockResolvedValue([{ projectId: 'project-1' }]);

    await expect(
      service.processCommit(
        {
          sha: 'abc123',
          message: 'feat: add tests',
          authorEmail: 'dev@example.com',
          authorName: 'Dev User',
          repositoryFullName: 'acme/api',
          timestamp: new Date('2026-01-15T00:00:00.000Z'),
        },
        'repo-1',
        'org-1',
      ),
    ).resolves.toMatchObject({
      commitId: 'commit-1',
      sha: 'abc123',
      developerId: 'user-1',
      classification: CommitClassification.FEATURE,
    });

    expect(githubService.getOctokitForOrganization).toHaveBeenCalledWith('org-1');
    expect(mlClientService.classifyCommit).toHaveBeenCalled();
    expect(debtService.scanCommit).toHaveBeenCalled();
    expect(scoresService.triggerSQSRecalculationOnCommit).toHaveBeenCalledWith(
      'project-1',
      'org-1',
      'commit-1',
    );
    expect(onboardingService.recordMilestone).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'commit.processed',
      expect.objectContaining({
        commitId: 'commit-1',
        sha: 'abc123',
      }),
    );
  });

  it('creates an anomaly alert when ML detection flags a commit', async () => {
    prisma.commit.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      memberships: [{ organizationId: 'org-1' }],
    });
    prisma.commit.create.mockResolvedValue({
      id: 'commit-1',
      sha: 'abc123',
      linesAdded: 500,
      linesDeleted: 400,
      filesChanged: 20,
      churnRatio: 0.8,
      developerId: 'user-1',
      classification: CommitClassification.REFACTOR,
      fileChanges: [],
    });
    prisma.projectRepository.findMany.mockResolvedValue([]);
    mlClientService.detectAnomaly.mockResolvedValue({
      is_anomaly: true,
      anomaly_score: 0.95,
      severity: 'CRITICAL',
      model_version: 'v1',
    });

    await service.processCommit(
      {
        sha: 'abc123',
        message: 'refactor: huge change',
        authorEmail: 'dev@example.com',
        authorName: 'Dev User',
        repositoryFullName: 'acme/api',
        timestamp: new Date('2026-01-15T00:00:00.000Z'),
      },
      'repo-1',
      'org-1',
    );

    expect(alertsService.createAnomalyAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        commitId: 'commit-1',
        commitSha: 'abc123',
        anomalyScore: 0.95,
        severity: 'CRITICAL',
      }),
    );
  });

  it('calculates churn ratio using shared utility logic', () => {
    expect(service.calculateChurnRatio(10, 0)).toBe(0);
    expect(service.calculateChurnRatio(5, 5)).toBe(0.5);
  });
});

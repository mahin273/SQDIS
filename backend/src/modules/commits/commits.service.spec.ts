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
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      organizationMember: {
        create: jest.fn(),
        count: jest.fn(),
      },
      emailAlias: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      unmappedEmail: {
        delete: jest.fn(),
        upsert: jest.fn(),
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

  describe('Contributor Auto-Discovery', () => {
    it('auto-discovers a new contributor and provisions User and OrganizationMember', async () => {
      prisma.commit.findUnique.mockResolvedValue(null);
      // No existing user found initially
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.emailAlias.findUnique.mockResolvedValue(null);

      const createdUser = {
        id: 'new-dev-uuid',
        email: 'newauthor@example.com',
        name: 'New Author',
      };
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.organizationMember.create.mockResolvedValue({
        id: 'om-1',
        userId: 'new-dev-uuid',
        organizationId: 'org-1',
        role: 'DEVELOPER',
      });
      prisma.unmappedEmail.delete.mockResolvedValue({});

      prisma.commit.create.mockResolvedValue({
        id: 'commit-2',
        sha: 'sha-new-123',
        linesAdded: 5,
        linesDeleted: 1,
        filesChanged: 1,
        churnRatio: 0.1,
        developerId: 'new-dev-uuid',
        classification: CommitClassification.FEATURE,
        fileChanges: [],
      });
      prisma.projectRepository.findMany.mockResolvedValue([]);

      const result = await service.processCommit(
        {
          sha: 'sha-new-123',
          message: 'feat: add new feature',
          authorEmail: 'newauthor@example.com',
          authorName: 'New Author',
          repositoryFullName: 'acme/api',
          timestamp: new Date('2026-02-01T00:00:00.000Z'),
        },
        'repo-1',
        'org-1',
      );

      expect(result.developerId).toBe('new-dev-uuid');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newauthor@example.com',
            name: 'New Author',
            passwordHash: null,
          }),
        }),
      );
      expect(prisma.organizationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'new-dev-uuid',
            organizationId: 'org-1',
            role: 'DEVELOPER',
          }),
        }),
      );
      expect(prisma.unmappedEmail.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_email: {
              organizationId: 'org-1',
              email: 'newauthor@example.com',
            },
          },
        }),
      );
    });

    it('links GitHub privacy noreply email to an existing organization member and creates alias', async () => {
      prisma.commit.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.emailAlias.findUnique.mockResolvedValue(null);

      // Matches existing member with username 'mahin273' or name 'Mahin Khan'
      const existingUser = {
        id: 'existing-mahin-id',
        email: 'md.mahin.bd18@gmail.com',
        name: 'Mahin Khan',
      };
      prisma.user.findFirst.mockResolvedValue(existingUser);
      prisma.emailAlias.create.mockResolvedValue({});
      prisma.unmappedEmail.delete.mockResolvedValue({});

      prisma.commit.create.mockResolvedValue({
        id: 'commit-3',
        sha: 'sha-noreply-123',
        linesAdded: 20,
        linesDeleted: 5,
        filesChanged: 2,
        churnRatio: 0.2,
        developerId: 'existing-mahin-id',
        classification: CommitClassification.FEATURE,
        fileChanges: [],
      });
      prisma.projectRepository.findMany.mockResolvedValue([]);

      const result = await service.processCommit(
        {
          sha: 'sha-noreply-123',
          message: 'fix: correct typo',
          authorEmail: '42418258+mahin273@users.noreply.github.com',
          authorName: 'Mahin Khan',
          repositoryFullName: 'acme/api',
          timestamp: new Date('2026-02-02T00:00:00.000Z'),
        },
        'repo-1',
        'org-1',
      );

      expect(result.developerId).toBe('existing-mahin-id');
      expect(prisma.emailAlias.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'existing-mahin-id',
            email: '42418258+mahin273@users.noreply.github.com',
            isVerified: true,
            source: 'GITHUB_OAUTH',
          }),
        }),
      );
    });

    it('recovers gracefully from unique constraint error when user is created concurrently', async () => {
      prisma.commit.findUnique.mockResolvedValue(null);
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // first check in attributeDeveloper
        .mockResolvedValueOnce(null) // check before create in autoDiscoverContributor
        .mockResolvedValueOnce({
          id: 'concurrent-user-id',
          email: 'concurrent@example.com',
          name: 'Concurrent Dev',
        }); // re-query after P2002 conflict

      prisma.emailAlias.findUnique.mockResolvedValue(null);

      // Simulate P2002 error on user.create
      const p2002Error: any = new Error('Unique constraint failed on email');
      p2002Error.code = 'P2002';
      prisma.user.create.mockRejectedValue(p2002Error);

      prisma.organizationMember.create.mockResolvedValue({});
      prisma.unmappedEmail.delete.mockResolvedValue({});

      prisma.commit.create.mockResolvedValue({
        id: 'commit-4',
        sha: 'sha-concurrent-123',
        linesAdded: 3,
        linesDeleted: 0,
        filesChanged: 1,
        churnRatio: 0,
        developerId: 'concurrent-user-id',
        classification: CommitClassification.FEATURE,
        fileChanges: [],
      });
      prisma.projectRepository.findMany.mockResolvedValue([]);

      const result = await service.processCommit(
        {
          sha: 'sha-concurrent-123',
          message: 'docs: update readme',
          authorEmail: 'concurrent@example.com',
          authorName: 'Concurrent Dev',
          repositoryFullName: 'acme/api',
          timestamp: new Date('2026-02-03T00:00:00.000Z'),
        },
        'repo-1',
        'org-1',
      );

      expect(result.developerId).toBe('concurrent-user-id');
      expect(prisma.organizationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'concurrent-user-id',
            organizationId: 'org-1',
          }),
        }),
      );
    });

    it('re-attributes existing unattributed commits and updates developerId in database', async () => {
      prisma.commit.findMany.mockResolvedValue([
        { id: 'c1', authorEmail: 'user1@example.com', authorName: 'User One' },
        { id: 'c2', authorEmail: 'user2@example.com', authorName: 'User Two' },
      ]);
      prisma.organizationMember.count
        .mockResolvedValueOnce(1) // initial count
        .mockResolvedValueOnce(3); // final count after discovery

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.emailAlias.findUnique.mockResolvedValue(null);
      prisma.user.create
        .mockResolvedValueOnce({ id: 'u1', email: 'user1@example.com', name: 'User One' })
        .mockResolvedValueOnce({ id: 'u2', email: 'user2@example.com', name: 'User Two' });
      prisma.organizationMember.create.mockResolvedValue({});
      prisma.unmappedEmail.delete.mockResolvedValue({});
      prisma.commit.update.mockResolvedValue({});

      const result = await service.reattributeExistingCommits('org-1');

      expect(result.updated).toBe(2);
      expect(result.developersDiscovered).toBe(2);
      expect(prisma.commit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: { developerId: 'u1' },
        }),
      );
      expect(prisma.commit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c2' },
          data: { developerId: 'u2' },
        }),
      );
    });
  });
});

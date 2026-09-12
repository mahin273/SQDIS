jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TurnaroundClass, CommentClass } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { ReviewsService } from './reviews.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { GitHubService } from '../github/github.service';
import { GitHubApiService } from '../github/services/github-api.service';
import { ScoresMlClientService } from '../scores/services/scores-ml-client.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ParsedReviewData,
  ParsedReviewCommentData,
  ParsedPullRequestData,
} from '../github/dto/webhook-payload.dto';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    review: Record<string, jest.Mock>;
    reviewComment: Record<string, jest.Mock>;
    pullRequest: Record<string, jest.Mock>;
    commit: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    repository: Record<string, jest.Mock>;
  };
  let eventEmitter: { emit: jest.Mock };
  let onboardingService: { handleReviewSubmitted: jest.Mock; handlePrMerged: jest.Mock };
  let githubService: { getOctokitForOrganization: jest.Mock };
  let gitHubApiService: { fetchRepositoryCodeFiles: jest.Mock; postPullRequestQualitySummary: jest.Mock };
  let scoresMlClientService: { evaluateQualityGate: jest.Mock };
  let notificationsService: { create: jest.Mock };

  const mockReview = {
    id: 'review-1',
    githubReviewId: 1001,
    prNumber: 42,
    state: 'APPROVED',
    body: 'LGTM! Great refactoring.',
    submittedAt: new Date('2026-01-01T12:00:00.000Z'),
    turnaroundMinutes: 45,
    turnaroundClass: 'FAST',
    commentCount: 2,
    reviewerId: 'user-1',
    repositoryId: 'repo-1',
    organizationId: 'org-1',
    reviewer: { id: 'user-1', name: 'Reviewer One', email: 'rev1@example.com', avatarUrl: null },
    repository: { id: 'repo-1', name: 'sqdis-api', fullName: 'acme/sqdis-api' },
  };

  beforeEach(async () => {
    prisma = {
      review: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      reviewComment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        groupBy: jest.fn(),
      },
      pullRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      commit: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      repository: {
        findUnique: jest.fn(),
      },
    };

    eventEmitter = { emit: jest.fn() };
    onboardingService = {
      handleReviewSubmitted: jest.fn(),
      handlePrMerged: jest.fn(),
    };
    githubService = {
      getOctokitForOrganization: jest.fn(),
    };
    gitHubApiService = {
      fetchRepositoryCodeFiles: jest.fn(),
      postPullRequestQualitySummary: jest.fn(),
    };
    scoresMlClientService = {
      evaluateQualityGate: jest.fn(),
    };
    notificationsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: OnboardingService, useValue: onboardingService },
        { provide: GitHubService, useValue: githubService },
        { provide: GitHubApiService, useValue: gitHubApiService },
        { provide: ScoresMlClientService, useValue: scoresMlClientService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated reviews for an organization', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          ...mockReview,
          _count: { comments: 2 },
        },
      ]);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.findAll('org-1', { page: 1, limit: 10, repositoryId: 'repo-1' });

      expect(result).toEqual({
        data: [
          expect.objectContaining({
            id: 'review-1',
            prNumber: 42,
            pullRequestId: 42,
            state: 'APPROVED',
            linesAdded: 0,
            linesRemoved: 0,
          }),
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            repository: { organizationId: 'org-1' },
            repositoryId: 'repo-1',
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns review details by ID', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);

      const result = await service.findById('review-1');
      expect(result).toEqual(mockReview);
      expect(prisma.review.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'review-1' },
        }),
      );
    });
  });

  describe('classifyTurnaround', () => {
    it('classifies turnaround time under 4 hours (240 minutes) as FAST', () => {
      expect(service.classifyTurnaround(30)).toBe('FAST');
      expect(service.classifyTurnaround(239)).toBe('FAST');
    });

    it('classifies turnaround time between 4 and 24 hours as NORMAL', () => {
      expect(service.classifyTurnaround(240)).toBe('NORMAL');
      expect(service.classifyTurnaround(720)).toBe('NORMAL');
      expect(service.classifyTurnaround(1440)).toBe('NORMAL');
    });

    it('classifies turnaround time over 24 hours (1440 minutes) as SLOW', () => {
      expect(service.classifyTurnaround(1441)).toBe('SLOW');
      expect(service.classifyTurnaround(2880)).toBe('SLOW');
    });
  });

  describe('calculateTurnaroundMinutes', () => {
    it('calculates duration in minutes accurately', () => {
      const prCreated = new Date('2026-01-01T10:00:00.000Z');
      const submitted = new Date('2026-01-01T11:30:00.000Z');
      expect(service.calculateTurnaroundMinutes(prCreated, submitted)).toBe(90);
    });

    it('returns 0 for negative time differences', () => {
      const prCreated = new Date('2026-01-01T10:00:00.000Z');
      const submitted = new Date('2026-01-01T09:00:00.000Z');
      expect(service.calculateTurnaroundMinutes(prCreated, submitted)).toBe(0);
    });
  });

  describe('classifyComment', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('classifies constructive comments via ML service response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ classification: 'constructive' }),
      } as any);

      const result = await service.classifyComment('Consider using a Set for O(1) lookups');
      expect(result).toBe('CONSTRUCTIVE');
    });

    it('classifies nitpicks via ML service response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ classification: 'nitpick' }),
      } as any);

      const result = await service.classifyComment('nit: fix indentation');
      expect(result).toBe('NITPICK');
    });

    it('returns null when ML service call fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.classifyComment('some comment');
      expect(result).toBeNull();
    });
  });

  describe('getOrganizationStats', () => {
    it('computes organization review stats and turnaround distribution', async () => {
      prisma.review.findMany.mockResolvedValue([
        { state: 'APPROVED', turnaroundMinutes: 60, turnaroundClass: 'FAST' },
        { state: 'APPROVED', turnaroundMinutes: 180, turnaroundClass: 'FAST' },
        { state: 'CHANGES_REQUESTED', turnaroundMinutes: 300, turnaroundClass: 'NORMAL' },
      ]);

      const stats = await service.getOrganizationStats('org-1');

      expect(stats.totalReviews).toBe(3);
      expect(stats.approvalRate).toBe(67);
      expect(stats.avgTurnaroundMinutes).toBe(180);
      expect(stats.turnaroundDistribution.FAST).toBe(2);
      expect(stats.turnaroundDistribution.NORMAL).toBe(1);
    });
  });

  describe('getLeaderboard', () => {
    it('returns top reviewers ranked by volume', async () => {
      prisma.review.groupBy.mockResolvedValue([
        { reviewerId: 'user-1', _count: { id: 15 }, _avg: { turnaroundMinutes: 45 } },
        { reviewerId: 'user-2', _count: { id: 10 }, _avg: { turnaroundMinutes: 120 } },
      ]);

      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', name: 'Alice', email: 'alice@example.com', avatarUrl: null })
        .mockResolvedValueOnce({ id: 'user-2', name: 'Bob', email: 'bob@example.com', avatarUrl: null });

      const rankings = await service.getLeaderboard('org-1');

      expect(rankings).toHaveLength(2);
      expect(rankings[0].reviewer.name).toBe('Alice');
      expect(rankings[0].reviewCount).toBe(15);
      expect(rankings[0].avgTurnaroundMinutes).toBe(45);
    });
  });

  describe('getTeamDebt', () => {
    it('calculates pending reviews older than 24h as debt', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'rev-pending-1',
          reviewerId: 'user-1',
          state: 'PENDING',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          reviewer: { id: 'user-1', name: 'Alice', avatarUrl: null },
          repository: { id: 'repo-1', name: 'api' },
        },
      ]);

      const debt = await service.getTeamDebt('team-1');

      expect(debt).toBeDefined();
      expect(debt.totalPending).toBe(1);
      expect(debt.debtByAssignee).toHaveLength(1);
      expect(debt.debtByAssignee[0].count).toBe(1);
      expect(debt.debtByAssignee[0].oldestAge).toBeGreaterThan(0);
    });
  });

  describe('processReviewFromQueue', () => {
    it('processes review payload, stores review, and emits milestone event', async () => {
      const reviewData: ParsedReviewData = {
        reviewId: 501,
        reviewerId: 999,
        reviewerLogin: 'alice_dev',
        commitId: 'commit-123',
        state: 'approved',
        body: 'Great work! Code is clean.',
        submittedAt: new Date('2026-01-01T10:00:00.000Z'),
        pullRequestNumber: 42,
        pullRequestTitle: 'feat: add user login',
        pullRequestCreatedAt: new Date('2026-01-01T08:00:00.000Z'),
        repositoryId: 100,
        repositoryFullName: 'acme/sqdis-api',
      };

      prisma.user.findFirst.mockResolvedValue({ id: 'user-alice' });
      prisma.repository.findUnique.mockResolvedValue({ organizationId: 'org-1' });

      prisma.review.upsert.mockResolvedValue({
        id: 'rev-stored',
        githubReviewId: 501,
        prNumber: 42,
        turnaroundMinutes: 120,
        turnaroundClass: 'FAST',
      });

      const result = await service.processReviewFromQueue(reviewData, 'repo-1');

      expect(result.reviewId).toBe('rev-stored');
      expect(prisma.review.upsert).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('review.submitted', expect.any(Object));
    });
  });

  describe('processPullRequestFromQueue', () => {
    it('processes merged PRs and emits pr.merged event', async () => {
      const prData: ParsedPullRequestData = {
        prId: 301,
        prNumber: 55,
        title: 'feat: add user login',
        authorId: 888,
        authorLogin: 'bob_dev',
        state: 'closed',
        merged: true,
        mergedAt: new Date('2026-01-02T15:00:00.000Z'),
        additions: 150,
        deletions: 20,
        changedFiles: 4,
      };

      prisma.user.findFirst.mockResolvedValue({ id: 'user-bob' });

      const result = await service.processPullRequestFromQueue(prData, 'repo-1', 'org-1', 'closed');

      expect(result.prNumber).toBe(55);
      expect(result.authorId).toBe('user-bob');
      expect(eventEmitter.emit).toHaveBeenCalledWith('pr.merged', expect.any(Object));
    });

    it('triggers automated PR Quality Gate check and posts bot comment on opened action', async () => {
      const prData: ParsedPullRequestData = {
        prId: 302,
        prNumber: 56,
        title: 'feat: payment integration',
        authorId: 888,
        authorLogin: 'bob_dev',
        state: 'open',
        merged: false,
        additions: 200,
        deletions: 10,
        changedFiles: 3,
      };

      prisma.user.findFirst.mockResolvedValue({ id: 'user-bob' });
      prisma.repository.findUnique.mockResolvedValue({ id: 'repo-1', name: 'payments', fullName: 'acme/payments' });
      githubService.getOctokitForOrganization.mockResolvedValue({} as any);
      gitHubApiService.fetchRepositoryCodeFiles.mockResolvedValue([
        { path: 'src/index.ts', content: 'const a = 1;' },
      ]);
      scoresMlClientService.evaluateQualityGate.mockResolvedValue({
        passed: true,
        status: 'PASSED',
        total_debt_hours: 0.5,
        violations: [],
        rules: {},
      });

      const result = await service.processPullRequestFromQueue(prData, 'repo-1', 'org-1', 'opened');

      expect(result.prNumber).toBe(56);
      expect(gitHubApiService.postPullRequestQualitySummary).toHaveBeenCalledWith(
        expect.anything(),
        'acme',
        'payments',
        56,
        expect.objectContaining({ status: 'PASSED', totalDebtHours: 0.5 }),
      );
    });
  });
});

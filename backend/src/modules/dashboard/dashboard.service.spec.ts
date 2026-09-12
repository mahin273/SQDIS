import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma';
import { ScoresService } from '../scores/scores.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    repository: Record<string, jest.Mock>;
    team: Record<string, jest.Mock>;
    project: Record<string, jest.Mock>;
    projectRepository: Record<string, jest.Mock>;
    commit: Record<string, jest.Mock>;
    organizationMember: Record<string, jest.Mock>;
    coverageReport: Record<string, jest.Mock>;
    sQSScore: Record<string, jest.Mock>;
    dQSScore: Record<string, jest.Mock>;
    alert: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    teamMembership: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      repository: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      team: {
        count: jest.fn(),
      },
      teamMembership: {
        findFirst: jest.fn(),
      },
      project: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      projectRepository: {
        findFirst: jest.fn(),
      },
      commit: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      organizationMember: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      coverageReport: {
        findFirst: jest.fn(),
      },
      sQSScore: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      dQSScore: {
        findFirst: jest.fn(),
      },
      alert: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ScoresService,
          useValue: {
            calculateDQS: jest.fn().mockResolvedValue({ score: null }),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrganizationStats', () => {
    it('returns organization-wide dashboard statistics', async () => {
      prisma.repository.count.mockResolvedValue(3);
      prisma.team.count.mockResolvedValue(2);
      prisma.project.count.mockResolvedValue(4);
      prisma.commit.count
        .mockResolvedValueOnce(120) // total commits
        .mockResolvedValueOnce(18); // bug fix commits
      prisma.organizationMember.count.mockResolvedValue(10);
      prisma.repository.findMany.mockResolvedValue([{ id: 'repo-1' }, { id: 'repo-2' }]);
      prisma.coverageReport.findFirst
        .mockResolvedValueOnce({ coveragePercentage: 80 })
        .mockResolvedValueOnce({ coveragePercentage: 60 });
      prisma.project.findMany.mockResolvedValue([{ id: 'project-1' }]);
      prisma.sQSScore.findFirst.mockResolvedValue({ score: 75 });
      prisma.alert.count.mockResolvedValue(2);

      const result = await service.getOrganizationStats('org-1');

      expect(result).toEqual({
        totalRepositories: 3,
        totalTeams: 2,
        totalDevelopers: 10,
        totalProjects: 4,
        totalCommits: 120,
        bugFixCommits: 18,
        avgCoverage: 70,
        avgSQS: 75,
        riskyModulesCount: 2,
      });
    });
  });

  describe('getSQSTrend', () => {
    it('returns an empty SQS trend when the organization has no projects', async () => {
      prisma.project.findMany.mockResolvedValue([]);

      await expect(service.getSQSTrend('org-1', 30)).resolves.toEqual([]);
      expect(prisma.sQSScore.findMany).not.toHaveBeenCalled();
    });

    it('aggregates daily SQS score averages for active projects', async () => {
      prisma.project.findMany.mockResolvedValue([{ id: 'p-1' }, { id: 'p-2' }]);
      prisma.sQSScore.findMany.mockResolvedValue([
        { score: 80, calculatedAt: new Date('2026-01-01T10:00:00.000Z') },
        { score: 90, calculatedAt: new Date('2026-01-01T15:00:00.000Z') },
        { score: 85, calculatedAt: new Date('2026-01-02T10:00:00.000Z') },
      ]);

      const trend = await service.getSQSTrend('org-1', 30);

      expect(trend).toEqual([
        { date: '2026-01-01', value: 85 },
        { date: '2026-01-02', value: 85 },
      ]);
    });
  });

  describe('getCommitTrend', () => {
    it('aggregates commit volume per date', async () => {
      prisma.commit.findMany.mockResolvedValue([
        { committedAt: new Date('2026-01-01T08:00:00.000Z') },
        { committedAt: new Date('2026-01-01T12:00:00.000Z') },
        { committedAt: new Date('2026-01-02T09:00:00.000Z') },
      ]);

      const trend = await service.getCommitTrend('org-1', 30);

      expect(trend).toEqual([
        { date: '2026-01-01', value: 2 },
        { date: '2026-01-02', value: 1 },
      ]);
    });
  });

  describe('getTopRepositories', () => {
    it('returns sorted repositories by SQS and commit activity', async () => {
      prisma.repository.findMany.mockResolvedValue([
        {
          id: 'repo-1',
          name: 'auth-service',
          fullName: 'acme/auth-service',
          description: 'Auth microservice',
          _count: { commits: 150 },
        },
      ]);

      prisma.projectRepository.findFirst.mockResolvedValue({ projectId: 'project-1' });
      prisma.sQSScore.findFirst.mockResolvedValue({ score: 88 });
      prisma.coverageReport.findFirst.mockResolvedValue({ coveragePercentage: 82 });

      const topRepos = await service.getTopRepositories('org-1', 5);

      expect(topRepos).toHaveLength(1);
      expect(topRepos[0].name).toBe('auth-service');
      expect(topRepos[0].sqs).toBe(88);
      expect(topRepos[0].coverage).toBe(82);
    });
  });

  describe('getRecentActivity', () => {
    it('returns formatted recent commits timeline', async () => {
      prisma.commit.findMany.mockResolvedValue([
        {
          id: 'commit-1',
          message: 'feat: add metrics',
          authorName: 'Alice',
          committedAt: new Date('2026-01-02T10:00:00.000Z'),
          classification: 'FEATURE',
          developer: { id: 'u-1', name: 'Alice', avatarUrl: null },
          repository: { id: 'r-1', name: 'core-api' },
        },
      ]);

      const activity = await service.getRecentActivity('org-1', 10);

      expect(activity).toHaveLength(1);
      expect(activity[0].type).toBe('commit');
      expect(activity[0].message).toBe('feat: add metrics');
      expect(activity[0].repository).toBe('core-api');
    });
  });

  describe('getAlerts', () => {
    it('returns open alerts and projects with critical SQS scores', async () => {
      prisma.alert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          type: 'COVERAGE_DROP',
          severity: 'HIGH',
          message: 'Coverage dropped below 70%',
          createdAt: new Date('2026-01-02T11:00:00.000Z'),
        },
      ]);

      prisma.project.findMany.mockResolvedValue([
        { id: 'p-1', name: 'Legacy API' },
      ]);
      prisma.sQSScore.findFirst.mockResolvedValue({
        id: 'score-1',
        score: 42,
        calculatedAt: new Date('2026-01-02T12:00:00.000Z'),
      });

      const result = await service.getAlerts('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('low_score');
      expect(result[1].type).toBe('alert');
    });
  });

  describe('getTopDevelopers', () => {
    it('returns developers sorted by DQS desc, with commitCount secondary sort and contract compatibility', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([
        {
          userId: 'dev-1',
          user: { id: 'dev-1', name: 'Dev One', email: 'one@example.com', avatarUrl: null },
        },
        {
          userId: 'dev-2',
          user: { id: 'dev-2', name: 'Dev Two', email: 'two@example.com', avatarUrl: null },
        },
        {
          userId: 'dev-3',
          user: { id: 'dev-3', name: 'Dev Three', email: 'three@example.com', avatarUrl: null },
        },
      ]);

      // Dev 1 has DQS 85, 10 commits
      // Dev 2 has DQS 0, 50 commits
      // Dev 3 has DQS 0, 100 commits (should rank above Dev 2 due to secondary sort)
      prisma.dQSScore.findFirst.mockImplementation(async (args: any) => {
        if (args?.where?.developerId === 'dev-1') return { score: 85 };
        if (args?.where?.developerId === 'dev-2') return null;
        if (args?.where?.developerId === 'dev-3') return { score: 0 };
        return null;
      });

      prisma.commit.count.mockImplementation(async (args: any) => {
        if (args?.where?.developerId === 'dev-1') return 10;
        if (args?.where?.developerId === 'dev-2') return 50;
        if (args?.where?.developerId === 'dev-3') return 100;
        return 0;
      });

      prisma.teamMembership.findFirst.mockImplementation(async (args: any) => {
        if (args?.where?.userId === 'dev-1') return { team: { name: 'Core Team' } };
        return null;
      });

      const topDevs = await service.getTopDevelopers('org-1', 5);

      expect(topDevs).toHaveLength(3);
      // Rank 1: Dev One (DQS 85)
      expect(topDevs[0].id).toBe('dev-1');
      expect(topDevs[0].dqs).toBe(85);
      expect(topDevs[0].commitCount).toBe(10);
      expect(topDevs[0].commits).toBe(10);
      expect(topDevs[0].teamName).toBe('Core Team');

      // Rank 2: Dev Three (DQS 0, 100 commits - beats Dev 2 on secondary sort)
      expect(topDevs[1].id).toBe('dev-3');
      expect(topDevs[1].dqs).toBe(0);
      expect(topDevs[1].commitCount).toBe(100);
      expect(topDevs[1].commits).toBe(100);

      // Rank 3: Dev Two (DQS 0, 50 commits)
      expect(topDevs[2].id).toBe('dev-2');
      expect(topDevs[2].dqs).toBe(0);
      expect(topDevs[2].commitCount).toBe(50);
      expect(topDevs[2].commits).toBe(50);
    });
  });
});


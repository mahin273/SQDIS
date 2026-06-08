import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    repository: Record<string, jest.Mock>;
    team: Record<string, jest.Mock>;
    project: Record<string, jest.Mock>;
    commit: Record<string, jest.Mock>;
    organizationMember: Record<string, jest.Mock>;
    coverageReport: Record<string, jest.Mock>;
    sQSScore: Record<string, jest.Mock>;
    alert: Record<string, jest.Mock>;
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
      project: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      commit: {
        count: jest.fn(),
      },
      organizationMember: {
        count: jest.fn(),
      },
      coverageReport: {
        findFirst: jest.fn(),
      },
      sQSScore: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      alert: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns organization-wide dashboard statistics', async () => {
    prisma.repository.count.mockResolvedValue(3);
    prisma.team.count.mockResolvedValue(2);
    prisma.project.count.mockResolvedValue(4);
    prisma.commit.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(18);
    prisma.organizationMember.count.mockResolvedValue(10);
    prisma.repository.findMany.mockResolvedValue([{ id: 'repo-1' }, { id: 'repo-2' }]);
    prisma.coverageReport.findFirst
      .mockResolvedValueOnce({ coveragePercentage: 80 })
      .mockResolvedValueOnce({ coveragePercentage: 60 });
    prisma.project.findMany.mockResolvedValue([{ id: 'project-1' }]);
    prisma.sQSScore.findFirst.mockResolvedValue({ score: 75 });
    prisma.alert.count.mockResolvedValue(2);

    await expect(service.getOrganizationStats('org-1')).resolves.toEqual({
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

  it('returns an empty SQS trend when the organization has no projects', async () => {
    prisma.project.findMany.mockResolvedValue([]);

    await expect(service.getSQSTrend('org-1', 30)).resolves.toEqual([]);
    expect(prisma.sQSScore.findMany).not.toHaveBeenCalled();
  });
});

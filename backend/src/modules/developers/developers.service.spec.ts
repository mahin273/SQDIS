import { Test, TestingModule } from '@nestjs/testing';
import { DevelopersService } from './developers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoresService } from '../scores/scores.service';
import { createMockPrismaService, MockPrismaService } from '../../../test/mocks/prisma.mock';

describe('DevelopersService', () => {
  let service: DevelopersService;
  let prisma: MockPrismaService;
  let scoresService: Partial<ScoresService>;

  beforeEach(async () => {
    const mockPrisma = createMockPrismaService();
    scoresService = {
      calculateDQS: jest.fn().mockResolvedValue({ score: 75.0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevelopersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ScoresService,
          useValue: scoresService,
        },
      ],
    }).compile();

    service = module.get<DevelopersService>(DevelopersService);
    prisma = module.get<PrismaService>(PrismaService) as unknown as MockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDevelopers', () => {
    it('should return empty list when organizationId is missing', async () => {
      const result = await service.getDevelopers('');
      expect(result).toEqual([]);
    });

    it('should enrich developers with commitCount, dqsTrend, and active team', async () => {
      const mockMembers = [
        {
          id: 'mem-1',
          role: 'OWNER',
          joinedAt: new Date('2026-01-01'),
          user: {
            id: 'user-1',
            name: 'Lead Dev',
            email: 'lead@sqdis.local',
            avatarUrl: null,
            teamMemberships: [
              {
                team: { id: 'team-1', name: 'Core Platform' },
              },
            ],
            dqsScores: [
              { score: 82.5, calculatedAt: new Date('2026-10-20') },
              { score: 80.0, calculatedAt: new Date('2026-10-10') },
            ],
          },
        },
        {
          id: 'mem-2',
          role: 'DEVELOPER',
          joinedAt: new Date('2026-02-01'),
          user: {
            id: 'user-2',
            name: 'Junior Dev',
            email: 'junior@sqdis.local',
            avatarUrl: null,
            teamMemberships: [],
            dqsScores: [
              { score: 68.0, calculatedAt: new Date('2026-10-18') },
            ],
          },
        },
      ];

      (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue(mockMembers);
      (prisma.repository.findMany as jest.Mock).mockResolvedValue([
        { id: 'repo-1', name: 'SQDIS' },
        { id: 'repo-2', name: 'HyTune' },
      ]);
      (prisma.commit.groupBy as jest.Mock).mockResolvedValue([
        { developerId: 'user-1', repositoryId: 'repo-1', _count: { id: 100 } },
        { developerId: 'user-1', repositoryId: 'repo-2', _count: { id: 42 } },
        { developerId: 'user-2', repositoryId: 'repo-1', _count: { id: 37 } },
      ]);

      const result = await service.getDevelopers('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('user-1');
      expect(result[0].commitCount).toBe(142);
      expect(result[0].repositories).toHaveLength(2);
      expect(result[0].repositories?.[0]).toEqual({
        id: 'repo-1',
        name: 'SQDIS',
        commitCount: 100,
      });
      expect(result[0].dqs).toBe(82.5);
      expect(result[0].dqsTrend).toBe(2.5); // 82.5 - 80.0
      expect(result[0].team?.name).toBe('Core Platform');

      expect(result[1].id).toBe('user-2');
      expect(result[1].commitCount).toBe(37);
      expect(result[1].repositories).toHaveLength(1);
      expect(result[1].dqsTrend).toBeNull(); // Only 1 DQS score available
      expect(result[1].team).toBeNull();
    });
  });

  describe('getDeveloperStats', () => {
    it('should calculate repositoryBreakdown percentages and line churn', async () => {
      const mockMember = {
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'DEVELOPER',
        user: {
          id: 'user-1',
          name: 'Lead Dev',
          email: 'lead@sqdis.local',
          avatarUrl: null,
          teamMemberships: [],
        },
      };

      (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(mockMember);
      (prisma.dQSScore.findMany as jest.Mock).mockResolvedValue([
        { score: 85, calculatedAt: new Date('2026-10-21') },
      ]);
      (prisma.commit.aggregate as jest.Mock).mockResolvedValue({
        _count: { id: 100 },
        _sum: { linesAdded: 5000, linesDeleted: 1000 },
      });
      (prisma.commit.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debtItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.commit.groupBy as jest.Mock).mockResolvedValue([
        { repositoryId: 'repo-1', _count: { id: 80 }, _sum: { linesAdded: 4000, linesDeleted: 800 } },
        { repositoryId: 'repo-2', _count: { id: 20 }, _sum: { linesAdded: 1000, linesDeleted: 200 } },
      ]);
      (prisma.repository.findMany as jest.Mock).mockResolvedValue([
        { id: 'repo-1', name: 'SQDIS' },
        { id: 'repo-2', name: 'HyTune' },
      ]);
      (prisma.coverageReport.findMany as jest.Mock).mockResolvedValue([
        { coveragePercentage: 88 },
      ]);

      const stats = await service.getDeveloperStats('user-1', 'org-1');

      expect(stats.userId).toBe('user-1');
      expect(stats.commits).toBe(100);
      expect(stats.repositoryBreakdown).toHaveLength(2);
      expect(stats.repositoryBreakdown?.[0]).toEqual({
        repositoryId: 'repo-1',
        repositoryName: 'SQDIS',
        commitCount: 80,
        linesAdded: 4000,
        linesDeleted: 800,
        percentage: 80.0,
      });
      expect(stats.repositoryBreakdown?.[1]).toEqual({
        repositoryId: 'repo-2',
        repositoryName: 'HyTune',
        commitCount: 20,
        linesAdded: 1000,
        linesDeleted: 200,
        percentage: 20.0,
      });
    });
  });
});

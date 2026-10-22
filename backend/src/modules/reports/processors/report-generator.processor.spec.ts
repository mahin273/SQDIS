import { Test, TestingModule } from '@nestjs/testing';
import { ReportGeneratorProcessor } from './report-generator.processor';
import { PrismaService } from '../../../prisma';
import { FileStorageService } from '../services/file-storage.service';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { ReportScope, ReportType } from '../constants';

describe('ReportGeneratorProcessor', () => {
  let processor: ReportGeneratorProcessor;
  let prisma: {
    organization: Record<string, jest.Mock>;
    repository: Record<string, jest.Mock>;
    project: Record<string, jest.Mock>;
    projectRepository: Record<string, jest.Mock>;
    organizationMember: Record<string, jest.Mock>;
    commit: Record<string, jest.Mock>;
    dQSScore: Record<string, jest.Mock>;
    review: Record<string, jest.Mock>;
    sQSScore: Record<string, jest.Mock>;
    coverageReport: Record<string, jest.Mock>;
    debtItem: Record<string, jest.Mock>;
    pullRequest: Record<string, jest.Mock>;
    report: Record<string, jest.Mock>;
  };
  let fileStorageService: { saveFile: jest.Mock };
  let pdfGeneratorService: { generatePdf: jest.Mock };

  beforeEach(async () => {
    prisma = {
      organization: { findUnique: jest.fn() },
      repository: { findMany: jest.fn(), findUnique: jest.fn() },
      project: { findMany: jest.fn(), findUnique: jest.fn() },
      projectRepository: { findMany: jest.fn() },
      organizationMember: { findMany: jest.fn() },
      commit: { findMany: jest.fn(), count: jest.fn() },
      dQSScore: { findFirst: jest.fn() },
      review: { findMany: jest.fn(), count: jest.fn() },
      sQSScore: { findFirst: jest.fn() },
      coverageReport: { findFirst: jest.fn() },
      debtItem: { findMany: jest.fn() },
      pullRequest: { findMany: jest.fn() },
      report: { update: jest.fn() },
    };

    fileStorageService = {
      saveFile: jest.fn().mockResolvedValue('org-1/report.pdf'),
    };

    pdfGeneratorService = {
      generatePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGeneratorProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: FileStorageService, useValue: fileStorageService },
        { provide: PdfGeneratorService, useValue: pdfGeneratorService },
      ],
    }).compile();

    processor = module.get<ReportGeneratorProcessor>(ReportGeneratorProcessor);
  });

  describe('gatherReportData - telemetry purification and tenant scoping', () => {
    it('scopes telemetry queries to effective organization repositories and returns null for unmeasured telemetry', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Acme Corp' });
      prisma.repository.findMany.mockResolvedValue([
        { id: 'repo-1' },
        { id: 'repo-2' },
      ]);
      prisma.project.findMany.mockResolvedValue([{ id: 'proj-1' }]);
      prisma.organizationMember.findMany.mockResolvedValue([]);

      // No SQS score or coverage report recorded
      prisma.sQSScore.findFirst.mockResolvedValue(null);
      prisma.coverageReport.findFirst.mockResolvedValue(null);
      prisma.debtItem.findMany.mockResolvedValue([]);
      prisma.pullRequest.findMany.mockResolvedValue([]);
      prisma.review.findMany.mockResolvedValue([]);

      const data = await (processor as any).gatherReportData({
        reportId: 'rep-1',
        type: ReportType.EXECUTIVE_SUMMARY,
        scope: ReportScope.ORGANIZATION,
        organizationId: 'org-1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      // Verify SQS queried with effective repo and project IDs
      expect(prisma.sQSScore.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: { in: expect.arrayContaining(['repo-1', 'repo-2', 'proj-1']) },
          calculatedAt: { lte: expect.any(Date) },
        },
        orderBy: { calculatedAt: 'desc' },
      });

      // Verify Coverage queried strictly for organization repositories
      expect(prisma.coverageReport.findFirst).toHaveBeenCalledWith({
        where: {
          repositoryId: { in: ['repo-1', 'repo-2'] },
          status: 'COMPLETED',
          createdAt: { lte: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Verify zero synthetic fallbacks
      expect(data.sqs).toBeNull();
      expect(data.coverage).toBeNull();
      expect(data.technicalDebt.totalItems).toBe(0);
      expect(data.technicalDebt.unresolvedItems).toBe(0);
      expect(data.technicalDebt.topHotspots).toEqual([]);
      expect(data.reviewsAndPrs.totalPrs).toBe(0);
      expect(data.reviewsAndPrs.totalReviews).toBe(0);
      expect(data.reviewsAndPrs.avgTurnaroundHours).toBeNull();
    });

    it('scopes developer metrics strictly to effective repositories and bounds DQS by end date', async () => {
      prisma.commit.findMany.mockResolvedValue([
        { classification: 'FEATURE', linesAdded: 50, linesDeleted: 10 },
        { classification: 'BUGFIX', linesAdded: 20, linesDeleted: 5 },
      ]);
      prisma.dQSScore.findFirst.mockResolvedValue({ score: 85.4 });
      prisma.review.count.mockResolvedValue(4);

      const metrics = await (processor as any).getDeveloperMetrics(
        'dev-1',
        'Alice',
        'alice@example.com',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        'org-1',
        ['repo-1'],
      );

      expect(prisma.commit.findMany).toHaveBeenCalledWith({
        where: {
          developerId: 'dev-1',
          committedAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
          repositoryId: { in: ['repo-1'] },
        },
        select: expect.any(Object),
      });

      expect(prisma.dQSScore.findFirst).toHaveBeenCalledWith({
        where: {
          developerId: 'dev-1',
          calculatedAt: { lte: new Date('2026-01-31') },
        },
        orderBy: { calculatedAt: 'desc' },
        select: { score: true },
      });

      expect(prisma.review.count).toHaveBeenCalledWith({
        where: {
          reviewerId: 'dev-1',
          submittedAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
          repositoryId: { in: ['repo-1'] },
        },
      });

      expect(metrics.totalCommits).toBe(2);
      expect(metrics.featureCommits).toBe(1);
      expect(metrics.bugfixCommits).toBe(1);
      expect(metrics.linesAdded).toBe(70);
      expect(metrics.linesDeleted).toBe(15);
      expect(metrics.reviewsGiven).toBe(4);
      expect(metrics.dqsScore).toBe(85.4);
    });

    it('preserves real zero activity when no commits exist in the requested date range without synthesizing data', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Acme Corp' });
      prisma.repository.findMany.mockResolvedValue([{ id: 'repo-1' }]);
      prisma.project.findMany.mockResolvedValue([]);
      prisma.organizationMember.findMany.mockResolvedValue([
        { user: { id: 'user-1', name: 'Bob', email: 'bob@example.com' } },
      ]);

      // Developer has 0 commits in window
      prisma.commit.findMany.mockResolvedValue([]);
      prisma.dQSScore.findFirst.mockResolvedValue(null);
      prisma.review.count.mockResolvedValue(0);

      prisma.sQSScore.findFirst.mockResolvedValue(null);
      prisma.coverageReport.findFirst.mockResolvedValue(null);
      prisma.debtItem.findMany.mockResolvedValue([]);
      prisma.pullRequest.findMany.mockResolvedValue([]);
      prisma.review.findMany.mockResolvedValue([]);

      const data = await (processor as any).gatherReportData({
        reportId: 'rep-2',
        type: ReportType.EXECUTIVE_SUMMARY,
        scope: ReportScope.ORGANIZATION,
        organizationId: 'org-1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(data.developers).toHaveLength(1);
      expect(data.developers[0].name).toBe('Bob');
      expect(data.developers[0].totalCommits).toBe(0);
      expect(data.developers[0].linesAdded).toBe(0);
      expect(data.developers[0].bugfixCommits).toBe(0);
      expect(data.developers[0].featureCommits).toBe(0);
      expect(data.developers[0].reviewsGiven).toBe(0);
      expect(data.developers[0].dqsScore).toBeNull();
      expect(data.summary.totalCommits).toBe(0);
      expect(data.summary.avgDQS).toBeNull();
    });
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma';
import { ReportsService } from './reports.service';
import { FileStorageService } from './services/file-storage.service';
import { REPORT_QUEUE, ReportType, ReportScope, ReportStatus } from './constants';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    report: Record<string, jest.Mock>;
    team: Record<string, jest.Mock>;
    project: Record<string, jest.Mock>;
    repository: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
  };
  let queue: { add: jest.Mock };
  let fileStorageService: { deleteFile: jest.Mock; getFileStream: jest.Mock };

  const mockReport = {
    id: 'report-1',
    type: ReportType.EXECUTIVE_SUMMARY,
    scope: ReportScope.ORGANIZATION,
    status: ReportStatus.PENDING,
    title: 'Executive Summary Report',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-31T00:00:00.000Z'),
    fileUrl: null,
    fileSize: null,
    organizationId: 'org-1',
    createdById: 'user-1',
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    generatedAt: null,
    errorMessage: null,
  };

  beforeEach(async () => {
    prisma = {
      report: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      team: {
        findFirst: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
      },
      repository: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    fileStorageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getFileStream: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(REPORT_QUEUE), useValue: queue },
        { provide: FileStorageService, useValue: fileStorageService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReport', () => {
    it('creates a report and enqueues BullMQ generation job', async () => {
      prisma.report.create.mockResolvedValue(mockReport);

      const result = await service.createReport(
        {
          type: ReportType.EXECUTIVE_SUMMARY,
          scope: ReportScope.ORGANIZATION,
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          title: 'Executive Summary Report',
        },
        'org-1',
        'user-1',
      );

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            type: ReportType.EXECUTIVE_SUMMARY,
            status: ReportStatus.PENDING,
          }),
        }),
      );

      expect(queue.add).toHaveBeenCalledWith(
        'generate-report',
        expect.objectContaining({
          reportId: 'report-1',
          type: ReportType.EXECUTIVE_SUMMARY,
        }),
        expect.objectContaining({ jobId: 'report-report-1' }),
      );

      expect(result.id).toBe('report-1');
    });

    it('rejects reports when endDate is before or equal to startDate', async () => {
      await expect(
        service.createReport(
          {
            type: ReportType.EXECUTIVE_SUMMARY,
            scope: ReportScope.ORGANIZATION,
            startDate: '2026-01-31',
            endDate: '2026-01-01',
          },
          'org-1',
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates team scope and rejects if team does not belong to organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.createReport(
          {
            type: ReportType.TEAM_PERFORMANCE,
            scope: ReportScope.TEAM,
            teamId: 'team-invalid',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
          'org-1',
          'user-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects repository scope reports if repositoryId is missing', async () => {
      await expect(
        service.createReport(
          {
            type: ReportType.EXECUTIVE_SUMMARY,
            scope: ReportScope.REPOSITORY,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
          'org-1',
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects repository scope reports if repository does not belong to organization', async () => {
      prisma.repository.findFirst.mockResolvedValue(null);

      await expect(
        service.createReport(
          {
            type: ReportType.EXECUTIVE_SUMMARY,
            scope: ReportScope.REPOSITORY,
            repositoryId: 'repo-foreign',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
          'org-1',
          'user-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates repository scope reports when repository belongs to organization', async () => {
      prisma.repository.findFirst.mockResolvedValue({ id: 'repo-1', organizationId: 'org-1' });
      prisma.report.create.mockResolvedValue({ ...mockReport, scope: ReportScope.REPOSITORY, repositoryId: 'repo-1' });

      const result = await service.createReport(
        {
          type: ReportType.EXECUTIVE_SUMMARY,
          scope: ReportScope.REPOSITORY,
          repositoryId: 'repo-1',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        'org-1',
        'user-1',
      );

      expect(prisma.repository.findFirst).toHaveBeenCalledWith({
        where: { id: 'repo-1', organizationId: 'org-1' },
      });
      expect(result.id).toBe('report-1');
    });
  });

  describe('findAll', () => {
    it('returns paginated reports list with metadata', async () => {
      prisma.report.findMany.mockResolvedValue([mockReport]);
      prisma.report.count.mockResolvedValue(1);

      const result = await service.findAll('org-1', { page: 1, limit: 10 });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('findById', () => {
    it('returns report details when found', async () => {
      prisma.report.findFirst.mockResolvedValue(mockReport);

      const result = await service.findById('report-1', 'org-1');
      expect(result.id).toBe('report-1');
      expect(result.title).toBe('Executive Summary Report');
    });

    it('throws NotFoundException when report is not found', async () => {
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(service.findById('missing', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('returns local file path when report is completed', async () => {
      prisma.report.findFirst.mockResolvedValue({
        ...mockReport,
        status: ReportStatus.COMPLETED,
        filePath: 'org-1/report-1.pdf',
      });
      (fileStorageService as any).getFilePath = jest.fn().mockReturnValue('/storage/org-1/report-1.pdf');

      const path = await service.getDownloadUrl('report-1', 'org-1');

      expect(path).toBe('/storage/org-1/report-1.pdf');
    });

    it('throws BadRequestException when report is not yet completed', async () => {
      prisma.report.findFirst.mockResolvedValue({
        ...mockReport,
        status: ReportStatus.PENDING,
      });

      await expect(service.getDownloadUrl('report-1', 'org-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('retryFailedReport', () => {
    it('re-enqueues job and updates status to PENDING for failed report', async () => {
      prisma.report.findFirst.mockResolvedValue({
        ...mockReport,
        status: ReportStatus.FAILED,
      });
      prisma.report.update.mockResolvedValue({
        ...mockReport,
        status: ReportStatus.PENDING,
      });
      prisma.report.findUnique.mockResolvedValue({
        ...mockReport,
        status: ReportStatus.PENDING,
      });

      const retried = await service.retryFailedReport('report-1', 'org-1');

      expect(queue.add).toHaveBeenCalledWith(
        'generate-report',
        expect.anything(),
        expect.anything(),
      );
      expect(retried.status).toBe(ReportStatus.PENDING);
    });
  });
});

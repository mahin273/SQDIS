jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { PrismaService } from '../../prisma';
import { COVERAGE_QUEUE, CoverageFormat, CoverageStatus } from './constants';
import { CoverageService } from './coverage.service';

describe('CoverageService', () => {
  let service: CoverageService;
  let prisma: {
    repository: Record<string, jest.Mock>;
    coverageReport: Record<string, jest.Mock>;
    coverageModule: Record<string, jest.Mock>;
  };
  let coverageQueue: { add: jest.Mock };

  const report = {
    id: 'report-1',
    repositoryId: 'repo-1',
    format: CoverageFormat.LCOV,
    status: CoverageStatus.COMPLETED,
    originalFilename: 'lcov.info',
    fileSize: 1024,
    fileHash: 'hash-1',
    commitSha: null,
    branch: 'main',
    linesTotal: 100,
    linesCovered: 80,
    coveragePercentage: 80,
    previousCoveragePercentage: null,
    coverageDelta: null,
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    processedAt: new Date('2026-01-01T00:05:00.000Z'),
    repository: { id: 'repo-1', name: 'api', fullName: 'acme/api' },
    modules: [],
  };

  beforeEach(async () => {
    prisma = {
      repository: {
        findFirst: jest.fn(),
      },
      coverageReport: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      coverageModule: {
        createMany: jest.fn(),
      },
    };
    coverageQueue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverageService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(COVERAGE_QUEUE), useValue: coverageQueue },
      ],
    }).compile();

    service = module.get<CoverageService>(CoverageService);
    jest.mocked(readFileSync).mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uploads a coverage report and queues parsing', async () => {
    const file = {
      path: '/tmp/lcov.info',
      originalname: 'lcov.info',
      size: 1024,
    } as Express.Multer.File;

    jest.mocked(readFileSync).mockImplementation((path, encoding) => {
      if (encoding === 'utf-8') {
        return 'SF:src/app.ts\nDA:1,1\nend_of_record';
      }
      return Buffer.from('SF:src/app.ts');
    });

    prisma.repository.findFirst.mockResolvedValue({ id: 'repo-1' });
    prisma.coverageReport.findFirst.mockResolvedValue(null);
    prisma.coverageReport.create.mockResolvedValue({
      ...report,
      status: CoverageStatus.PENDING,
      processedAt: null,
    });

    await expect(
      service.uploadCoverage(file, 'repo-1', 'org-1', 'user-1', undefined, 'main'),
    ).resolves.toMatchObject({
      id: 'report-1',
      format: CoverageFormat.LCOV,
      status: CoverageStatus.PENDING,
    });

    expect(coverageQueue.add).toHaveBeenCalledWith(
      'parse-coverage',
      expect.objectContaining({
        reportId: 'report-1',
        repositoryId: 'repo-1',
        organizationId: 'org-1',
      }),
      expect.objectContaining({
        jobId: 'coverage-report-1',
      }),
    );
  });

  it('rejects invalid commit SHA values', async () => {
    const file = { path: '/tmp/lcov.info', originalname: 'lcov.info', size: 10 } as Express.Multer.File;

    await expect(
      service.uploadCoverage(file, 'repo-1', 'org-1', 'user-1', 'not-a-sha'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns paginated coverage reports for an organization', async () => {
    prisma.coverageReport.findMany.mockResolvedValue([report]);
    prisma.coverageReport.count.mockResolvedValue(1);

    await expect(service.findAll('org-1', { page: 1, limit: 20 })).resolves.toEqual({
      reports: [expect.objectContaining({ id: 'report-1' })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('returns a coverage report by id', async () => {
    prisma.coverageReport.findFirst.mockResolvedValue(report);

    await expect(service.findById('report-1', 'org-1')).resolves.toMatchObject({
      id: 'report-1',
      repositoryId: 'repo-1',
    });
  });

  it('throws when a coverage report is not found', async () => {
    prisma.coverageReport.findFirst.mockResolvedValue(null);

    await expect(service.findById('missing', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the latest completed report for a repository', async () => {
    prisma.coverageReport.findFirst.mockResolvedValue(report);

    await expect(service.findLatest('repo-1', 'org-1')).resolves.toMatchObject({
      id: 'report-1',
      status: CoverageStatus.COMPLETED,
    });
  });

  it('creates coverage modules in a single batch for small reports', async () => {
    await service.createModules('report-1', [
      {
        modulePath: 'src/app.ts',
        linesTotal: 10,
        linesCovered: 8,
        coveragePercentage: 80,
      },
    ]);

    expect(prisma.coverageModule.createMany).toHaveBeenCalledWith({
      data: [
        {
          reportId: 'report-1',
          modulePath: 'src/app.ts',
          linesTotal: 10,
          linesCovered: 8,
          coveragePercentage: 80,
        },
      ],
    });
  });
});

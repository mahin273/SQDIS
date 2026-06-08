import { Test, TestingModule } from '@nestjs/testing';
import { DebtMarker } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { DebtService } from './debt.service';
import { DebtScannerService } from './services';

describe('DebtService', () => {
  let service: DebtService;
  let prisma: {
    debtItem: Record<string, jest.Mock>;
  };

  const debtItem = {
    id: 'debt-1',
    repositoryId: 'repo-1',
    markerType: DebtMarker.TODO,
    content: 'Refactor this module',
    filePath: 'src/app.ts',
    lineNumber: 42,
    isResolved: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    resolvedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      debtItem: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtService,
        { provide: PrismaService, useValue: prisma },
        { provide: DebtScannerService, useValue: {} },
      ],
    }).compile();

    service = module.get<DebtService>(DebtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated debt items scoped to the organization', async () => {
    prisma.debtItem.findMany.mockResolvedValue([debtItem]);
    prisma.debtItem.count.mockResolvedValue(1);

    await expect(
      service.findAll('org-1', { page: 1, limit: 20, repositoryId: 'repo-1' }),
    ).resolves.toEqual({
      data: [debtItem],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    expect(prisma.debtItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repository: { organizationId: 'org-1' },
          repositoryId: 'repo-1',
        },
      }),
    );
  });

  it('creates a debt item with marker metadata', async () => {
    prisma.debtItem.create.mockResolvedValue(debtItem);

    await expect(
      service.create({
        repositoryId: 'repo-1',
        commitId: 'commit-1',
        authorId: 'user-1',
        markerType: DebtMarker.TODO,
        content: 'Refactor this module',
        filePath: 'src/app.ts',
        lineNumber: 42,
      }),
    ).resolves.toEqual(debtItem);
  });

  it('marks a debt item as resolved', async () => {
    prisma.debtItem.update.mockResolvedValue({
      ...debtItem,
      isResolved: true,
      resolvedAt: new Date('2026-01-10T00:00:00.000Z'),
      resolverId: 'user-2',
      resolvedCommitId: 'commit-2',
    });

    const result = await service.resolve('debt-1', 'user-2', 'commit-2');

    expect(prisma.debtItem.update).toHaveBeenCalledWith({
      where: { id: 'debt-1' },
      data: {
        isResolved: true,
        resolvedAt: expect.any(Date),
        resolverId: 'user-2',
        resolvedCommitId: 'commit-2',
      },
    });
    expect(result.isResolved).toBe(true);
  });

  it('calculates time-to-resolution for resolved items', () => {
    const resolvedAt = new Date('2026-01-11T00:00:00.000Z');
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    expect(
      service.calculateTimeToResolution({
        ...debtItem,
        isResolved: true,
        resolvedAt,
        createdAt,
      } as any),
    ).toBe(resolvedAt.getTime() - createdAt.getTime());
    expect(
      service.calculateTimeToResolution({
        ...debtItem,
        isResolved: false,
        resolvedAt: null,
      } as any),
    ).toBeNull();
  });

  it('returns average resolution time in days', async () => {
    prisma.debtItem.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        resolvedAt: new Date('2026-01-11T00:00:00.000Z'),
      },
      {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        resolvedAt: new Date('2026-01-21T00:00:00.000Z'),
      },
    ]);

    await expect(service.getAverageTimeToResolution('org-1')).resolves.toBe(15);
  });

  it('returns null average resolution time when no resolved items exist', async () => {
    prisma.debtItem.findMany.mockResolvedValue([]);

    await expect(service.getAverageTimeToResolution('org-1')).resolves.toBeNull();
  });
});

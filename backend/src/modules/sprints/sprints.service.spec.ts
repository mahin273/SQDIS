import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma';
import { SprintsService } from './sprints.service';

describe('SprintsService', () => {
  let service: SprintsService;
  let prisma: {
    team: Record<string, jest.Mock>;
    sprint: Record<string, jest.Mock>;
  };

  const sprint = {
    id: 'sprint-1',
    name: 'Sprint 1',
    organizationId: 'org-1',
    teamId: 'team-1',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-15T00:00:00.000Z'),
    isActive: true,
    team: { id: 'team-1', name: 'Backend' },
  };

  beforeEach(async () => {
    prisma = {
      team: {
        findFirst: jest.fn(),
      },
      sprint: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SprintsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SprintsService>(SprintsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a sprint when the team exists and dates do not overlap', async () => {
    prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });
    prisma.sprint.findFirst.mockResolvedValue(null);
    prisma.sprint.create.mockResolvedValue(sprint);

    await expect(
      service.create(
        {
          name: 'Sprint 1',
          teamId: 'team-1',
          startDate: '2026-01-01',
          endDate: '2026-01-15',
        },
        'org-1',
      ),
    ).resolves.toEqual(sprint);
  });

  it('rejects sprints whose end date is not after the start date', async () => {
    prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });

    await expect(
      service.create(
        {
          name: 'Invalid sprint',
          teamId: 'team-1',
          startDate: '2026-01-15',
          endDate: '2026-01-01',
        },
        'org-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects overlapping sprint dates for the same team', async () => {
    prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });
    prisma.sprint.findFirst.mockResolvedValue({ id: 'sprint-2', name: 'Sprint 0' });

    await expect(
      service.create(
        {
          name: 'Sprint 1',
          teamId: 'team-1',
          startDate: '2026-01-01',
          endDate: '2026-01-15',
        },
        'org-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists active sprints for an organization', async () => {
    prisma.sprint.findMany.mockResolvedValue([sprint]);

    await expect(service.findAll('org-1', 'team-1')).resolves.toEqual([sprint]);
    expect(prisma.sprint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          isActive: true,
          teamId: 'team-1',
        },
      }),
    );
  });

  it('soft deletes a sprint', async () => {
    prisma.sprint.findUnique.mockResolvedValue(sprint);
    prisma.sprint.update.mockResolvedValue({ ...sprint, isActive: false });

    await expect(service.delete('sprint-1')).resolves.toMatchObject({ isActive: false });
  });

  it('throws when deleting a missing sprint', async () => {
    prisma.sprint.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('verifies sprint access within the organization', async () => {
    prisma.sprint.findFirst.mockResolvedValue(sprint);

    await expect(service.verifySprintAccess('sprint-1', 'org-1')).resolves.toEqual(sprint);
  });

  it('denies access to sprints outside the organization', async () => {
    prisma.sprint.findFirst.mockResolvedValue(null);

    await expect(service.verifySprintAccess('sprint-1', 'other-org')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('detects overlapping sprint windows', async () => {
    prisma.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-2' });

    await expect(
      service.checkOverlap(
        'team-1',
        new Date('2026-01-10T00:00:00.000Z'),
        new Date('2026-01-20T00:00:00.000Z'),
      ),
    ).resolves.toBe(true);

    prisma.sprint.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.checkOverlap(
        'team-1',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-15T00:00:00.000Z'),
      ),
    ).resolves.toBe(false);
  });
});

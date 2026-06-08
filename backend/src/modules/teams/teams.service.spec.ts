import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma';
import { CacheService } from '../cache';
import { DataFilterService } from '../auth/services/data-filter.service';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: {
    team: Record<string, jest.Mock>;
    teamMembership: Record<string, jest.Mock>;
    teamProjectAssignment: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    commit: Record<string, jest.Mock>;
    dQSScore: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let cacheService: { deletePattern: jest.Mock };
  let dataFilterService: { createTeamFilter: jest.Mock };

  const team = {
    id: 'team-1',
    name: 'Backend',
    description: 'Backend engineers',
    organizationId: 'org-1',
    isActive: true,
    leadId: null,
  };

  beforeEach(async () => {
    prisma = {
      team: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      teamMembership: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      teamProjectAssignment: {
        updateMany: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      commit: {
        count: jest.fn(),
      },
      dQSScore: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    cacheService = {
      deletePattern: jest.fn(),
    };
    dataFilterService = {
      createTeamFilter: jest.fn(() => ({ organizationId: 'org-1' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cacheService },
        { provide: DataFilterService, useValue: dataFilterService },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a team and invalidates leaderboard cache', async () => {
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.team.create.mockResolvedValue({
      ...team,
      _count: { memberships: 0 },
    });

    const result = await service.create({ name: 'Backend', description: 'Backend engineers' }, 'org-1');

    expect(result.name).toBe('Backend');
    expect(cacheService.deletePattern).toHaveBeenCalled();
  });

  it('rejects duplicate team names within the organization', async () => {
    prisma.team.findFirst.mockResolvedValue(team);

    await expect(
      service.create({ name: 'Backend', description: 'Duplicate' }, 'org-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns a team by id or throws when missing', async () => {
    prisma.team.findUnique.mockResolvedValueOnce(team);
    await expect(service.findById('team-1')).resolves.toMatchObject({ id: 'team-1' });

    prisma.team.findUnique.mockResolvedValueOnce(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a team and rejects duplicate renamed names', async () => {
    prisma.team.findUnique.mockResolvedValueOnce(team);
    prisma.team.findFirst.mockResolvedValueOnce({ id: 'team-2', name: 'Frontend' });
    await expect(service.update('team-1', { name: 'Frontend' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.team.findUnique.mockResolvedValueOnce(team);
    prisma.team.findFirst.mockResolvedValueOnce(null);
    prisma.team.update.mockResolvedValue({ ...team, name: 'Platform' });

    await expect(service.update('team-1', { name: 'Platform' })).resolves.toMatchObject({
      name: 'Platform',
    });
  });

  it('adds a member when the user belongs to the same organization', async () => {
    prisma.team.findUnique.mockResolvedValue(team);
    prisma.teamMembership.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2' });
    prisma.teamMembership.create.mockResolvedValue({
      id: 'membership-1',
      teamId: 'team-1',
      userId: 'user-2',
      user: { id: 'user-2', name: 'Member', email: 'member@example.com', avatarUrl: null },
    });

    await expect(service.addMember('team-1', { userId: 'user-2' })).resolves.toMatchObject({
      userId: 'user-2',
    });
    expect(cacheService.deletePattern).toHaveBeenCalled();
  });

  it('rejects adding a user who is already an active member', async () => {
    prisma.team.findUnique.mockResolvedValue(team);
    prisma.teamMembership.findFirst.mockResolvedValue({ id: 'membership-1' });

    await expect(service.addMember('team-1', { userId: 'user-2' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('prevents removing the current team lead', async () => {
    prisma.teamMembership.findFirst.mockResolvedValue({ id: 'membership-1' });
    prisma.team.findUnique.mockResolvedValue({ ...team, leadId: 'user-2' });

    await expect(service.removeMember('team-1', 'user-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('soft deletes a team and invalidates leaderboard cache', async () => {
    prisma.team.findUnique.mockResolvedValue(team);

    await service.delete('team-1');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { isActive: false },
    });
    expect(cacheService.deletePattern).toHaveBeenCalled();
  });
});

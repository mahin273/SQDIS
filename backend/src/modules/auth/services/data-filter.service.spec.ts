import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma';
import { DataFilterService } from './data-filter.service';

describe('DataFilterService', () => {
  let service: DataFilterService;
  let prisma: {
    teamMembership: Record<string, jest.Mock>;
    team: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      teamMembership: {
        findMany: jest.fn(),
      },
      team: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DataFilterService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DataFilterService>(DataFilterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('scopes queries to an organization', () => {
    expect(service.createOrganizationFilter('org-1')).toEqual({ organizationId: 'org-1' });
  });

  describe('createTeamFilter', () => {
    it('returns organization scope for admin and owner roles', async () => {
      await expect(service.createTeamFilter('user-1', Role.ADMIN, 'org-1')).resolves.toEqual({
        organizationId: 'org-1',
      });
      await expect(service.createTeamFilter('user-1', Role.OWNER, 'org-1')).resolves.toEqual({
        organizationId: 'org-1',
      });
      expect(prisma.teamMembership.findMany).not.toHaveBeenCalled();
    });

    it('limits developers to active team memberships', async () => {
      const filter = await service.createTeamFilter('user-1', Role.DEVELOPER, 'org-1');

      expect(filter).toEqual({
        organizationId: 'org-1',
        memberships: {
          some: {
            userId: 'user-1',
            leftAt: null,
          },
        },
      });
    });

    it('allows team leads to see teams they lead or belong to', async () => {
      const filter = await service.createTeamFilter('user-1', Role.TEAM_LEAD, 'org-1');

      expect(filter).toEqual({
        organizationId: 'org-1',
        OR: [
          { leadId: 'user-1' },
          {
            memberships: {
              some: {
                userId: 'user-1',
                leftAt: null,
              },
            },
          },
        ],
      });
    });
  });

  describe('createProjectFilter', () => {
    it('returns organization scope for admin and owner roles', async () => {
      await expect(service.createProjectFilter('user-1', Role.OWNER, 'org-1')).resolves.toEqual({
        organizationId: 'org-1',
      });
    });

    it('limits developers to projects assigned to their teams', async () => {
      prisma.teamMembership.findMany.mockResolvedValue([{ teamId: 'team-1' }, { teamId: 'team-2' }]);

      await expect(service.createProjectFilter('user-1', Role.DEVELOPER, 'org-1')).resolves.toEqual({
        organizationId: 'org-1',
        teamAssignments: {
          some: {
            teamId: {
              in: ['team-1', 'team-2'],
            },
          },
        },
      });
    });

    it('limits team leads to projects assigned to teams they lead', async () => {
      prisma.team.findMany.mockResolvedValue([{ id: 'team-3' }]);

      await expect(service.createProjectFilter('user-1', Role.TEAM_LEAD, 'org-1')).resolves.toEqual({
        organizationId: 'org-1',
        teamAssignments: {
          some: {
            teamId: {
              in: ['team-3'],
            },
          },
        },
      });
    });
  });

  describe('createRepositoryFilter', () => {
    it('limits developers to repositories in their assigned projects', async () => {
      prisma.teamMembership.findMany.mockResolvedValue([{ teamId: 'team-1' }]);

      await expect(service.createRepositoryFilter('user-1', Role.DEVELOPER, 'org-1')).resolves.toEqual({
        organizationId: 'org-1',
        projectRepositories: {
          some: {
            project: {
              teamAssignments: {
                some: {
                  teamId: {
                    in: ['team-1'],
                  },
                },
              },
            },
          },
        },
      });
    });
  });
});

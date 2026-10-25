import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma';
import { DataFilterService } from './data-filter.service';

describe('DataFilterService', () => {
  let service: DataFilterService;
  let prisma: {
    teamMembership: Record<string, jest.Mock>;
    team: Record<string, jest.Mock>;
    organizationMember: Record<string, jest.Mock>;
    teamProjectAssignment: Record<string, jest.Mock>;
    projectRepository: Record<string, jest.Mock>;
    repository: Record<string, jest.Mock>;
    project: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
      teamMembership: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      team: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
      },
      teamProjectAssignment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      projectRepository: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      repository: {
        findFirst: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
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

  describe('getScopedProjectAndRepoIds', () => {
    it('returns organization scope for owner or admin', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.ADMIN });

      const result = await service.getScopedProjectAndRepoIds('user-1', 'org-1');
      expect(result.isOrgScoped).toBe(true);
      expect(result.effectiveRole).toBe(Role.ADMIN);
    });

    it('returns assigned projects and repositories for developer', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });
      prisma.team.findMany.mockResolvedValue([{ id: 'team-1' }]);
      prisma.teamProjectAssignment.findMany.mockResolvedValue([{ projectId: 'proj-1' }]);
      prisma.projectRepository.findMany.mockResolvedValue([{ repositoryId: 'repo-1' }]);

      const result = await service.getScopedProjectAndRepoIds('user-1', 'org-1');
      expect(result.isOrgScoped).toBe(false);
      expect(result.projectIds).toEqual(['proj-1']);
      expect(result.repositoryIds).toEqual(['repo-1']);
      expect(result.teamIds).toEqual(['team-1']);
    });
  });

  describe('verifyRepositoryAccess', () => {
    it('allows owner access to any repository in organization', async () => {
      prisma.repository.findFirst.mockResolvedValue({ id: 'repo-1', organizationId: 'org-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.OWNER });

      await expect(
        service.verifyRepositoryAccess('repo-1', 'org-1', { id: 'user-1' }),
      ).resolves.toEqual({ repositoryId: 'repo-1', organizationId: 'org-1' });
    });

    it('throws forbidden exception if developer lacks team project assignment', async () => {
      prisma.repository.findFirst.mockResolvedValue({ id: 'repo-1', organizationId: 'org-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });
      prisma.projectRepository.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyRepositoryAccess('repo-1', 'org-1', { id: 'user-1' }),
      ).rejects.toThrow('Access denied: This repository is not part of any project assigned to your active teams.');
    });
  });

  describe('verifyTeamAccess', () => {
    it('allows owner access to any team in organization', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 'team-1', organizationId: 'org-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.OWNER });

      await expect(
        service.verifyTeamAccess('team-1', 'org-1', { id: 'user-1' }),
      ).resolves.toEqual({ teamId: 'team-1', organizationId: 'org-1' });
    });

    it('throws forbidden if developer does not belong to team', async () => {
      prisma.team.findFirst
        .mockResolvedValueOnce({ id: 'team-1', organizationId: 'org-1' })
        .mockResolvedValueOnce(null);
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });

      await expect(
        service.verifyTeamAccess('team-1', 'org-1', { id: 'user-1' }),
      ).rejects.toThrow('Access denied: You are not an active member or leader of this team.');
    });
  });

  describe('verifyProjectAccess', () => {
    it('allows owner access to any project in organization', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organizationId: 'org-1', isActive: true });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.OWNER });

      await expect(
        service.verifyProjectAccess('proj-1', 'org-1', { id: 'user-1' }),
      ).resolves.toEqual({ projectId: 'proj-1', organizationId: 'org-1' });
    });

    it('allows developer access if project is assigned to active team', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organizationId: 'org-1', isActive: true });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });
      prisma.teamProjectAssignment.findFirst.mockResolvedValue({ id: 'tpa-1' });

      await expect(
        service.verifyProjectAccess('proj-1', 'org-1', { id: 'user-1' }),
      ).resolves.toEqual({ projectId: 'proj-1', organizationId: 'org-1' });
    });

    it('throws forbidden if developer has no team assigned to project', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organizationId: 'org-1', isActive: true });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });
      prisma.teamProjectAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyProjectAccess('proj-1', 'org-1', { id: 'user-1' }),
      ).rejects.toThrow('Access denied: This project is not assigned to any of your active teams.');
    });

    it('throws not found if project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyProjectAccess('unknown-proj', 'org-1', { id: 'user-1' }),
      ).rejects.toThrow('Project with ID unknown-proj not found in organization');
    });
  });

  describe('verifyOrganizationAccess', () => {
    it('allows access when user is an active organization member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });

      await expect(
        service.verifyOrganizationAccess('org-1', 'user-1'),
      ).resolves.toEqual({ organizationId: 'org-1', role: Role.DEVELOPER });
    });

    it('allows access when user possesses one of the allowed roles', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.ADMIN });

      await expect(
        service.verifyOrganizationAccess('org-1', 'user-1', [Role.ADMIN, Role.OWNER]),
      ).resolves.toEqual({ organizationId: 'org-1', role: Role.ADMIN });
    });

    it('throws forbidden when user is not a member of the organization', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyOrganizationAccess('org-1', 'user-1'),
      ).rejects.toThrow('Access denied: You are not an active member of this organization.');
    });

    it('throws forbidden when user role does not match allowed roles', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });

      await expect(
        service.verifyOrganizationAccess('org-1', 'user-1', [Role.ADMIN, Role.OWNER]),
      ).rejects.toThrow('Access denied: Caller lacks required role in organization.');
    });
  });

  describe('verifyDeveloperAccess', () => {
    it('allows owner access to any developer in organization', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'dev-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.OWNER });

      await expect(
        service.verifyDeveloperAccess('dev-1', 'org-1', { id: 'caller-1' }),
      ).resolves.toEqual({ developerId: 'dev-1', organizationId: 'org-1' });
    });

    it('allows developer to access their own developer data', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'dev-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });

      await expect(
        service.verifyDeveloperAccess('dev-1', 'org-1', { id: 'dev-1' }),
      ).resolves.toEqual({ developerId: 'dev-1', organizationId: 'org-1' });
    });

    it('throws forbidden when developer attempts to access another developer data', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'dev-2' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.DEVELOPER });

      await expect(
        service.verifyDeveloperAccess('dev-2', 'org-1', { id: 'dev-1' }),
      ).rejects.toThrow('Developers can only access their own developer data.');
    });

    it('allows team lead to access developer data for members of assigned teams', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'dev-2' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.TEAM_LEAD });
      prisma.teamMembership.findFirst.mockResolvedValue({ id: 'tm-1' });

      await expect(
        service.verifyDeveloperAccess('dev-2', 'org-1', { id: 'lead-1' }),
      ).resolves.toEqual({ developerId: 'dev-2', organizationId: 'org-1' });
    });

    it('throws forbidden when team lead attempts to access developer outside assigned teams', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'dev-3' });
      prisma.organizationMember.findUnique.mockResolvedValue({ role: Role.TEAM_LEAD });
      prisma.teamMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyDeveloperAccess('dev-3', 'org-1', { id: 'lead-1' }),
      ).rejects.toThrow('Team Leads can only access developer data for members of their assigned teams.');
    });

    it('throws not found when developer does not exist in organization', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyDeveloperAccess('unknown-dev', 'org-1', { id: 'caller-1' }),
      ).rejects.toThrow('Developer with ID unknown-dev not found in organization');
    });
  });
});

/* eslint-disable */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Service for generating Prisma where clauses that filter data based on user role and organization.
 * Ensures data isolation and role-based access control at the query level.
 */
@Injectable()
export class DataFilterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a basic organization filter for Prisma queries.
   * This filter ensures that all queries are scoped to a specific organization,
   * preventing cross-organization data leakage.
   *
   * @param organizationId - The organization ID to filter by
   * @returns Prisma where clause with organization filter
   *
   * @example
   * const filter = dataFilterService.createOrganizationFilter('org-123');
   * const teams = await prisma.team.findMany({ where: filter });
   *
   */
  createOrganizationFilter(organizationId: string): { organizationId: string } {
    return {
      organizationId,
    };
  }

  /**
   * Create a role-based team filter for Prisma queries.
   * Filters teams based on the user's role and membership:
   * - DEVELOPER: Only teams where user is a member
   * - TEAM_LEAD: Teams where user is a member OR teams where user is the lead
   * - ADMIN/OWNER: All teams in the organization
   *
   * @param userId - The user ID to filter by
   * @param userRole - The user's role
   * @param organizationId - The organization ID to filter by
   * @returns Prisma where clause with role-based team filter
   *
   * @example
   * const filter = await dataFilterService.createTeamFilter('user-123', Role.DEVELOPER, 'org-456');
   * const teams = await prisma.team.findMany({ where: filter });
   *
   */
  async createTeamFilter(
    userId: string,
    userRole: Role,
    organizationId: string,
  ): Promise<Prisma.TeamWhereInput> {
    // ADMIN and OWNER can see all teams in their organization
    if (userRole === Role.ADMIN || userRole === Role.OWNER) {
      return {
        organizationId,
      };
    }

    // TEAM_LEAD can see teams they lead or are members of
    if (userRole === Role.TEAM_LEAD) {
      return {
        organizationId,
        OR: [
          {
            leadId: userId,
          },
          {
            memberships: {
              some: {
                userId,
                leftAt: null,
              },
            },
          },
        ],
      };
    }

    // DEVELOPER can only see teams they are members of
    return {
      organizationId,
      memberships: {
        some: {
          userId,
          leftAt: null, // Only active memberships
        },
      },
    };
  }

  /**
   * Create a role-based project filter for Prisma queries.
   * Filters projects based on the user's role and team assignments:
   * - DEVELOPER: Only projects assigned to teams the user is a member of
   * - TEAM_LEAD: Projects assigned to teams the user leads
   * - ADMIN/OWNER: All projects in the organization
   *
   * @param userId - The user ID to filter by
   * @param userRole - The user's role
   * @param organizationId - The organization ID to filter by
   * @returns Prisma where clause with role-based project filter
   *
   * @example
   * const filter = await dataFilterService.createProjectFilter('user-123', Role.DEVELOPER, 'org-456');
   * const projects = await prisma.project.findMany({ where: filter });
   */
  async createProjectFilter(
    userId: string,
    userRole: Role,
    organizationId: string,
  ): Promise<Prisma.ProjectWhereInput> {
    // ADMIN and OWNER can see all projects in their organization
    if (userRole === Role.ADMIN || userRole === Role.OWNER) {
      return {
        organizationId,
      };
    }

    // TEAM_LEAD can see projects assigned to teams they lead
    if (userRole === Role.TEAM_LEAD) {
      const leadTeamIds = await this.getUserLeadTeamIds(userId);

      return {
        organizationId,
        teamAssignments: {
          some: {
            teamId: {
              in: leadTeamIds,
            },
          },
        },
      };
    }

    // DEVELOPER can see projects assigned to teams they are members of
    const userTeamIds = await this.getUserTeamIds(userId);

    return {
      organizationId,
      teamAssignments: {
        some: {
          teamId: {
            in: userTeamIds,
          },
        },
      },
    };
  }

  /**
   * Create a role-based repository filter for Prisma queries.
   * Filters repositories based on the user's role and team assignments:
   * - DEVELOPER: Only repositories in projects assigned to teams the user is a member of
   * - TEAM_LEAD: Repositories in projects assigned to teams the user leads
   * - ADMIN/OWNER: All repositories in the organization
   *
   * @param userId - The user ID to filter by
   * @param userRole - The user's role
   * @param organizationId - The organization ID to filter by
   * @returns Prisma where clause with role-based repository filter
   *
   * @example
   * const filter = await dataFilterService.createRepositoryFilter('user-123', Role.DEVELOPER, 'org-456');
   * const repositories = await prisma.repository.findMany({ where: filter });
   */
  async createRepositoryFilter(
    userId: string,
    userRole: Role,
    organizationId: string,
  ): Promise<Prisma.RepositoryWhereInput> {
    // ADMIN and OWNER can see all repositories in their organization
    if (userRole === Role.ADMIN || userRole === Role.OWNER) {
      return {
        organizationId,
      };
    }

    // TEAM_LEAD can see repositories in projects assigned to teams they lead
    if (userRole === Role.TEAM_LEAD) {
      const leadTeamIds = await this.getUserLeadTeamIds(userId);

      return {
        organizationId,
        projectRepositories: {
          some: {
            project: {
              teamAssignments: {
                some: {
                  teamId: {
                    in: leadTeamIds,
                  },
                },
              },
            },
          },
        },
      };
    }

    // DEVELOPER can see repositories in projects assigned to teams they are members of
    const userTeamIds = await this.getUserTeamIds(userId);

    return {
      organizationId,
      projectRepositories: {
        some: {
          project: {
            teamAssignments: {
              some: {
                teamId: {
                  in: userTeamIds,
                },
              },
            },
          },
        },
      },
    };
  }

  /**
   * Get all team IDs where the user is an active member.
   *
   * @param userId - The user ID
   * @returns Array of team IDs
   */
  private async getUserTeamIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        userId,
        leftAt: null, // Only active memberships
      },
      select: {
        teamId: true,
      },
    });

    return memberships.map((m) => m.teamId);
  }

  /**
   * Get all team IDs where the user is the team lead.
   *
   * @param userId - The user ID
   * @returns Array of team IDs
   */
  private async getUserLeadTeamIds(userId: string): Promise<string[]> {
    const teams = await this.prisma.team.findMany({
      where: {
        leadId: userId,
      },
      select: {
        id: true,
      },
    });

    return teams.map((t) => t.id);
  }

  /**
   * Resolve assigned project, repository, and team IDs for a user in an organization.
   * - OWNER/ADMIN: Returns isOrgScoped: true (all resources in organization).
   * - TEAM_LEAD/DEVELOPER: Returns isOrgScoped: false and exact assigned projectIds, repositoryIds, teamIds.
   */
  async getScopedProjectAndRepoIds(
    userId: string,
    organizationId: string,
    callerRole?: Role,
  ): Promise<{
    isOrgScoped: boolean;
    effectiveRole: Role;
    projectIds: string[];
    repositoryIds: string[];
    teamIds: string[];
  }> {
    let effectiveRole = callerRole;
    if (this.prisma.organizationMember) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });
      if (membership?.role) {
        effectiveRole = membership.role;
      }
    }

    if (effectiveRole === Role.OWNER || effectiveRole === Role.ADMIN) {
      return {
        isOrgScoped: true,
        effectiveRole: effectiveRole || Role.OWNER,
        projectIds: [],
        repositoryIds: [],
        teamIds: [],
      };
    }

    // TEAM_LEAD / DEVELOPER: find active teams
    const teams = await this.prisma.team.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { leadId: userId },
          {
            memberships: {
              some: {
                userId,
                leftAt: null,
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    const teamIds = teams.map((t) => t.id);

    if (teamIds.length === 0) {
      return {
        isOrgScoped: false,
        effectiveRole: effectiveRole || Role.DEVELOPER,
        projectIds: [],
        repositoryIds: [],
        teamIds: [],
      };
    }

    // Find active project assignments
    const assignments = await this.prisma.teamProjectAssignment.findMany({
      where: {
        teamId: { in: teamIds },
        endDate: null,
        project: {
          organizationId,
          isActive: true,
        },
      },
      select: { projectId: true },
    });
    const projectIds = Array.from(new Set(assignments.map((a) => a.projectId)));

    if (projectIds.length === 0) {
      return {
        isOrgScoped: false,
        effectiveRole: effectiveRole || Role.DEVELOPER,
        projectIds: [],
        repositoryIds: [],
        teamIds,
      };
    }

    // Find linked repositories
    const projectRepos = await this.prisma.projectRepository.findMany({
      where: {
        projectId: { in: projectIds },
        repository: {
          organizationId,
          isEnabled: true,
        },
      },
      select: { repositoryId: true },
    });
    const repositoryIds = Array.from(new Set(projectRepos.map((pr) => pr.repositoryId)));

    return {
      isOrgScoped: false,
      effectiveRole: effectiveRole || Role.DEVELOPER,
      projectIds,
      repositoryIds,
      teamIds,
    };
  }

  /**
   * Verify repository access for caller.
   * OWNER/ADMIN: verified if repository belongs to organizationId.
   * TEAM_LEAD/DEVELOPER: verified if repository is linked to an assigned project.
   */
  async verifyRepositoryAccess(
    repositoryId: string,
    organizationId: string,
    caller?: { id: string; role?: string },
  ): Promise<{ repositoryId: string; organizationId: string }> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, organizationId },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found in organization`);
    }

    if (!caller) {
      return { repositoryId, organizationId };
    }

    let effectiveRole = caller.role as Role | undefined;
    if (this.prisma.organizationMember) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: caller.id,
          },
        },
      });
      if (membership?.role) {
        effectiveRole = membership.role;
      }
    }

    if (effectiveRole === Role.OWNER || effectiveRole === Role.ADMIN) {
      return { repositoryId, organizationId };
    }

    // Check project assignment for TEAM_LEAD and DEVELOPER
    const hasAssignment = await this.prisma.projectRepository.findFirst({
      where: {
        repositoryId,
        project: {
          organizationId,
          isActive: true,
          teamAssignments: {
            some: {
              endDate: null,
              team: {
                organizationId,
                isActive: true,
                OR: [
                  { leadId: caller.id },
                  {
                    memberships: {
                      some: {
                        userId: caller.id,
                        leftAt: null,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    if (!hasAssignment) {
      throw new ForbiddenException(
        'Access denied: This repository is not part of any project assigned to your active teams.',
      );
    }

    return { repositoryId, organizationId };
  }

  /**
   * Verify team access for caller.
   * OWNER/ADMIN: verified if team belongs to organizationId.
   * TEAM_LEAD/DEVELOPER: verified if user is lead or active member of teamId.
   */
  async verifyTeamAccess(
    teamId: string,
    organizationId: string,
    caller?: { id: string; role?: string },
  ): Promise<{ teamId: string; organizationId: string }> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found in organization`);
    }

    if (!caller) {
      return { teamId, organizationId };
    }

    let effectiveRole = caller.role as Role | undefined;
    if (this.prisma.organizationMember) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: caller.id,
          },
        },
      });
      if (membership?.role) {
        effectiveRole = membership.role;
      }
    }

    if (effectiveRole === Role.OWNER || effectiveRole === Role.ADMIN) {
      return { teamId, organizationId };
    }

    const isMemberOrLead = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        isActive: true,
        OR: [
          { leadId: caller.id },
          {
            memberships: {
              some: {
                userId: caller.id,
                leftAt: null,
              },
            },
          },
        ],
      },
    });

    if (!isMemberOrLead) {
      throw new ForbiddenException(
        'Access denied: You are not an active member or leader of this team.',
      );
    }

    return { teamId, organizationId };
  }

  /**
   * Verify caller active organization membership and optional role requirements.
   */
  async verifyOrganizationAccess(
    organizationId: string,
    userId: string,
    allowedRoles?: Role[],
  ): Promise<{ organizationId: string; role: Role }> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied: You are not an active member of this organization.');
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(membership.role as Role)) {
      throw new ForbiddenException('Access denied: Caller lacks required role in organization.');
    }

    return { organizationId, role: membership.role as Role };
  }

  /**
   * Verify access to individual developer data.
   * OWNER/ADMIN: org-wide access to any developer in organization.
   * DEVELOPER: can only access their own developer data.
   * TEAM_LEAD: can access their own data or developers who share active membership in an assigned team.
   */
  async verifyDeveloperAccess(
    developerId: string,
    organizationId: string,
    caller?: { id: string; role?: string },
  ): Promise<{ developerId: string; organizationId: string }> {
    const developer = await this.prisma.user.findFirst({
      where: {
        id: developerId,
        memberships: {
          some: { organizationId },
        },
      },
    });

    if (!developer) {
      throw new NotFoundException(`Developer with ID ${developerId} not found in organization`);
    }

    if (!caller) {
      return { developerId, organizationId };
    }

    let effectiveRole = caller.role as Role | undefined;
    if (this.prisma.organizationMember) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: caller.id,
          },
        },
      });
      if (membership?.role) {
        effectiveRole = membership.role as Role;
      }
    }

    if (effectiveRole === Role.OWNER || effectiveRole === Role.ADMIN) {
      return { developerId, organizationId };
    }

    if (effectiveRole === Role.DEVELOPER) {
      if (caller.id !== developerId) {
        throw new ForbiddenException('Developers can only access their own developer data.');
      }
      return { developerId, organizationId };
    }

    if (effectiveRole === Role.TEAM_LEAD) {
      if (caller.id === developerId) {
        return { developerId, organizationId };
      }

      const sharedTeam = await this.prisma.teamMembership.findFirst({
        where: {
          userId: developerId,
          leftAt: null,
          team: {
            organizationId,
            isActive: true,
            OR: [
              { leadId: caller.id },
              {
                memberships: {
                  some: {
                    userId: caller.id,
                    leftAt: null,
                  },
                },
              },
            ],
          },
        },
      });

      if (!sharedTeam) {
        throw new ForbiddenException(
          'Team Leads can only access developer data for members of their assigned teams.',
        );
      }
      return { developerId, organizationId };
    }

    throw new ForbiddenException('Access denied: Unauthorized role for developer data.');
  }
}

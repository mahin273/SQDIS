/* eslint-disable */
import { Injectable } from '@nestjs/common';
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
}

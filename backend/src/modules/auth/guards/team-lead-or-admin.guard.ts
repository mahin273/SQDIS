import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { RequestUser } from '../decorators/get-user.decorator';
import { TeamsService } from '../../teams/teams.service';
import { ROLE_HIERARCHY } from './roles.guard';

interface AuthenticatedRequest {
  user?: RequestUser;
  params: { id?: string };
}

/**
 * Guard that allows access to ADMIN, OWNER, or team lead for a specific team
 * Used for team update and member management operations
 */
@Injectable()
export class TeamLeadOrAdminGuard implements CanActivate {
  constructor(private teamsService: TeamsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user as RequestUser;

    // If no user, deny access (should be caught by JwtAuthGuard first)
    if (!user || !user.role) {
      return false;
    }

    // Get team ID from route params
    const teamId = request.params.id;
    if (!teamId) {
      throw new ForbiddenException('Team ID is required');
    }

    // Cast user.role to Role enum to satisfy TypeScript
    const userRole = user.role as Role;

    // ADMIN and OWNER always have access
    if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[Role.ADMIN]) {
      return true;
    }

    // Check if user is team lead for this specific team
    const isTeamLead = await this.teamsService.isTeamLead(teamId, user.id);
    if (isTeamLead) {
      return true;
    }

    // User is neither ADMIN/OWNER nor team lead
    throw new ForbiddenException(
      'You do not have permission to perform this action. Required: ADMIN, OWNER, or team lead status',
    );
  }
}

/* eslint-disable */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../decorators/get-user.decorator';
import { PermissionCacheService } from '../services/permission-cache.service';


/**
 * Role hierarchy mapping roles to numeric levels
 * Higher level roles inherit permissions from lower level roles
 * OWNER (4) > ADMIN (3) > TEAM_LEAD (2) > DEVELOPER (1)
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  DEVELOPER: 1,
  TEAM_LEAD: 2,
  ADMIN: 3,
  OWNER: 4,
};

/**
 * Role-based access control guard
 * Checks if the authenticated user has the required role(s)
 * Implements role hierarchy where higher roles inherit lower role permissions
 * Integrates permission caching to improve performance
 * Integrates audit logging for all permission checks
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionCacheService: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (attached by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    // If no user or no role, deny access
    if (!user || !user.role) {
      return false;
    }

    // Build permission string for caching
    // Format: "roles:{role1},{role2},...:{handler}:{class}"
    const handler = context.getHandler().name;
    const className = context.getClass().name;
    const permission = `roles:${requiredRoles.join(',')}:${className}:${handler}`;

    // Check cache first if user has organizationId
    if (user.organizationId) {
      const cachedDecision = await this.permissionCacheService.getCachedPermission(
        user.id,
        user.organizationId,
        permission,
      );

      if (cachedDecision !== null) {
        // Log cached permission check
        await this.logPermissionCheck(
          user,
          requiredRoles,
          cachedDecision,
          className,
          handler,
        );
        return cachedDecision;
      }
    }

    // Check if user has sufficient role level using hierarchy
    const granted = this.checkRoleHierarchy(user.role, requiredRoles);

    // Cache the decision if user has organizationId
    if (user.organizationId) {
      await this.permissionCacheService.setCachedPermission(
        user.id,
        user.organizationId,
        permission,
        granted,
      );
    }

    // Log permission check
    await this.logPermissionCheck(
      user,
      requiredRoles,
      granted,
      className,
      handler,
    );

    return granted;
  }

  /**
   * Check if user's role meets the minimum required role level
   * Uses role hierarchy: higher level roles can access lower level permissions
   * @param userRole - The role of the authenticated user
   * @param requiredRoles - Array of acceptable roles for the endpoint
   * @returns true if user's role level is >= any of the required role levels
   */
  private checkRoleHierarchy(userRole: Role, requiredRoles: Role[]): boolean {
    const userLevel = ROLE_HIERARCHY[userRole];

    // User has access if their role level is >= any of the required role levels
    return requiredRoles.some((requiredRole) => {
      const requiredLevel = ROLE_HIERARCHY[requiredRole];
      return userLevel >= requiredLevel;
    });
  }

  /**
   * Log permission check to audit log
   * Records both granted and denied permission checks for compliance
   * @param user - The authenticated user
   * @param requiredRoles - Array of acceptable roles for the endpoint
   * @param granted - Whether permission was granted
   * @param className - The controller class name
   * @param handler - The handler method name
   */
  private async logPermissionCheck(
    user: RequestUser,
    requiredRoles: Role[],
    granted: boolean,
    className: string,
    handler: string,
  ): Promise<void> {
    // Only log if user has organizationId
    if (!user.organizationId) {
      return;
    }

    // Determine the most restrictive required role (highest level)
    const requiredRole = requiredRoles.reduce((highest, current) => {
      return ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest;
    });


  }
}

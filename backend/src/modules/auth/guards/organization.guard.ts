/* eslint-disable */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationsService } from '../../organizations/organizations.service';
import type { RequestUser } from '../decorators/get-user.decorator';

/**
 * Metadata key for organization ID parameter name
 */
export const ORGANIZATION_ID_PARAM_KEY = 'organizationIdParam';

/**
 * Organization Guard
 * Verifies that the authenticated user belongs to the organization
 * specified in the request parameters or JWT payload.
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(forwardRef(() => OrganizationsService))
    private readonly organizationsService: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    // If no user, deny access (should be caught by JwtAuthGuard first)
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Get the organization ID parameter name from decorator metadata
    // Default to 'organizationId' or 'id' (common patterns)
    const paramName =
      this.reflector.getAllAndOverride<string>(ORGANIZATION_ID_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || this.getOrganizationIdFromRequest(request);

    if (!paramName) {
      // No organization ID found, allow access (might be a non-org-specific route)
      return true;
    }

    // Verify user is a member of the organization
    const isMember = await this.organizationsService.isUserMember(paramName, user.id);

    if (!isMember) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    // Attach organization ID to request for downstream use
    request.organizationId = paramName;

    return true;
  }

  /**
   * Extract organization ID from request parameters or body
   */
  private getOrganizationIdFromRequest(request: any): string | null {
    // Check route parameters first (most common)
    if (request.params?.organizationId) {
      return request.params.organizationId;
    }

    // Check for 'id' parameter (used in /organizations/:id routes)
    if (request.params?.id) {
      return request.params.id;
    }

    // Check request body
    if (request.body?.organizationId) {
      return request.body.organizationId;
    }

    // Check query parameters
    if (request.query?.organizationId) {
      return request.query.organizationId;
    }

    // Check JWT payload for organization context
    if (request.user?.organizationId) {
      return request.user.organizationId;
    }

    return null;
  }
}

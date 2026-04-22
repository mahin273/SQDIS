/* eslint-disable */
import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Service for managing organization context in queries
 * Provides utilities for filtering data by organization ID
 */

Injectable()
export class OrganizationContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**

   * @param organizationId - The organization ID to filter by
   * @param additionalFilters - Additional where clause conditions
   * @returns Combined where clause with organization filter
   */
  createOrganizationFilter<T extends Record<string, any>>(
    organizationId: string,
    additionalFilters?: T,
  ): T & { organizationId: string } {
    return {
      ...additionalFilters,
      organizationId,
    } as T & { organizationId: string };
  }

  /**

   * @param resourceOrgId - The organization ID of the resource
   * @param requestedOrgId - The organization ID from the request
   * @throws ForbiddenException if organization IDs don't match
   */
  verifyOrganizationAccess(resourceOrgId: string, requestedOrgId: string): void {
    if (resourceOrgId !== requestedOrgId) {
      throw new ForbiddenException('You do not have access to this resource');
    }
  }

  /**
   * Verify user has access to the organization
   *
   * @param organizationId - The organization ID to check
   * @param userId - The user ID to verify
   * @throws ForbiddenException if user doesn't have access
   */
  async verifyUserOrganizationAccess(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization');
    }
  }

  /**
   * @param userOrganizationId - The organization ID from JWT payload
   * @returns The organization ID
   * @throws ForbiddenException if no organization context
   */
  requireOrganizationContext(userOrganizationId?: string): string {
    if (!userOrganizationId) {
      throw new ForbiddenException('No organization context. Please select an organization.');
    }
    return userOrganizationId;
  }
}

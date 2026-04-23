import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { ORGANIZATION_ID_PARAM_KEY, OrganizationGuard } from '../guards/organization.guard';

/**
 * Decorator to specify the organization ID parameter name for OrganizationGuard
 *
 * Usage:
 * @OrganizationIdParam('orgId')
 * @UseGuards(OrganizationGuard)
 *
 * @param paramName - The name of the route parameter containing the organization ID
 */
export const OrganizationIdParam = (paramName: string) =>
  SetMetadata(ORGANIZATION_ID_PARAM_KEY, paramName);

/**
 * Combined decorator that applies OrganizationGuard with a specific parameter name
 *
 * Usage:
 * @RequireOrganization('id')
 * async myMethod(@Param('id') orgId: string) { ... }
 *
 * @param paramName - The name of the route parameter containing the organization ID (default: 'id')
 */
export const RequireOrganization = (paramName: string = 'id') =>
  applyDecorators(SetMetadata(ORGANIZATION_ID_PARAM_KEY, paramName), UseGuards(OrganizationGuard));

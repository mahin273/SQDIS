/* eslint-disable */
import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';

const logger = new Logger('GetOrganization');

/**
 * Parameter decorator to extract organization ID from request
 * The organization ID can come from:
 * 1. X-Organization-Id header (frontend will send this)
 * 2. Route parameters (organizationId)
 * 3. Request body
 * 4. Query parameters
 * 5. JWT payload (user.organizationId)
 * 6. Request object (set by OrganizationGuard)
 *
 * Usage: @GetOrganization() organizationId: string

 */
export const GetOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();

    logger.debug(`Extracting organization ID from request to ${request.url}`);
    logger.debug(`Headers: x-organization-id=${request.headers['x-organization-id']}`);
    logger.debug(`Params: ${JSON.stringify(request.params)}`);

    // Priority order for organization ID:
    // 1. X-Organization-Id header (frontend will send this)
    const headerOrgId = request.headers['x-organization-id'];
    if (headerOrgId) {
      logger.debug(`Found organization ID in header: ${headerOrgId}`);
      return headerOrgId;
    }

    // 2. Request object (set by OrganizationGuard)
    if (request.organizationId) {
      return request.organizationId;
    }

    // 3. Route parameters - only check for explicit organizationId parameter
    // DO NOT check for generic 'id' parameter as it could be any entity ID (repo, user, etc.)
    if (request.params?.organizationId) {
      return request.params.organizationId;
    }

    // 4. Request body
    if (request.body?.organizationId) {
      return request.body.organizationId;
    }

    // 5. Query parameters
    if (request.query?.organizationId) {
      return request.query.organizationId;
    }

    // 6. JWT payload (user context)
    if (request.user?.organizationId) {
      return request.user.organizationId;
    }

    return undefined;
  },
);

import { SetMetadata } from '@nestjs/common';

/**
 * Configuration for the @AuditLog decorator
 */
export interface AuditLogConfig {
  /**
   * The action type (e.g., 'CREATE', 'UPDATE', 'DELETE', 'READ')
   */
  action: string;

  /**
   * The resource type being acted upon (e.g., 'Team', 'Project', 'Repository')
   */
  resourceType: string;

  /**
   * The parameter name containing the resource ID (e.g., 'id', 'teamId')
   * If not provided, resourceId will be null in the audit entry
   */
  resourceIdParam?: string;

  /**
   * Whether to capture before/after snapshots for data modifications
   * Only applicable for UPDATE and DELETE actions
   */
  captureSnapshot?: boolean;

  /**
   * Whether to include the request body in the audit entry metadata
   */
  includeRequestBody?: boolean;

  /**
   * Whether to include the response body in the audit entry metadata
   */
  includeResponseBody?: boolean;
}

/**
 * Metadata key for audit log configuration
 */
export const AUDIT_LOG_METADATA_KEY = 'audit-log';

/**
 * Decorator for automatic audit logging on controller methods.
 *
 * This decorator automatically extracts userId, organizationId, and action
 * from the request context and calls EnhancedAuditLogService to create
 * an audit entry.
 */
export function AuditLog(config: AuditLogConfig) {
  return SetMetadata(AUDIT_LOG_METADATA_KEY, config);
}

import { Injectable } from '@nestjs/common';
import { EnhancedAuditLogService, PermissionCheckEntry, AuditActionEntry, RoleChangeEntry, AuditLogFilters, PaginationOptions, PaginatedAuditLogs } from './enhanced-audit-log.service';

/**
 * AuditLogService provides a simplified interface for RBAC audit logging.
 *
 * This service wraps the EnhancedAuditLogService and provides the methods
 * specified in the RBAC Full Integration design document:
 * - logPermissionCheck: Log permission checks
 * - logAction: Log CRUD operations
 * - logRoleChange: Log role changes
 * - queryLogs: Query audit logs with filtering
 *
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly enhancedAuditLogService: EnhancedAuditLogService) {}

  /**
   * Logs a permission check operation.
   *
   * @param entry - The permission check entry details
   *
   * Validates: Requirements 7.4
   */
  async logPermissionCheck(entry: PermissionCheckEntry): Promise<void> {
    return this.enhancedAuditLogService.logPermissionCheck(entry);
  }

  /**
   * Logs a general CRUD operation.
   *
   * @param entry - The audit action entry details
   *
   */
  async logAction(entry: AuditActionEntry): Promise<void> {
    return this.enhancedAuditLogService.logAction(entry);
  }

  /**
   * Logs a role change operation.
   *
   * @param entry - The role change entry details
   *
   */
  async logRoleChange(entry: RoleChangeEntry): Promise<void> {
    return this.enhancedAuditLogService.logRoleChange(entry);
  }

  /**
   * Queries audit logs with advanced filtering and pagination.
   *
   * @param filters - The filter criteria
   * @param pagination - The pagination options (optional)
   * @returns Paginated audit log results
   *
   */
  async queryLogs(
    filters: AuditLogFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedAuditLogs> {
    const defaultPagination: PaginationOptions = {
      page: 1,
      pageSize: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    };

    return this.enhancedAuditLogService.queryLogs(
      filters,
      pagination || defaultPagination,
    );
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { EnhancedAuditLogService } from '../services/enhanced-audit-log.service';
import { RequestUser } from '../../auth/decorators/get-user.decorator';
import {
  AUDIT_LOG_METADATA_KEY,
  AuditLogConfig,
} from '../decorators/audit-log.decorator';

/**
 * Interceptor that processes @AuditLog decorator metadata and creates audit entries.
 *
 * This interceptor:
 * 1. Extracts userId and organizationId from request.user
 * 2. Extracts action, resourceType, and resourceId from decorator config
 * 3. Captures request body if configured
 * 4. Captures response body if configured
 * 5. Calls EnhancedAuditLogService to create the audit entry
 *
 * The interceptor runs after the controller method completes successfully,
 * ensuring that the audit entry reflects the actual operation that occurred.
 *
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: EnhancedAuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Get audit log configuration from decorator metadata
    const config = this.reflector.get<AuditLogConfig>(
      AUDIT_LOG_METADATA_KEY,
      context.getHandler(),
    );

    // If no audit log config, skip audit logging
    if (!config) {
      return next.handle();
    }

    // Extract request and user context
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user as RequestUser;

    // If no user context, skip audit logging (e.g., public endpoints)
    if (!user || !user.id) {
      this.logger.warn(
        `Skipping audit log for ${config.action} ${config.resourceType}: No user context`,
      );
      return next.handle();
    }

    // Extract organizationId (required for audit logging)
    const organizationId = user.organizationId;
    if (!organizationId) {
      this.logger.warn(
        `Skipping audit log for ${config.action} ${config.resourceType}: No organizationId`,
      );
      return next.handle();
    }

    // Extract resourceId from request params if configured
    const resourceId = config.resourceIdParam
      ? request.params[config.resourceIdParam]
      : null;

    // Capture request body if configured
    const requestBody = config.includeRequestBody ? request.body : undefined;

    // Extract IP address and user agent
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request.headers['user-agent'];

    // Execute the controller method and capture the response
    return next.handle().pipe(
      tap({
        next: (responseData) => {
          // Create audit entry after successful execution
          this.createAuditEntry(
            config,
            user.id,
            organizationId,
            resourceId,
            requestBody,
            responseData,
            ipAddress,
            userAgent,
          );
        },
        error: (error) => {
          // Optionally log failed operations
          this.logger.debug(
            `Controller method failed, skipping audit log: ${error.message}`,
          );
        },
      }),
    );
  }

  /**
   * Creates an audit entry using the EnhancedAuditLogService.
   *
   * @param config - The audit log configuration from the decorator
   * @param userId - The ID of the user performing the action
   * @param organizationId - The organization ID
   * @param resourceId - The resource ID (if applicable)
   * @param requestBody - The request body (if configured to capture)
   * @param responseData - The response data (if configured to capture)
   * @param ipAddress - The client IP address
   * @param userAgent - The client user agent
   */
  private async createAuditEntry(
    config: AuditLogConfig,
    userId: string,
    organizationId: string,
    resourceId: string | null,
    requestBody: any,
    responseData: any,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    try {
      // Build metadata object
      const metadata: Record<string, any> = {};

      if (config.includeRequestBody && requestBody) {
        metadata.requestBody = requestBody;
      }

      if (config.includeResponseBody && responseData) {
        metadata.responseBody = responseData;
      }

      // If snapshot capture is enabled, extract before/after data
      if (config.captureSnapshot) {
        // For UPDATE operations, the request body is the "after" state
        // For DELETE operations, the response data might contain the deleted entity
        if (config.action === 'UPDATE' && requestBody) {
          metadata.afterSnapshot = requestBody;
          // Note: beforeSnapshot would need to be fetched from the database
          // This is typically done in the service layer, not the interceptor
        } else if (config.action === 'DELETE' && responseData) {
          metadata.beforeSnapshot = responseData;
        }
      }

      // Call the appropriate audit logging method based on action type
      if (config.captureSnapshot && (config.action === 'UPDATE' || config.action === 'DELETE')) {
        await this.auditLogService.logDataModification({
          userId,
          organizationId,
          action: config.action,
          resourceType: config.resourceType,
          resourceId: resourceId || '',
          metadata,
          ipAddress,
          userAgent,
          beforeSnapshot: metadata.beforeSnapshot,
          afterSnapshot: metadata.afterSnapshot,
        });
      } else {
        await this.auditLogService.logAction({
          userId,
          organizationId,
          action: config.action,
          resourceType: config.resourceType,
          resourceId: resourceId || '',
          metadata,
          ipAddress,
          userAgent,
        });
      }
    } catch (error) {
      // Log error but don't throw - audit logging should not break the main flow
      this.logger.error(
        `Failed to create audit entry: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Extracts the client IP address from the request.
   * Handles proxied requests by checking X-Forwarded-For header.
   *
   * @param request - The Express request object
   * @returns The client IP address
   */
  private extractIpAddress(request: Request): string | undefined {
    // Check X-Forwarded-For header (for proxied requests)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header (alternative proxy header)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to request.ip
    return request.ip;
  }
}

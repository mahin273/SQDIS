/* eslint-disable */
import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';
import { AuditLoggerService } from '../services/audit-logger.service';

/**
 * Custom throttler guard that tracks rate limits by email address
 * instead of IP address for password reset endpoints.
 * - Restricts password reset requests to 3 per hour per email address
 * - Tracks requests by email regardless of whether account exists
 * - Logs rate limit exceeded events for security monitoring
 */
@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(AuditLoggerService)
    private readonly auditLoggerService: AuditLoggerService,
  ) {
    super();
  }

  /**
   * Generate throttler key based on email address from request body
   * Falls back to IP-based tracking if email is not provided
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Extract email or identifier from request body
    const email = req.body?.email || req.body?.identifier;

    if (email && typeof email === 'string') {
      // Use email as the tracking key (normalized to lowercase)
      return `email:${email.toLowerCase()}`;
    }

    // Fallback to IP-based tracking if no email provided
    return req.ip || req.ips?.[0] || 'unknown';
  }

  /**
   * Override to provide custom error handling with Retry-After header
   * and audit logging for rate limit exceeded events
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerRequest: ThrottlerRequest,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();
    const ttl = throttlerRequest.ttl;

    // Calculate retry-after in seconds
    const retryAfter = Math.ceil(ttl / 1000);

    // Set Retry-After header
    response.header('Retry-After', retryAfter.toString());

    // Extract identifier and IP address for audit logging
    const identifier = request.body?.email || request.body?.identifier || 'unknown';
    const ipAddress = this.extractIpAddress(request);

    // Log rate limit exceeded event
    this.auditLoggerService.logRateLimitExceeded(identifier, ipAddress);

    throw new ThrottlerException('Too many requests, please try again later');
  }

  /**
   * Extract IP address from request, handling proxied requests
   */
  private extractIpAddress(req: any): string {
    // Check X-Forwarded-For header (for proxied requests)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header (alternative proxy header)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to request.ip
    return req.ip || 'unknown';
  }
}

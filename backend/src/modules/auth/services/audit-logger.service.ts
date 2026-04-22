import { Injectable, Logger } from '@nestjs/common';

/**
 * Service for logging password reset activities for security monitoring
 */
@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger('PasswordResetAudit');

  /**
   * Log password reset request
   * @param identifier - Email or username used
   * @param userFound - Whether a user was found
   * @param ipAddress - Request IP address
   */
  logPasswordResetRequest(identifier: string, userFound: boolean, ipAddress: string): void {
    this.logger.log({
      event: 'password_reset_request',
      identifier,
      userFound,
      ipAddress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log token validation attempt
   * @param userId - User ID if token valid
   * @param success - Whether validation succeeded
   * @param reason - Failure reason if applicable
   * @param ipAddress - Request IP address
   */
  logTokenValidation(
    userId: string | null,
    success: boolean,
    reason: string | null,
    ipAddress: string,
  ): void {
    this.logger.log({
      event: 'token_validation',
      userId,
      success,
      reason,
      ipAddress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log successful password reset
   * @param userId - User ID
   * @param ipAddress - Request IP address
   */
  logPasswordResetSuccess(userId: string, ipAddress: string): void {
    this.logger.log({
      event: 'password_reset_success',
      userId,
      ipAddress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log rate limit exceeded
   * @param identifier - Email or username
   * @param ipAddress - Request IP address
   */
  logRateLimitExceeded(identifier: string, ipAddress: string): void {
    this.logger.warn({
      event: 'rate_limit_exceeded',
      identifier,
      ipAddress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log token cleanup operation
   * @param deletedCount - Number of tokens deleted
   */
  logTokenCleanup(deletedCount: number): void {
    this.logger.log({
      event: 'token_cleanup',
      deletedCount,
      timestamp: new Date().toISOString(),
    });
  }
}

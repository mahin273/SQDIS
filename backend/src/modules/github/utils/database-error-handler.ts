import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Utility for handling database errors in webhook workers
 */
export class DatabaseErrorHandler {
  /**
   * Check if an error is a Prisma unique constraint violation
   */
  static isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  /**
   * Check if an error is a database connection error
   */
  static isDatabaseConnectionError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P1001: Can't reach database server
      // P1002: Database server timeout
      // P1008: Operations timed out
      // P1017: Server has closed the connection
      return ['P1001', 'P1002', 'P1008', 'P1017'].includes(error.code);
    }
    return false;
  }

  /**
   * Handle database errors in workers with appropriate retry logic
   *
   * @param error - The error to handle
   * @param logger - Logger instance for logging
   * @param context - Context information for logging (job ID, entity type, etc.)
   * @returns true if error was handled as idempotent success, false if should retry
   * @throws error if it's not a handled error type
   */
  static handleDatabaseError(
    error: unknown,
    logger: Logger,
    context: {
      jobId?: string | number;
      entityType: string;
      entityId: string | number;
      action: string;
    },
  ): boolean {
    const { jobId, entityType, entityId, action } = context;

    // Handle unique constraint violations as idempotent success
    if (this.isUniqueConstraintViolation(error)) {
      const prismaError = error as Prisma.PrismaClientKnownRequestError;
      logger.log(
        `Duplicate key violation for ${entityType} ${entityId} (action: ${action}) - treating as idempotent success. ` +
          `Job: ${jobId}, Target: ${prismaError.meta?.target || 'unknown'}`,
      );
      return true; // Handled as success
    }

    // Handle database connection errors - log and re-throw for retry 
    if (this.isDatabaseConnectionError(error)) {
      const prismaError = error as Prisma.PrismaClientKnownRequestError;
      logger.error(
        `Database connection error for ${entityType} ${entityId} (action: ${action}): ${prismaError.message}. ` +
          `Job: ${jobId}, Code: ${prismaError.code}. Will retry with exponential backoff.`,
        prismaError.stack,
      );
      throw error; // Re-throw for BullMQ retry
    }

    // For other database errors, log with full context and re-throw
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(
        `Database error for ${entityType} ${entityId} (action: ${action}): ${error.message}. ` +
          `Job: ${jobId}, Code: ${error.code}, Meta: ${JSON.stringify(error.meta)}`,
        error.stack,
      );
      throw error;
    }

    // For unknown errors, log and re-throw
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Format entity ID based on entity type for better readability
    let entityDisplay = `${entityType} ${entityId}`;
    if (entityType === 'PullRequest') {
      entityDisplay = `PR #${entityId}`;
    } else if (entityType === 'Issue') {
      entityDisplay = `Issue #${entityId}`;
    } else if (entityType === 'CommitComment') {
      entityDisplay = `commit comment ${entityId}`;
    } else if (entityType === 'Release') {
      entityDisplay = `Release ${entityId}`;
    }

    logger.error(
      `Failed to process ${entityDisplay}: ${errorMessage}. ` + `Job: ${jobId}, Action: ${action}`,
      errorStack,
    );
    throw error;
  }
}

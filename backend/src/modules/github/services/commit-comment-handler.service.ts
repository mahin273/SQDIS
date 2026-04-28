import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, EventHandlerResult } from '../interfaces/event-handler.interface';
import { CommitCommentEventPayload, ParsedCommitCommentData } from '../dto/webhook-payload.dto';
import { CommitProcessorQueue } from '../queues/commit-processor.queue';

/**
 * CommitCommentHandler processes GitHub commit_comment webhook events.
 *
 * This handler is responsible for:
 * - Validating commit_comment event payloads
 * - Parsing commit comment data from GitHub webhook format to internal format
 * - Queueing commit comment processing jobs for asynchronous handling
 *
 * Supported actions:
 * - created: New commit comment created
 *
 */
@Injectable()
export class CommitCommentHandler implements EventHandler {
  private readonly logger = new Logger(CommitCommentHandler.name);

  constructor(private readonly commitProcessorQueue: CommitProcessorQueue) {}

  /**
   * Get the event type this handler processes.
   *
   * @returns 'commit_comment'
   */
  getEventType(): string {
    return 'commit_comment';
  }

  /**
   * Validate the commit_comment event payload structure.
   *
   * Checks for required fields:
   * - action: The comment action type
   * - comment: The comment object with required fields
   * - repository: The repository object
   *
   * @param payload - The raw webhook payload from GitHub
   * @returns true if the payload structure is valid, false otherwise
   */
  validatePayload(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const event = payload as Partial<CommitCommentEventPayload>;

    // Check required top-level fields
    if (!event.action || !event.comment || !event.repository) {
      return false;
    }

    const comment = event.comment;

    // Check required comment fields
    if (
      typeof comment.id !== 'number' ||
      !comment.commit_id ||
      !comment.body ||
      !comment.user ||
      !comment.created_at
    ) {
      return false;
    }

    return true;
  }

  /**
   * Parse the commit_comment event payload into internal format.
   *
   * Extracts all required commit comment data from the GitHub webhook payload:
   * - Comment ID, commit SHA, body
   * - File path and line number (if applicable)
   * - Author information
   * - Timestamps
   *
   * @param payload - The raw webhook payload from GitHub
   * @returns Parsed commit comment data in internal format
   * @throws Error if payload cannot be parsed
   */
  parsePayload(payload: unknown): ParsedCommitCommentData {
    const event = payload as CommitCommentEventPayload;
    const comment = event.comment;

    return {
      commentId: comment.id,
      commitSha: comment.commit_id,
      body: comment.body,
      filePath: comment.path,
      lineNumber: comment.line,
      authorLogin: comment.user.login,
      authorId: comment.user.id,
      createdAt: new Date(comment.created_at),
      repositoryId: event.repository.id,
      repositoryFullName: event.repository.full_name,
    };
  }

  /**
   * Handle the commit_comment event by queueing a processing job.
   *
   * This method:
   * 1. Validates the payload structure
   * 2. Parses the payload into internal format
   * 3. Queues a job to the commit comment processing queue
   * 4. Returns immediately without waiting for job processing
   *
   * Supported actions:
   * - created: Creates a new commit comment record and associates with commit
   *
   * @param payload - The raw webhook payload from GitHub
   * @param repositoryId - The internal repository ID
   * @param organizationId - The internal organization ID
   * @returns Result indicating success and number of jobs queued
   * @throws Error if payload is invalid or queueing fails
   */
  async handle(
    payload: unknown,
    repositoryId: string,
    organizationId: string,
  ): Promise<EventHandlerResult> {
    if (!this.validatePayload(payload)) {
      throw new Error('Invalid commit_comment event payload structure');
    }

    const event = payload as CommitCommentEventPayload;
    const action = event.action;

    // Only process actions we care about
    const supportedActions = ['created'];

    if (!supportedActions.includes(action)) {
      this.logger.debug(`Skipping unsupported commit_comment action: ${action}`);
      return {
        success: true,
        jobsQueued: 0,
        message: `Commit comment action '${action}' not processed`,
      };
    }

    const parsedData = this.parsePayload(payload);

    // Queue the commit comment processing job
    await this.commitProcessorQueue.addCommitCommentJob(parsedData, repositoryId, organizationId);

    this.logger.log(
      `Queued commit_comment event (commit: ${parsedData.commitSha}) for repository ${repositoryId}`,
    );

    return {
      success: true,
      jobsQueued: 1,
      message: `Commit comment ${action} event queued for processing`,
    };
  }
}

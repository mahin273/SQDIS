import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, EventHandlerResult } from '../interfaces/event-handler.interface';
import { IssueEventPayload, ParsedIssueData } from '../dto/webhook-payload.dto';
import { CommitProcessorQueue } from '../queues/commit-processor.queue';

/**
 * IssueHandler processes GitHub issues webhook events.
 *
 * This handler is responsible for:
 * - Validating issues event payloads
 * - Parsing issue data from GitHub webhook format to internal format
 * - Queueing issue processing jobs for asynchronous handling
 *
 * Supported actions:
 * - opened: New issue created
 * - closed: Issue closed
 * - reopened: Previously closed issue reopened
 * - labeled: Label added to issue
 * - unlabeled: Label removed from issue
 * - assigned: User assigned to issue
 * - unassigned: User unassigned from issue
 *
 */
@Injectable()
export class IssueHandler implements EventHandler {
  private readonly logger = new Logger(IssueHandler.name);

  constructor(private readonly commitProcessorQueue: CommitProcessorQueue) {}

  /**
   * Get the event type this handler processes.
   *
   * @returns 'issues'
   */
  getEventType(): string {
    return 'issues';
  }

  /**
   * Validate the issues event payload structure.
   *
   * Checks for required fields:
   * - action: The issue action type
   * - issue: The issue object with required fields
   * - repository: The repository object
   *
   * @param payload - The raw webhook payload from GitHub
   * @returns true if the payload structure is valid, false otherwise
   */
  validatePayload(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const event = payload as Partial<IssueEventPayload>;

    // Check required top-level fields
    if (!event.action || !event.issue || !event.repository) {
      return false;
    }

    const issue = event.issue;

    // Check required issue fields
    if (
      typeof issue.id !== 'number' ||
      typeof issue.number !== 'number' ||
      !issue.title ||
      !issue.state ||
      !issue.user ||
      !issue.created_at ||
      !issue.updated_at
    ) {
      return false;
    }

    // Validate labels array if present
    if (issue.labels && !Array.isArray(issue.labels)) {
      return false;
    }

    // Validate assignees array if present
    if (issue.assignees && !Array.isArray(issue.assignees)) {
      return false;
    }

    return true;
  }

  /**
   * Parse the issues event payload into internal format.
   *
   * Extracts all required issue data from the GitHub webhook payload:
   * - Issue number, ID, title, body
   * - State (open/closed)
   * - Author information
   * - Labels and assignees
   * - Timestamps
   *
   * @param payload - The raw webhook payload from GitHub
   * @returns Parsed issue data in internal format
   * @throws Error if payload cannot be parsed
   */
  parsePayload(payload: unknown): ParsedIssueData {
    const event = payload as IssueEventPayload;
    const issue = event.issue;

    return {
      issueNumber: issue.number,
      issueId: issue.id,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      authorLogin: issue.user.login,
      authorId: issue.user.id,
      labels: issue.labels.map((label) => label.name),
      assignees: issue.assignees.map((assignee) => assignee.login),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      repositoryId: event.repository.id,
      repositoryFullName: event.repository.full_name,
    };
  }

  /**
   * Handle the issues event by queueing a processing job.
   *
   * This method:
   * 1. Validates the payload structure
   * 2. Parses the payload into internal format
   * 3. Queues a job to the issue processing queue
   * 4. Returns immediately without waiting for job processing
   *
   * Supported actions:
   * - opened: Creates a new issue record
   * - closed: Updates the issue status to closed
   * - reopened: Updates the issue status to open
   * - labeled: Adds the label to the issue
   * - unlabeled: Removes the label from the issue
   * - assigned: Records the assignee
   * - unassigned: Removes the assignee
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
      throw new Error('Invalid issues event payload structure');
    }

    const event = payload as IssueEventPayload;
    const action = event.action;

    // Only process actions we care about
    const supportedActions = [
      'opened',
      'closed',
      'reopened',
      'labeled',
      'unlabeled',
      'assigned',
      'unassigned',
    ];

    if (!supportedActions.includes(action)) {
      this.logger.debug(`Skipping unsupported issues action: ${action}`);
      return {
        success: true,
        jobsQueued: 0,
        message: `Issue action '${action}' not processed`,
      };
    }

    const parsedData = this.parsePayload(payload);

    // Queue the issue processing job
    await this.commitProcessorQueue.addIssueJob(parsedData, repositoryId, organizationId, action);

    this.logger.log(
      `Queued issues event (action: ${action}, Issue #${parsedData.issueNumber}) for repository ${repositoryId}`,
    );

    return {
      success: true,
      jobsQueued: 1,
      message: `Issue ${action} event queued for processing`,
    };
  }
}

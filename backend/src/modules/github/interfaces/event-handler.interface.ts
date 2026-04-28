/** eslint-disable */
/**
 * Result returned by event handlers after processing
 */
export interface EventHandlerResult {
  success: boolean;
  jobsQueued: number;
  message: string;
}

/**
 * Base interface that all GitHub webhook event handlers must implement.
 *
 * This interface defines the contract for processing specific GitHub webhook event types.
 * Each handler is responsible for:
 * - Validating the event payload structure
 * - Parsing the payload into internal format
 * - Queueing jobs for asynchronous processing
 *
 * Handlers follow a registry pattern and are registered with the EventRouter.
 */

export interface EventHandler{
  /**
   * Get the GitHub event type this handler processes.
   *
   * @returns The event type string (e.g., 'pull_request', 'issues', 'release')
   *
   * @example
   * getEventType(): string {
   *   return 'pull_request';
   * }
   */
  getEventType():string;
  /**
   * Validate the event payload structure.
   *
   * Checks if the payload has the expected structure and required fields
   * for this event type. Does not perform business logic validation.
   *
   * @param payload - The raw webhook payload from GitHub
   * @returns true if the payload structure is valid, false otherwise
   *
   * @example
   * validatePayload(payload: unknown): boolean {
   *   const pr = payload as any;
   *   return pr?.action && pr?.pull_request?.number !== undefined;
   * }
   */
  validatePayload(payload: unknown): boolean;

/**
   * Parse the event payload into internal format.
   *
   * Extracts relevant data from the GitHub webhook payload and transforms
   * it into the internal data structure used by the application.
   *
   * @param payload - The raw webhook payload from GitHub
   * @returns Parsed event data in internal format
   * @throws Error if payload cannot be parsed
   *
   * @example
   * parsePayload(payload: unknown): ParsedPullRequestData {
   *   const event = payload as PullRequestEventPayload;
   *   return {
   *     prNumber: event.pull_request.number,
   *     title: event.pull_request.title,
   *     // ... other fields
   *   };
   * }
   */
    parsePayload(payload: unknown): unknown;

    /**
   * Handle the webhook event by queueing jobs for asynchronous processing.
   *
   * This method is called after signature validation and idempotency checks.
   * It should:
   * 1. Validate the payload structure
   * 2. Parse the payload into internal format
   * 3. Queue one or more jobs to the appropriate BullMQ queue
   * 4. Return immediately without waiting for job processing
   *
   * @param payload - The raw webhook payload from GitHub
   * @param repositoryId - The internal repository ID
   * @param organizationId - The internal organization ID
   * @returns Result indicating success and number of jobs queued
   * @throws Error if handling fails (will be logged and retried)
   *
   * @example
   * async handle(
   *   payload: unknown,
   *   repositoryId: string,
   *   organizationId: string
   * ): Promise<EventHandlerResult> {
   *   if (!this.validatePayload(payload)) {
   *     throw new Error('Invalid payload structure');
   *   }
   *
   *   const data = this.parsePayload(payload);
   *   await this.queue.addJob(data, repositoryId, organizationId);
   *
   *   return {
   *     success: true,
   *     jobsQueued: 1,
   *     message: 'Pull request event queued'
   *   };
   * }
   */
  handle(
    payload: unknown,
    repositoryId: string,
    organizationId: string,
  ): Promise<EventHandlerResult>;

}

import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, EventHandlerResult } from '../interfaces/event-handler.interface';

/**
 * EventRouter routes GitHub webhook events to registered handlers.
 *
 * This service implements a registry pattern for event handlers, allowing
 * dynamic registration and routing of webhook events to appropriate handlers.
 *
 * Key responsibilities:
 * - Maintain a registry of event handlers by event type
 * - Route incoming webhook events to the correct handler
 * - Handle unsupported event types gracefully
 * - Provide visibility into supported event types
 *
 * @example
 * // Register a handler
 * eventRouter.registerHandler('pull_request', pullRequestHandler);
 *
 * // Route an event
 * const result = await eventRouter.routeEvent(
 *   'pull_request',
 *   payload,
 *   repositoryId,
 *   organizationId
 * );
 */
@Injectable()
export class EventRouter {
  private readonly logger = new Logger(EventRouter.name);
  private readonly handlers = new Map<string, EventHandler>();

  /**
   * Register an event handler for a specific event type.
   *
   * Handlers are registered by their event type (e.g., 'pull_request', 'issues').
   * If a handler is already registered for the event type, it will be replaced.
   *
   * @param eventType - The GitHub event type (e.g., 'pull_request', 'issues')
   * @param handler - The event handler implementation
   *
   * @example
   * eventRouter.registerHandler('pull_request', pullRequestHandler);
   */
  registerHandler(eventType: string, handler: EventHandler): void {
    this.logger.log(`Registering handler for event type: ${eventType}`);
    this.handlers.set(eventType, handler);
  }

  /**
   * Route a webhook event to its registered handler.
   *
   * Looks up the handler for the event type and delegates processing to it.
   * If no handler is registered for the event type, logs a warning and returns
   * a success result (to acknowledge receipt to GitHub).
   *
   * @param eventType - The GitHub event type from X-GitHub-Event header
   * @param payload - The raw webhook payload from GitHub
   * @param repositoryId - The internal repository ID
   * @param organizationId - The internal organization ID
   * @returns Result indicating success and number of jobs queued
   *
   * @example
   * const result = await eventRouter.routeEvent(
   *   'pull_request',
   *   payload,
   *   'repo-123',
   *   'org-456'
   * );
   */
  async routeEvent(
    eventType: string,
    payload: unknown,
    repositoryId: string,
    organizationId: string,
  ): Promise<EventHandlerResult> {
    const handler = this.handlers.get(eventType);

    if (!handler) {
      this.logger.warn(
        `No handler registered for event type: ${eventType}. Event acknowledged but not processed.`,
      );
      return {
        success: true,
        jobsQueued: 0,
        message: `Unsupported event type: ${eventType}`,
      };
    }

    this.logger.debug(`Routing ${eventType} event to handler for repository ${repositoryId}`);

    return handler.handle(payload, repositoryId, organizationId);
  }

  /**
   * Get list of supported event types.
   *
   * Returns an array of all event types that have registered handlers.
   * Useful for debugging, monitoring, and API documentation.
   *
   * @returns Array of supported event type strings
   *
   * @example
   * const supported = eventRouter.getSupportedEvents();
   * // ['pull_request', 'issues', 'release', 'push']
   */
  getSupportedEvents(): string[] {
    return Array.from(this.handlers.keys());
  }
}

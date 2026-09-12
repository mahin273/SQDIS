import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { RedisPubSubService, PUBSUB_CHANNELS, PubSubMessage } from '../cache/redis-pubsub.service';
import {
  CommitNewEvent,
  ScoreUpdatedEvent,
  AlertNewEvent,
  NotificationNewEvent,
  QualityGateEvaluatedWsEvent,
} from './types/websocket.types';

/**
 * Redis Pub/Sub message payloads
 */
interface CommitEventPayload {
  organizationId: string;
  event: CommitNewEvent;
}

interface ScoreEventPayload {
  entityType: 'developer' | 'project';
  entityId: string;
  organizationId: string;
  event: ScoreUpdatedEvent;
}

interface AlertEventPayload {
  organizationId: string;
  event: AlertNewEvent;
}

interface NotificationEventPayload {
  userId: string;
  event: NotificationNewEvent;
}

interface QualityGateEventPayload {
  organizationId: string;
  event: QualityGateEvaluatedWsEvent;
}

/**
 * Redis Pub/Sub Subscriber Service
 * Subscribes to Redis channels and forwards events to WebSocket clients
 * Enables horizontal scaling of WebSocket servers
 */
@Injectable()
export class RedisPubSubSubscriber implements OnModuleInit {
  private readonly logger = new Logger(RedisPubSubSubscriber.name);

  constructor(
    private readonly wsGateway: WebSocketGateway,
    private readonly redisPubSub: RedisPubSubService,
  ) {}

  /**
   * Subscribe to all Redis pub/sub channels on module init
   */
  async onModuleInit(): Promise<void> {
    await this.subscribeToChannels();
  }

  /**
   * Subscribe to all event channels
   */
  private async subscribeToChannels(): Promise<void> {
    // Subscribe to commit events
    await this.redisPubSub.subscribe<CommitEventPayload>(PUBSUB_CHANNELS.COMMIT_EVENTS, (message) =>
      this.handleCommitEvent(message),
    );

    // Subscribe to score events
    await this.redisPubSub.subscribe<ScoreEventPayload>(PUBSUB_CHANNELS.SCORE_EVENTS, (message) =>
      this.handleScoreEvent(message),
    );

    // Subscribe to alert events
    await this.redisPubSub.subscribe<AlertEventPayload>(PUBSUB_CHANNELS.ALERT_EVENTS, (message) =>
      this.handleAlertEvent(message),
    );

    // Subscribe to notification events
    await this.redisPubSub.subscribe<NotificationEventPayload>(
      PUBSUB_CHANNELS.NOTIFICATION_EVENTS,
      (message) => this.handleNotificationEvent(message),
    );

    // Subscribe to quality gate events
    await this.redisPubSub.subscribe<QualityGateEventPayload>(
      PUBSUB_CHANNELS.QUALITY_GATE_EVENTS,
      (message) => this.handleQualityGateEvent(message),
    );

    this.logger.log('Subscribed to all Redis pub/sub channels');
  }

  /**
   * Handle commit events from Redis
   * Only forward if message originated from a different server
   */
  private handleCommitEvent(message: PubSubMessage<CommitEventPayload>): void {
    // Skip if message originated from this server (already handled locally)
    if (message.serverId === this.redisPubSub.getServerId()) {
      this.logger.debug('Skipping commit event from same server');
      return;
    }

    const { organizationId, event } = message.payload;
    this.logger.debug(`Received commit event from Redis for org ${organizationId}`);

    this.wsGateway.publishCommitNew(organizationId, event);
  }

  /**
   * Handle score events from Redis
   * Only forward if message originated from a different server
   */
  private handleScoreEvent(message: PubSubMessage<ScoreEventPayload>): void {
    // Skip if message originated from this server
    if (message.serverId === this.redisPubSub.getServerId()) {
      this.logger.debug('Skipping score event from same server');
      return;
    }

    const { entityType, entityId, organizationId, event } = message.payload;
    this.logger.debug(`Received score event from Redis for ${entityType}:${entityId}`);

    this.wsGateway.publishScoreUpdated(entityType, entityId, organizationId, event);
  }

  /**
   * Handle alert events from Redis
   * Only forward if message originated from a different server
   */
  private handleAlertEvent(message: PubSubMessage<AlertEventPayload>): void {
    // Skip if message originated from this server
    if (message.serverId === this.redisPubSub.getServerId()) {
      this.logger.debug('Skipping alert event from same server');
      return;
    }

    const { organizationId, event } = message.payload;
    this.logger.debug(`Received alert event from Redis for org ${organizationId}`);

    this.wsGateway.publishAlertNew(organizationId, event);
  }

  /**
   * Handle notification events from Redis
   * Only forward if message originated from a different server
   */
  private handleNotificationEvent(message: PubSubMessage<NotificationEventPayload>): void {
    // Skip if message originated from this server
    if (message.serverId === this.redisPubSub.getServerId()) {
      this.logger.debug('Skipping notification event from same server');
      return;
    }

    const { userId, event } = message.payload;
    this.logger.debug(`Received notification event from Redis for user ${userId}`);

    this.wsGateway.publishNotificationNew(userId, event);
  }

  /**
   * Handle quality gate events from Redis
   * Only forward if message originated from a different server
   */
  private handleQualityGateEvent(message: PubSubMessage<QualityGateEventPayload>): void {
    // Skip if message originated from this server
    if (message.serverId === this.redisPubSub.getServerId()) {
      this.logger.debug('Skipping quality gate event from same server');
      return;
    }

    const { organizationId, event } = message.payload;
    this.logger.debug(
      `Received quality gate event from Redis for org ${organizationId} PR #${event.prNumber}`,
    );

    this.wsGateway.publishQualityGateEvaluated(organizationId, event);
  }
}

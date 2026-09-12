import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway } from './websocket.gateway';
import {
  CommitNewEvent,
  ScoreUpdatedEvent,
  AlertNewEvent,
  NotificationNewEvent,
  QualityGateEvaluatedWsEvent,
} from './types/websocket.types';
import { RedisPubSubService, PUBSUB_CHANNELS } from '../cache/redis-pubsub.service';

/**
 * Internal event types emitted by services
 */
export interface CommitProcessedEvent {
  commitId: string;
  sha: string;
  repositoryId: string;
  organizationId: string;
  developerId?: string; // May be null for unmapped commits
  authorName: string;
  authorEmail: string;
  classification: string | null;
  message: string;
  timestamp: Date;
}

export interface ScoreCalculatedEvent {
  entityType: 'developer' | 'project';
  entityId: string;
  organizationId: string;
  oldScore: number | null;
  newScore: number;
  scoreType: 'dqs' | 'sqs';
}

export interface AlertCreatedEvent {
  alertId: string;
  organizationId: string;
  commitId?: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  anomalyScore?: number;
  createdAt: Date;
}

export interface NotificationCreatedEvent {
  notificationId: string;
  userId: string;
  organizationId?: string;
  type: string;
  title?: string;
  message: string;
  createdAt: Date;
}

/**
 * WebSocket Events Service
 * Listens to internal events and publishes them via WebSocket and Redis Pub/Sub
 */
@Injectable()
export class WebSocketEventsService {
  private readonly logger = new Logger(WebSocketEventsService.name);

  constructor(
    private readonly wsGateway: WebSocketGateway,
    private readonly redisPubSub: RedisPubSubService,
  ) {}

  /**
   * Handle commit:new event
   */
  @OnEvent('commit.processed')
  async handleCommitProcessed(event: CommitProcessedEvent): Promise<void> {
    this.logger.debug(`Received commit.processed event for ${event.sha}`);
    this.logger.log(`Publishing commit:new event for org ${event.organizationId}`);

    // Ensure timestamp is a Date object
    const timestamp = event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp);

    const wsEvent: CommitNewEvent = {
      commitId: event.commitId,
      repoId: event.repositoryId,
      author: event.authorName || event.authorEmail,
      classification: event.classification || 'UNKNOWN',
      message: event.message,
      timestamp: timestamp.toISOString(),
    };

    // Publish to local WebSocket clients
    this.logger.log(`Calling wsGateway.publishCommitNew for org ${event.organizationId}`);
    this.wsGateway.publishCommitNew(event.organizationId, wsEvent);
    this.logger.log(`Called wsGateway.publishCommitNew successfully`);

    // Publish to Redis for distribution to other server instances
    await this.redisPubSub.publish(PUBSUB_CHANNELS.COMMIT_EVENTS, 'commit:new', {
      organizationId: event.organizationId,
      event: wsEvent,
    });
  }

  /**
   * Handle score:updated event
   */
  @OnEvent('score.calculated')
  async handleScoreCalculated(event: ScoreCalculatedEvent): Promise<void> {
    this.logger.debug(`Received score.calculated event for ${event.entityType}:${event.entityId}`);

    const wsEvent: ScoreUpdatedEvent = {
      entityType: event.entityType,
      entityId: event.entityId,
      oldScore: event.oldScore ?? 0,
      newScore: event.newScore,
      scoreType: event.scoreType,
    };

    // Publish to local WebSocket clients
    this.wsGateway.publishScoreUpdated(
      event.entityType,
      event.entityId,
      event.organizationId,
      wsEvent,
    );

    // Publish to Redis for distribution to other server instances
    await this.redisPubSub.publish(PUBSUB_CHANNELS.SCORE_EVENTS, 'score:updated', {
      entityType: event.entityType,
      entityId: event.entityId,
      organizationId: event.organizationId,
      event: wsEvent,
    });
  }

  /**
   * Handle alert:new event
   */
  @OnEvent('alert.created')
  async handleAlertCreated(event: AlertCreatedEvent): Promise<void> {
    this.logger.debug(`Received alert.created event for ${event.alertId}`);

    const wsEvent: AlertNewEvent = {
      alertId: event.alertId,
      severity: event.severity,
      message: event.message,
      type: event.type,
      commitId: event.commitId,
    };

    // Publish to local WebSocket clients
    this.wsGateway.publishAlertNew(event.organizationId, wsEvent);

    // Publish to Redis for distribution to other server instances
    await this.redisPubSub.publish(PUBSUB_CHANNELS.ALERT_EVENTS, 'alert:new', {
      organizationId: event.organizationId,
      event: wsEvent,
    });
  }

  /**
   * Handle notification:new event
   */
  @OnEvent('notification.created')
  async handleNotificationCreated(event: NotificationCreatedEvent): Promise<void> {
    this.logger.debug(`Received notification.created event for user ${event.userId}`);

    const wsEvent: NotificationNewEvent = {
      notificationId: event.notificationId,
      type: event.type,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    };

    // Publish to local WebSocket clients
    this.wsGateway.publishNotificationNew(event.userId, wsEvent);

    // Publish to Redis for distribution to other server instances
    await this.redisPubSub.publish(PUBSUB_CHANNELS.NOTIFICATION_EVENTS, 'notification:new', {
      userId: event.userId,
      event: wsEvent,
    });
  }

  /**
   * Handle pr.quality_gate.evaluated event
   */
  @OnEvent('pr.quality_gate.evaluated')
  async handleQualityGateEvaluated(event: any): Promise<void> {
    this.logger.debug(
      `Received pr.quality_gate.evaluated event for repo ${event.repositoryId} PR #${event.prNumber}`,
    );

    const wsEvent: QualityGateEvaluatedWsEvent = {
      evaluationId: event.evaluationId,
      pullRequestId: event.pullRequestId,
      repositoryId: event.repositoryId,
      organizationId: event.organizationId,
      prNumber: event.prNumber,
      status: event.status,
      defectProbability: event.defectProbability,
      riskLevel: event.riskLevel,
      maxComplexity: event.maxComplexity,
      headCommitSha: event.headCommitSha,
      githubStatusState: event.githubStatusState,
      summaryMarkdown: event.summaryMarkdown,
      createdAt: (event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt)).toISOString(),
    };

    if (event.organizationId) {
      // Publish to local WebSocket clients in organization room
      this.wsGateway.publishQualityGateEvaluated(event.organizationId, wsEvent);

      // Publish to Redis for cluster-wide distribution
      await this.redisPubSub.publish(PUBSUB_CHANNELS.QUALITY_GATE_EVENTS, 'pr:evaluated', {
        organizationId: event.organizationId,
        event: wsEvent,
      });
    }
  }
}

/* eslint-disable */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/**
 * Redis Pub/Sub channel names for event distribution
 */
export const PUBSUB_CHANNELS = {
  /** Channel for commit events */
  COMMIT_EVENTS: 'sqdis:events:commit',
  /** Channel for score update events */
  SCORE_EVENTS: 'sqdis:events:score',
  /** Channel for alert events */
  ALERT_EVENTS: 'sqdis:events:alert',
  /** Channel for notification events */
  NOTIFICATION_EVENTS: 'sqdis:events:notification',
  /** Channel for team events */
  TEAM_EVENTS: 'sqdis:events:team',
};

/**
 * Event types for pub/sub messages
 */
export interface PubSubMessage<T = any> {
  type: string;
  payload: T;
  timestamp: string;
  serverId?: string;
}

/**
 * Callback type for message handlers
 */
export type MessageHandler<T = any> = (message: PubSubMessage<T>) => void;

/**
 * Redis Pub/Sub Service for distributed event distribution
 * Enables real-time event propagation across multiple server instances
 *
 * Features:
 * - Separate publisher and subscriber connections (required by Redis)
 * - Automatic reconnection with exponential backoff
 * - Graceful handling of connection failures
 * - Message serialization/deserialization
 */
@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);

  /** Publisher Redis connection */
  private publisher: Redis | null = null;

  /** Subscriber Redis connection */
  private subscriber: Redis | null = null;

  /** Connection status flags */
  private isPublisherConnected = false;
  private isSubscriberConnected = false;

  /** Message handlers by channel */
  private readonly handlers: Map<string, Set<MessageHandler>> = new Map();

  /** Unique server ID for message deduplication */
  private readonly serverId: string;

  constructor(private readonly configService: ConfigService) {
    // Generate unique server ID
    this.serverId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }


  /**
   * Create Redis connection options
   */
  private getConnectionOptions(): { host: string; port: number; password?: string } {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    };
  }

  /**
   * Connect to Redis for pub/sub
   * Creates separate connections for publisher and subscriber
   */
  private async connect(): Promise<void> {
    const options = this.getConnectionOptions();

    try {
      // Create publisher connection
      this.publisher = new Redis({
        ...options,
        retryStrategy: (times) => this.retryStrategy(times, 'publisher'),
        lazyConnect: true,
      });

      // Create subscriber connection (Redis requires separate connection for subscriptions)
      this.subscriber = new Redis({
        ...options,
        retryStrategy: (times) => this.retryStrategy(times, 'subscriber'),
        lazyConnect: true,
      });

      // Setup event handlers for publisher
      this.setupConnectionHandlers(this.publisher, 'publisher');

      // Setup event handlers for subscriber
      this.setupConnectionHandlers(this.subscriber, 'subscriber');

      // Connect both
      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);

      this.isPublisherConnected = true;
      this.isSubscriberConnected = true;

      this.logger.log(`Redis Pub/Sub connected at ${options.host}:${options.port}`);
    } catch (error) {
      this.logger.warn(`Failed to connect Redis Pub/Sub: ${error}. Operating without pub/sub.`);
      this.isPublisherConnected = false;
      this.isSubscriberConnected = false;
    }
  }

  /**
   * Retry strategy for Redis connections
   */
  private retryStrategy(times: number, connectionType: string): number | null {
    if (times > 5) {
      this.logger.warn(`Redis ${connectionType} connection failed after 5 retries`);
      return null;
    }
    const delay = Math.min(times * 500, 5000);
    this.logger.debug(`Redis ${connectionType} retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(connection: Redis, type: string): void {
    connection.on('connect', () => {
      this.logger.log(`Redis ${type} connected`);
      if (type === 'publisher') {
        this.isPublisherConnected = true;
      } else {
        this.isSubscriberConnected = true;
      }
    });

    connection.on('error', (error) => {
      this.logger.error(`Redis ${type} error: ${error.message}`);
    });

    connection.on('close', () => {
      this.logger.warn(`Redis ${type} connection closed`);
      if (type === 'publisher') {
        this.isPublisherConnected = false;
      } else {
        this.isSubscriberConnected = false;
      }
    });

    connection.on('reconnecting', () => {
      this.logger.debug(`Redis ${type} reconnecting...`);
    });
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    if (this.publisher) {
      disconnectPromises.push(
        this.publisher.quit().then(() => {
          this.isPublisherConnected = false;
          this.logger.log('Redis publisher disconnected');
        }),
      );
    }

    if (this.subscriber) {
      disconnectPromises.push(
        this.subscriber.quit().then(() => {
          this.isSubscriberConnected = false;
          this.logger.log('Redis subscriber disconnected');
        }),
      );
    }

    await Promise.all(disconnectPromises);
  }

  /**
   * Check if pub/sub is available
   */
  isAvailable(): boolean {
    return this.isPublisherConnected && this.isSubscriberConnected;
  }

  /**
   * Check if publisher is available
   */
  isPublisherAvailable(): boolean {
    return this.isPublisherConnected && this.publisher !== null;
  }

  /**
   * Check if subscriber is available
   */
  isSubscriberAvailable(): boolean {
    return this.isSubscriberConnected && this.subscriber !== null;
  }


  /**
   * Publish a message to a channel
   * @param channel - Channel name to publish to
   * @param type - Event type
   * @param payload - Event payload
   */
  async publish<T>(channel: string, type: string, payload: T): Promise<boolean> {
    if (!this.isPublisherAvailable()) {
      this.logger.debug(`Pub/sub not available, skipping publish to ${channel}`);
      return false;
    }

    try {
      const message: PubSubMessage<T> = {
        type,
        payload,
        timestamp: new Date().toISOString(),
        serverId: this.serverId,
      };

      await this.publisher!.publish(channel, JSON.stringify(message));
      this.logger.debug(`Published ${type} to ${channel}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}: ${error}`);
      return false;
    }
  }

  /**
   * Subscribe to a channel
   * @param channel - Channel name to subscribe to
   * @param handler - Message handler callback
   */
  async subscribe<T>(channel: string, handler: MessageHandler<T>): Promise<boolean> {
    if (!this.isSubscriberAvailable()) {
      this.logger.debug(`Pub/sub not available, skipping subscribe to ${channel}`);
      return false;
    }

    try {
      // Add handler to the set
      if (!this.handlers.has(channel)) {
        this.handlers.set(channel, new Set());

        // Subscribe to Redis channel
        await this.subscriber!.subscribe(channel);
        this.logger.debug(`Subscribed to channel: ${channel}`);
      }

      this.handlers.get(channel)!.add(handler as MessageHandler);

      // Setup message handler if not already done
      this.setupMessageHandler();

      return true;
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}: ${error}`);
      return false;
    }
  }

  /**
   * Unsubscribe from a channel
   *
   * @param channel - Channel name to unsubscribe from
   * @param handler - Optional specific handler to remove
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<boolean> {
    if (!this.isSubscriberAvailable()) {
      return false;
    }

    try {
      const channelHandlers = this.handlers.get(channel);

      if (channelHandlers) {
        if (handler) {
          channelHandlers.delete(handler);
        } else {
          channelHandlers.clear();
        }

        // If no more handlers, unsubscribe from Redis
        if (channelHandlers.size === 0) {
          await this.subscriber!.unsubscribe(channel);
          this.handlers.delete(channel);
          this.logger.debug(`Unsubscribed from channel: ${channel}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from ${channel}: ${error}`);
      return false;
    }
  }

  /**
   * Setup the message handler for incoming messages
   */
  private messageHandlerSetup = false;
  private setupMessageHandler(): void {
    if (this.messageHandlerSetup || !this.subscriber) {
      return;
    }

    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const parsedMessage: PubSubMessage = JSON.parse(message);

        // Get handlers for this channel
        const channelHandlers = this.handlers.get(channel);
        if (channelHandlers) {
          for (const handler of channelHandlers) {
            try {
              handler(parsedMessage);
            } catch (handlerError) {
              this.logger.error(`Handler error for ${channel}: ${handlerError}`);
            }
          }
        }
      } catch (parseError) {
        this.logger.error(`Failed to parse message from ${channel}: ${parseError}`);
      }
    });

    this.messageHandlerSetup = true;
    this.logger.debug('Message handler setup complete');
  }

  /**
   * Get the server ID
   */
  getServerId(): string {
    return this.serverId;
  }

  /**
   * Get subscribed channels
   */
  getSubscribedChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Publish commit event
   */
  async publishCommitEvent(payload: any): Promise<boolean> {
    return this.publish(PUBSUB_CHANNELS.COMMIT_EVENTS, 'commit:new', payload);
  }

  /**
   * Publish score update event
   *
   */
  async publishScoreEvent(payload: any): Promise<boolean> {
    return this.publish(PUBSUB_CHANNELS.SCORE_EVENTS, 'score:updated', payload);
  }

  /**
   * Publish alert event
   *
   */
  async publishAlertEvent(payload: any): Promise<boolean> {
    return this.publish(PUBSUB_CHANNELS.ALERT_EVENTS, 'alert:new', payload);
  }

  /**
   * Publish notification event
   *
   */
  async publishNotificationEvent(payload: any): Promise<boolean> {
    return this.publish(PUBSUB_CHANNELS.NOTIFICATION_EVENTS, 'notification:new', payload);
  }
}

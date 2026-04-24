import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtPayload } from '../auth/types/jwt-payload.types';

/**
 * Authenticated socket with user context for audit events
 */
interface AuthenticatedAuditSocket {
  id: string;
  userId: string;
  email: string;
  organizationId: string;
  role: string;
  subscribedToAuditEvents: boolean;
}

/**
 * Audit event payload emitted to clients
 */
interface AuditEventPayload {
  id: string;
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  timestamp: Date;
  severity?: string | null;
  metadata?: any;
}

/**
 * WebSocket Gateway for real-time audit event streaming.
 *
 * This gateway:
 * - Listens to audit.created events from AuditMonitorService
 * - Streams events to connected clients filtered by organization
 * - Handles client subscriptions and unsubscriptions
 * - Requires JWT authentication
 *
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Configure appropriately for production
    credentials: true,
  },
  namespace: '/audit-events',
  transports: ['websocket', 'polling'],
})
export class AuditEventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuditEventsGateway.name);
  private readonly connectedClients: Map<string, AuthenticatedAuditSocket> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Called after gateway initialization
   */
  afterInit() {
    this.logger.log('Audit Events WebSocket Gateway initialized on /audit-events');
  }

  /**
   * Handle new client connection with JWT authentication
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided (${client.id})`);
        client.emit('error', {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);

      // Verify user has ADMIN or OWNER role (required for audit log access)
      if (payload.role !== 'ADMIN' && payload.role !== 'OWNER') {
        this.logger.warn(
          `Connection rejected: Insufficient permissions (${client.id}, role: ${payload.role})`,
        );
        client.emit('error', {
          message: 'Insufficient permissions. Required role: ADMIN or OWNER',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
        client.disconnect();
        return;
      }

      // Create authenticated socket context
      const authSocket: AuthenticatedAuditSocket = {
        id: client.id,
        userId: payload.sub,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role,
        subscribedToAuditEvents: false,
      };

      // Store client context
      this.connectedClients.set(client.id, authSocket);

      this.logger.log(
        `Client connected to audit events: ${client.id} (User: ${payload.email}, Org: ${payload.organizationId})`,
      );

      // Send connection success
      client.emit('connected', {
        message: 'Connected to audit events stream',
        organizationId: payload.organizationId,
      });
    } catch (error) {
      this.logger.warn(
        `Connection rejected: Invalid token (${client.id}) - ${error.message}`,
      );
      client.emit('error', {
        message: 'Invalid or expired token',
        code: 'AUTH_FAILED',
      });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   *
   */
  handleDisconnect(client: Socket) {
    const authSocket = this.connectedClients.get(client.id);

    if (authSocket) {
      // Remove client from connected clients
      this.connectedClients.delete(client.id);

      this.logger.log(
        `Client disconnected from audit events: ${client.id} (User: ${authSocket.email})`,
      );
    } else {
      this.logger.log(`Client disconnected from audit events: ${client.id} (unauthenticated)`);
    }
  }

  /**
   * Subscribe to audit event stream
   *
   * Clients must explicitly subscribe to start receiving events.
   * Events are automatically filtered by the client's organization.
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket) {
    const authSocket = this.connectedClients.get(client.id);

    if (!authSocket) {
      client.emit('error', {
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Mark as subscribed
    authSocket.subscribedToAuditEvents = true;

    // Join organization-specific room for efficient broadcasting
    const roomName = `audit:${authSocket.organizationId}`;
    client.join(roomName);

    client.emit('subscribed', {
      message: 'Subscribed to audit events',
      organizationId: authSocket.organizationId,
    });

    this.logger.debug(
      `Client ${client.id} subscribed to audit events for org ${authSocket.organizationId}`,
    );
  }

  /**
   * Unsubscribe from audit event stream
   *
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    const authSocket = this.connectedClients.get(client.id);

    if (!authSocket) {
      client.emit('error', {
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Mark as unsubscribed
    authSocket.subscribedToAuditEvents = false;

    // Leave organization room
    const roomName = `audit:${authSocket.organizationId}`;
    client.leave(roomName);

    client.emit('unsubscribed', {
      message: 'Unsubscribed from audit events',
    });

    this.logger.debug(`Client ${client.id} unsubscribed from audit events`);
  }

  /**
   * Listen to audit.created events from AuditMonitorService and broadcast to clients
   *
   * Events are automatically filtered by organization - clients only receive
   * events for their own organization.
   *
   */
  @OnEvent('audit.created')
  handleAuditCreated(payload: AuditEventPayload) {
    try {
      // Broadcast to organization-specific room
      const roomName = `audit:${payload.organizationId}`;

      this.server.to(roomName).emit('audit:created', {
        id: payload.id,
        userId: payload.userId,
        organizationId: payload.organizationId,
        action: payload.action,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        timestamp: payload.timestamp,
        severity: payload.severity,
        metadata: payload.metadata,
      });

      this.logger.debug(
        `Broadcasted audit event to ${roomName}: action=${payload.action}, resource=${payload.resourceType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast audit event: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Listen to audit.security_alert events and broadcast to clients
   *
   * Security alerts are high-priority events that should be immediately
   * visible to administrators.
   *
   */
  @OnEvent('audit.security_alert')
  handleSecurityAlert(payload: {
    type: string;
    entry: AuditEventPayload;
    details: any;
    timestamp: Date;
  }) {
    try {
      // Broadcast to organization-specific room
      const roomName = `audit:${payload.entry.organizationId}`;

      this.server.to(roomName).emit('audit:security_alert', {
        type: payload.type,
        auditEntry: {
          id: payload.entry.id,
          userId: payload.entry.userId,
          action: payload.entry.action,
          resourceType: payload.entry.resourceType,
          resourceId: payload.entry.resourceId,
          timestamp: payload.entry.timestamp,
        },
        details: payload.details,
        timestamp: payload.timestamp,
      });

      this.logger.warn(
        `Broadcasted security alert to ${roomName}: type=${payload.type}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast security alert: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Extract JWT token from socket handshake
   */
  private extractToken(client: Socket): string | null {
    // Try to get token from handshake auth
    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken;
    }

    // Try to get token from query parameter
    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Try to get token from Authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Get count of connected clients
   */
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get count of subscribed clients for an organization
   */
  getSubscribedClientCount(organizationId: string): number {
    let count = 0;
    for (const authSocket of this.connectedClients.values()) {
      if (
        authSocket.organizationId === organizationId &&
        authSocket.subscribedToAuditEvents
      ) {
        count++;
      }
    }
    return count;
  }
}

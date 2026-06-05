/*eslint-disable*/
import {
  WebSocketGateway as WsGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChannelManager } from './channel-manager.service';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import {
  AuthenticatedSocket,
  CommitNewEvent,
  ScoreUpdatedEvent,
  AlertNewEvent,
  NotificationNewEvent,
} from './types/websocket.types';
import { JwtPayload } from '../auth/types/jwt-payload.types';

/**
 * WebSocket Gateway for real-time communication
 * Implements Socket.io with JWT authentication

 */
@WsGateway({
  cors: {
    origin: '*', // Configure appropriately for production
    credentials: true,
  },
  namespace: '/',
  transports: ['websocket', 'polling'],
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private readonly connectedClients: Map<string, AuthenticatedSocket> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly channelManager: ChannelManager,
  ) {}

  /**
   * Called after gateway initialization
   */
  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  /**
   * Handle new client connection
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided (${client.id})`);
        client.emit('error', { message: 'Authentication required', code: 'AUTH_REQUIRED' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload & { exp?: number }>(token);

      // Create authenticated socket context
      const authSocket: AuthenticatedSocket = {
        id: client.id,
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        organizationId: payload.organizationId,
        role: payload.role,
        subscribedChannels: new Set(),
      };

      // Enforce token lifetime limits to prevent session hijacking
      if (payload.exp) {
        const expirationTimeMs = payload.exp * 1000;
        const timeToExpiration = expirationTimeMs - Date.now();

        if (timeToExpiration <= 0) {
          this.logger.warn(`Connection rejected: Token already expired (${client.id})`);
          client.emit('error', { message: 'Token expired', code: 'AUTH_EXPIRED' });
          client.disconnect();
          return;
        }

        // Schedule automatic disconnection
        const timeout = setTimeout(() => {
          this.logger.warn(`Disconnecting client: Token expired (${client.id})`);
          client.emit('error', { message: 'Token expired', code: 'AUTH_EXPIRED' });
          client.disconnect();
        }, timeToExpiration);

        // Store timeout reference on the socket object
        (client as any).authTimeout = timeout;
      }

      // Store client context
      this.connectedClients.set(client.id, authSocket);

      this.logger.log(`Client connected: ${client.id} (User: ${payload.email})`);
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token (${client.id}) - ${error.message}`);
      client.emit('error', { message: 'Invalid or expired token', code: 'AUTH_FAILED' });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    // Clear the token expiration timeout if it exists
    const authTimeout = (client as any).authTimeout;
    if (authTimeout) {
      clearTimeout(authTimeout);
    }

    const authSocket = this.connectedClients.get(client.id);

    if (authSocket) {
      // Unsubscribe from all channels
      this.channelManager.unsubscribeAll(client.id);

      // Remove client from connected clients
      this.connectedClients.delete(client.id);

      this.logger.log(`Client disconnected: ${client.id} (User: ${authSocket.email})`);
    } else {
      this.logger.log(`Client disconnected: ${client.id} (unauthenticated)`);
    }
  }

  /**
   * Subscribe to organization dashboard channel
   */
  @SubscribeMessage('subscribe:dashboard')
  handleSubscribeDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orgId: string },
  ) {
    const authSocket = this.connectedClients.get(client.id);

    if (!authSocket) {
      client.emit('error', { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    // Verify user has access to this organization
    if (authSocket.organizationId !== data.orgId) {
      client.emit('error', {
        message: 'Access denied to this organization',
        code: 'ACCESS_DENIED',
      });
      return;
    }

    const channelName = this.channelManager.subscribe(
      client.id,
      authSocket.userId,
      'dashboard',
      data.orgId,
    );

    // Join Socket.io room for efficient broadcasting
    client.join(channelName);
    authSocket.subscribedChannels.add(channelName);

    client.emit('subscribed', { channel: channelName });
    this.logger.debug(`Client ${client.id} subscribed to dashboard:${data.orgId}`);
  }

  /**
   * Subscribe to team channel
   */
  @SubscribeMessage('subscribe:team')
  handleSubscribeTeam(@ConnectedSocket() client: Socket, @MessageBody() data: { teamId: string }) {
    const authSocket = this.connectedClients.get(client.id);

    if (!authSocket) {
      client.emit('error', { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    const channelName = this.channelManager.subscribe(
      client.id,
      authSocket.userId,
      'team',
      data.teamId,
    );

    // Join Socket.io room
    client.join(channelName);
    authSocket.subscribedChannels.add(channelName);

    client.emit('subscribed', { channel: channelName });
    this.logger.debug(`Client ${client.id} subscribed to team:${data.teamId}`);
  }

  /**
   * Subscribe to developer channel
   */
  @SubscribeMessage('subscribe:developer')
  handleSubscribeDeveloper(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { developerId: string },
  ) {
    const authSocket = this.connectedClients.get(client.id);

    if (!authSocket) {
      client.emit('error', { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    const channelName = this.channelManager.subscribe(
      client.id,
      authSocket.userId,
      'developer',
      data.developerId,
    );

    // Join Socket.io room
    client.join(channelName);
    authSocket.subscribedChannels.add(channelName);

    client.emit('subscribed', { channel: channelName });
    this.logger.debug(`Client ${client.id} subscribed to developer:${data.developerId}`);
  }

  /**
   * Unsubscribe from a channel
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { channel: string }) {
    const authSocket = this.connectedClients.get(client.id);

    if (!authSocket) {
      client.emit('error', { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    this.channelManager.unsubscribe(client.id, data.channel);

    // Leave Socket.io room
    client.leave(data.channel);
    authSocket.subscribedChannels.delete(data.channel);

    client.emit('unsubscribed', { channel: data.channel });
    this.logger.debug(`Client ${client.id} unsubscribed from ${data.channel}`);
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

  // ==================== Event Publishing Methods ====================

  /**
   * Publish commit:new event to dashboard subscribers
   */
  publishCommitNew(orgId: string, event: CommitNewEvent): void {
    const channelName = this.channelManager.getChannelName('dashboard', orgId);
    this.logger.log(`Publishing commit:new to channel ${channelName}`);
    this.logger.log(`Connected clients: ${this.connectedClients.size}`);
    this.server.to(channelName).emit('commit:new', event);
    this.logger.log(`Published commit:new to ${channelName}`);
  }

  /**
   * Publish score:updated event
   */
  publishScoreUpdated(
    entityType: 'developer' | 'project',
    entityId: string,
    orgId: string,
    event: ScoreUpdatedEvent,
  ): void {
    // Publish to dashboard
    const dashboardChannel = this.channelManager.getChannelName('dashboard', orgId);
    this.server.to(dashboardChannel).emit('score:updated', event);

    // Publish to entity-specific channel
    if (entityType === 'developer') {
      const developerChannel = this.channelManager.getChannelName('developer', entityId);
      this.server.to(developerChannel).emit('score:updated', event);
    }

    this.logger.debug(`Published score:updated for ${entityType}:${entityId}`);
  }

  /**
   * Publish alert:new event
   */
  publishAlertNew(orgId: string, event: AlertNewEvent): void {
    const channelName = this.channelManager.getChannelName('dashboard', orgId);
    this.server.to(channelName).emit('alert:new', event);
    this.logger.debug(`Published alert:new to ${channelName}`);
  }

  /**
   * Publish notification:new event to specific user
   */
  publishNotificationNew(userId: string, event: NotificationNewEvent): void {
    // Find all sockets for this user
    for (const [socketId, authSocket] of this.connectedClients) {
      if (authSocket.userId === userId) {
        this.server.to(socketId).emit('notification:new', event);
      }
    }
    this.logger.debug(`Published notification:new to user ${userId}`);
  }

  /**
   * Publish event to a team channel
   */
  publishToTeam(teamId: string, eventName: string, data: any): void {
    const channelName = this.channelManager.getChannelName('team', teamId);
    this.server.to(channelName).emit(eventName, data);
    this.logger.debug(`Published ${eventName} to ${channelName}`);
  }

  // ==================== Utility Methods ====================

  /**
   * Get count of connected clients
   */
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get connected client info
   */
  getConnectedClients(): AuthenticatedSocket[] {
    return Array.from(this.connectedClients.values());
  }

  /**
   * Check if a user is connected
   */
  isUserConnected(userId: string): boolean {
    for (const authSocket of this.connectedClients.values()) {
      if (authSocket.userId === userId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Emit a test commit:new event for debugging
   */
  emitTestCommitEvent(orgId: string): { success: boolean; message: string; clientCount: number } {
    const channelName = this.channelManager.getChannelName('dashboard', orgId);
    const testEvent: CommitNewEvent = {
      commitId: `test-${Date.now()}`,
      repoId: 'test-repo',
      author: 'Test Author',
      classification: 'FEATURE',
      message: 'Test commit for WebSocket debugging',
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`Emitting test commit:new event to channel ${channelName}`);
    this.logger.log(`Connected clients: ${this.connectedClients.size}`);

    // Get clients in this room (safely)
    let roomSize = 0;
    try {
      const room = this.server?.sockets?.adapter?.rooms?.get(channelName);
      roomSize = room ? room.size : 0;
    } catch (e) {
      this.logger.warn(`Could not get room size: ${e}`);
    }
    this.logger.log(`Clients in room ${channelName}: ${roomSize}`);

    this.server.to(channelName).emit('commit:new', testEvent);

    return {
      success: true,
      message: `Test event emitted to ${channelName}`,
      clientCount: roomSize,
    };
  }
}

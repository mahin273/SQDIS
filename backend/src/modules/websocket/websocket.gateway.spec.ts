import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { ForbiddenException } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { ChannelManager } from './channel-manager.service';
import { DataFilterService } from '../auth/services/data-filter.service';

describe('WebSocketGateway', () => {
  let gateway: WebSocketGateway;
  let jwtService: { verify: jest.Mock };
  let channelManager: {
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
    unsubscribeAll: jest.Mock;
    getChannelSubscribers: jest.Mock;
  };
  let dataFilterService: {
    verifyOrganizationAccess: jest.Mock;
    verifyTeamAccess: jest.Mock;
    verifyDeveloperAccess: jest.Mock;
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jwtService = {
      verify: jest.fn(),
    };
    channelManager = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      unsubscribeAll: jest.fn(),
      getChannelSubscribers: jest.fn(),
    };
    dataFilterService = {
      verifyOrganizationAccess: jest.fn(),
      verifyTeamAccess: jest.fn(),
      verifyDeveloperAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: ChannelManager, useValue: channelManager },
        { provide: DataFilterService, useValue: dataFilterService },
      ],
    }).compile();

    gateway = module.get<WebSocketGateway>(WebSocketGateway);
  });

  afterEach(() => {
    jest.clearAllTimocks?.();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('authenticates client when valid JWT token is provided in auth payload', async () => {
      const mockClient = {
        id: 'socket-1',
        handshake: {
          auth: { token: 'valid-jwt-token' },
          headers: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        organizationId: 'org-1',
        role: 'DEVELOPER',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await gateway.handleConnection(mockClient);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockClient.emit).not.toHaveBeenCalledWith('error', expect.anything());
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('rejects and disconnects client when no token is provided', async () => {
      const mockClient = {
        id: 'socket-2',
        handshake: {
          auth: {},
          headers: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('rejects connection when JWT token is invalid or expired', async () => {
      const mockClient = {
        id: 'socket-3',
        handshake: {
          auth: { token: 'bad-token' },
          headers: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid or expired token',
        code: 'AUTH_FAILED',
      });
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('cleans up client subscriptions upon disconnect', async () => {
      const mockClient = {
        id: 'socket-1',
      } as unknown as Socket;

      // Add to connected clients map
      (gateway as any).connectedClients.set('socket-1', {
        id: 'socket-1',
        userId: 'user-1',
        email: 'alice@example.com',
        organizationId: 'org-1',
        subscribedChannels: new Set(),
      });

      gateway.handleDisconnect(mockClient);

      expect(channelManager.unsubscribeAll).toHaveBeenCalledWith('socket-1');
      expect((gateway as any).connectedClients.has('socket-1')).toBe(false);
    });
  });

  describe('handleSubscribeDashboard', () => {
    it('subscribes authenticated client to organization dashboard room', async () => {
      const mockClient = {
        id: 'socket-1',
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      (gateway as any).connectedClients.set('socket-1', {
        id: 'socket-1',
        userId: 'user-1',
        organizationId: 'org-1',
        subscribedChannels: new Set(),
      });

      dataFilterService.verifyOrganizationAccess.mockResolvedValue({
        organizationId: 'org-1',
        role: 'DEVELOPER',
      });
      channelManager.subscribe.mockReturnValue('dashboard:org-1');

      await gateway.handleSubscribeDashboard(mockClient, { orgId: 'org-1' });

      expect(dataFilterService.verifyOrganizationAccess).toHaveBeenCalledWith('org-1', 'user-1');
      expect(channelManager.subscribe).toHaveBeenCalledWith(
        'socket-1',
        'user-1',
        'dashboard',
        'org-1',
      );
      expect(mockClient.join).toHaveBeenCalledWith('dashboard:org-1');
      expect(mockClient.emit).toHaveBeenCalledWith('subscribed', { channel: 'dashboard:org-1' });
    });

    it('rejects subscription if client attempts to access unauthorized organization', async () => {
      const mockClient = {
        id: 'socket-2',
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      (gateway as any).connectedClients.set('socket-2', {
        id: 'socket-2',
        userId: 'user-1',
        organizationId: 'org-1',
        subscribedChannels: new Set(),
      });

      dataFilterService.verifyOrganizationAccess.mockRejectedValue(
        new ForbiddenException('Access denied: You are not an active member of this organization.'),
      );

      await gateway.handleSubscribeDashboard(mockClient, { orgId: 'other-org' });

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Access denied: You are not an active member of this organization.',
        code: 'ACCESS_DENIED',
      });
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscribeTeam', () => {
    it('subscribes client when team access is verified', async () => {
      const mockClient = {
        id: 'socket-1',
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      (gateway as any).connectedClients.set('socket-1', {
        id: 'socket-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'DEVELOPER',
        subscribedChannels: new Set(),
      });

      dataFilterService.verifyTeamAccess.mockResolvedValue({
        teamId: 'team-1',
        organizationId: 'org-1',
      });
      channelManager.subscribe.mockReturnValue('team:team-1');

      await gateway.handleSubscribeTeam(mockClient, { teamId: 'team-1' });

      expect(dataFilterService.verifyTeamAccess).toHaveBeenCalledWith('team-1', 'org-1', {
        id: 'user-1',
        role: 'DEVELOPER',
      });
      expect(channelManager.subscribe).toHaveBeenCalledWith('socket-1', 'user-1', 'team', 'team-1');
      expect(mockClient.join).toHaveBeenCalledWith('team:team-1');
      expect(mockClient.emit).toHaveBeenCalledWith('subscribed', { channel: 'team:team-1' });
    });

    it('rejects subscription when team access is forbidden', async () => {
      const mockClient = {
        id: 'socket-1',
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      (gateway as any).connectedClients.set('socket-1', {
        id: 'socket-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'DEVELOPER',
        subscribedChannels: new Set(),
      });

      dataFilterService.verifyTeamAccess.mockRejectedValue(
        new ForbiddenException('Access denied: You are not an active member or leader of this team.'),
      );

      await gateway.handleSubscribeTeam(mockClient, { teamId: 'unassigned-team' });

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Access denied: You are not an active member or leader of this team.',
        code: 'ACCESS_DENIED',
      });
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscribeDeveloper', () => {
    it('subscribes client when developer access is verified', async () => {
      const mockClient = {
        id: 'socket-1',
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      (gateway as any).connectedClients.set('socket-1', {
        id: 'socket-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'DEVELOPER',
        subscribedChannels: new Set(),
      });

      dataFilterService.verifyDeveloperAccess.mockResolvedValue({
        developerId: 'user-1',
        organizationId: 'org-1',
      });
      channelManager.subscribe.mockReturnValue('developer:user-1');

      await gateway.handleSubscribeDeveloper(mockClient, { developerId: 'user-1' });

      expect(dataFilterService.verifyDeveloperAccess).toHaveBeenCalledWith('user-1', 'org-1', {
        id: 'user-1',
        role: 'DEVELOPER',
      });
      expect(channelManager.subscribe).toHaveBeenCalledWith(
        'socket-1',
        'user-1',
        'developer',
        'user-1',
      );
      expect(mockClient.join).toHaveBeenCalledWith('developer:user-1');
      expect(mockClient.emit).toHaveBeenCalledWith('subscribed', { channel: 'developer:user-1' });
    });

    it('rejects subscription when developer access is forbidden', async () => {
      const mockClient = {
        id: 'socket-1',
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      (gateway as any).connectedClients.set('socket-1', {
        id: 'socket-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'DEVELOPER',
        subscribedChannels: new Set(),
      });

      dataFilterService.verifyDeveloperAccess.mockRejectedValue(
        new ForbiddenException('Developers can only access their own developer data.'),
      );

      await gateway.handleSubscribeDeveloper(mockClient, { developerId: 'other-user' });

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Developers can only access their own developer data.',
        code: 'ACCESS_DENIED',
      });
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });
});

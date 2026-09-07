import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { GitHubService } from './github.service';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(),
}));

describe('GitHubService', () => {
  let service: GitHubService;
  let prisma: {
    gitHubConnection: Record<string, jest.Mock>;
    repository: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let encryptionService: Record<string, jest.Mock>;
  let dataFilterService: Record<string, jest.Mock>;
  let cacheService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let octokit: any;

  const connection = {
    id: 'conn-1',
    organizationId: 'org-1',
    encryptedPAT: 'encrypted-token',
    scopes: ['repo', 'admin:org', 'admin:repo_hook'],
    connectedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const repository = {
    id: 'repo-1',
    organizationId: 'org-1',
    githubId: 123,
    name: 'api',
    fullName: 'acme/api',
    isEnabled: true,
    webhookId: 99,
    webhookSecret: 'old-secret',
    lastSyncAt: null,
  };

  beforeEach(() => {
    prisma = {
      gitHubConnection: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      repository: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    encryptionService = {
      encrypt: jest.fn((value) => `encrypted:${value}`),
      decrypt: jest.fn(() => 'plain-token'),
    };
    dataFilterService = {
      createRepositoryFilter: jest.fn(() => ({ organizationId: 'org-1' })),
    };
    cacheService = {
      delete: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GITHUB_CLIENT_ID') return 'mock-client-id';
        if (key === 'GITHUB_CALLBACK_URL') return 'http://localhost:3000/api/auth/github/callback';
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        return null;
      }),
    };
    octokit = {
      rest: {
        users: {
          getAuthenticated: jest.fn(),
        },
        repos: {
          listForAuthenticatedUser: jest.fn(),
          listWebhooks: jest.fn(),
          createWebhook: jest.fn(),
          updateWebhook: jest.fn(),
          deleteWebhook: jest.fn(),
          pingWebhook: jest.fn(),
        },
      },
      paginate: jest.fn(),
    };
    jest.mocked(Octokit).mockImplementation(() => octokit);

    service = new GitHubService(
      prisma as any,
      encryptionService as any,
      dataFilterService as any,
      cacheService as any,
      configService as any,
    );
  });

  afterEach(() => {
    delete process.env.WEBHOOK_BASE_URL;
    jest.clearAllMocks();
  });

  it('validates PAT scopes with accepted scope alternatives', async () => {
    octokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: 'dev' },
      headers: {
        'x-oauth-scopes': 'repo, admin:org, admin:repo_hook',
      },
    });

    await expect(service.validatePAT('token')).resolves.toEqual({
      valid: true,
      scopes: ['repo', 'admin:org', 'admin:repo_hook'],
    });
    expect(Octokit).toHaveBeenCalledWith({
      auth: 'token',
      userAgent: 'SQDIS/1.0',
    });
  });

  it('returns invalid PAT validation when required scopes are missing or GitHub rejects the request', async () => {
    octokit.rest.users.getAuthenticated.mockResolvedValueOnce({
      data: { login: 'dev' },
      headers: { 'x-oauth-scopes': 'repo' },
    });

    await expect(service.validatePAT('token')).resolves.toEqual({
      valid: false,
      scopes: ['repo'],
    });

    octokit.rest.users.getAuthenticated.mockRejectedValueOnce(new Error('bad token'));
    await expect(service.validatePAT('bad-token')).resolves.toEqual({
      valid: false,
      scopes: [],
    });
  });

  it('connects a new GitHub account and updates an existing one with encrypted PAT', async () => {
    jest.spyOn(service, 'validatePAT').mockResolvedValue({
      valid: true,
      scopes: ['repo', 'read:org', 'admin:repo_hook'],
    });
    prisma.gitHubConnection.findUnique.mockResolvedValueOnce(null);
    prisma.gitHubConnection.create.mockResolvedValueOnce({
      ...connection,
      scopes: ['repo', 'read:org', 'admin:repo_hook'],
    });

    await expect(service.connectAccount('org-1', 'token')).resolves.toMatchObject({
      id: 'conn-1',
      organizationId: 'org-1',
      scopes: ['repo', 'read:org', 'admin:repo_hook'],
    });
    expect(encryptionService.encrypt).toHaveBeenCalledWith('token');
    expect(prisma.gitHubConnection.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        encryptedPAT: 'encrypted:token',
        scopes: ['repo', 'read:org', 'admin:repo_hook'],
      },
    });

    prisma.gitHubConnection.findUnique.mockResolvedValueOnce(connection);
    prisma.gitHubConnection.update.mockResolvedValueOnce(connection);
    await service.connectAccount('org-1', 'new-token');
    expect(prisma.gitHubConnection.update).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      data: {
        encryptedPAT: 'encrypted:new-token',
        scopes: ['repo', 'read:org', 'admin:repo_hook'],
        connectedAt: expect.any(Date),
      },
    });
  });

  it('rejects connect when PAT validation fails', async () => {
    jest.spyOn(service, 'validatePAT').mockResolvedValue({ valid: false, scopes: [] });

    await expect(service.connectAccount('org-1', 'bad-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.gitHubConnection.create).not.toHaveBeenCalled();
  });

  it('returns connection status for connected and disconnected organizations', async () => {
    prisma.gitHubConnection.findUnique.mockResolvedValueOnce(null);
    await expect(service.getConnectionStatus('org-1')).resolves.toEqual({
      isConnected: false,
      scopes: [],
      connectedAt: null,
      enabledRepositoriesCount: 0,
    });

    prisma.gitHubConnection.findUnique.mockResolvedValueOnce(connection);
    prisma.repository.count.mockResolvedValueOnce(3);

    await expect(service.getConnectionStatus('org-1')).resolves.toEqual({
      isConnected: true,
      scopes: connection.scopes,
      connectedAt: connection.connectedAt,
      enabledRepositoriesCount: 3,
    });
  });

  it('lists GitHub repositories and merges enabled state from the database', async () => {
    prisma.gitHubConnection.findUnique.mockResolvedValue(connection);
    octokit.paginate.mockResolvedValue([
      { id: 123, name: 'api', full_name: 'acme/api' },
      { id: 456, name: 'web', full_name: 'acme/web' },
    ]);
    prisma.repository.findMany.mockResolvedValue([repository]);

    await expect(service.listRepositories('org-1')).resolves.toEqual([
      {
        id: 'repo-1',
        githubId: 123,
        name: 'api',
        fullName: 'acme/api',
        isEnabled: true,
        lastSyncAt: null,
      },
      {
        id: '',
        githubId: 456,
        name: 'web',
        fullName: 'acme/web',
        isEnabled: false,
        lastSyncAt: null,
      },
    ]);
  });

  it('updates webhook enabled state and clears repository secret cache', async () => {
    prisma.repository.findFirst.mockResolvedValue(repository);
    prisma.repository.update.mockResolvedValue({ ...repository, isEnabled: false });

    await expect(service.updateWebhookEnabled('org-1', 'repo-1', false)).resolves.toEqual({
      id: 'repo-1',
      name: 'api',
      fullName: 'acme/api',
      isEnabled: false,
      message: 'Webhook processing disabled successfully',
    });
    expect(cacheService.delete).toHaveBeenCalledWith('github:repository:secret:123');
  });

  it('updates webhook secret in the database and ignores GitHub webhook update failures', async () => {
    prisma.repository.findFirst.mockResolvedValue(repository);
    prisma.repository.update.mockResolvedValue({ ...repository, webhookSecret: 'new-secret' });
    prisma.gitHubConnection.findUnique.mockResolvedValue(connection);
    octokit.rest.repos.updateWebhook.mockRejectedValue(new Error('GitHub unavailable'));

    await expect(service.updateWebhookSecret('org-1', 'repo-1', 'new-secret')).resolves.toEqual({
      id: 'repo-1',
      name: 'api',
      fullName: 'acme/api',
      message: 'Webhook secret updated successfully',
    });
    expect(prisma.repository.update).toHaveBeenCalledWith({
      where: { id: 'repo-1' },
      data: { webhookSecret: 'new-secret' },
    });
    expect(cacheService.delete).toHaveBeenCalledWith('github:repository:secret:123');
  });

  it('configures webhooks by updating an existing matching hook or creating a new one', async () => {
    process.env.WEBHOOK_BASE_URL = 'https://hooks.example.com';
    octokit.rest.repos.listWebhooks.mockResolvedValueOnce({
      data: [{ id: 55, config: { url: 'https://hooks.example.com/api/github/webhook' } }],
    });

    await expect(service.configureWebhook(octokit, 'acme/api', 'secret')).resolves.toBe(55);
    expect(octokit.rest.repos.updateWebhook).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'api',
      hook_id: 55,
      active: true,
      events: ['push', 'pull_request', 'pull_request_review', 'pull_request_review_comment'],
      config: {
        url: 'https://hooks.example.com/api/github/webhook',
        content_type: 'json',
        secret: 'secret',
        insecure_ssl: '0',
      },
    });

    octokit.rest.repos.listWebhooks.mockResolvedValueOnce({ data: [] });
    octokit.rest.repos.createWebhook.mockResolvedValueOnce({ data: { id: 77 } });

    await expect(service.configureWebhook(octokit, 'acme/api', 'secret')).resolves.toBe(77);
  });

  it('maps webhook configuration errors to client or server exceptions', async () => {
    octokit.rest.repos.listWebhooks.mockRejectedValueOnce({ status: 422, message: 'exists' });
    await expect(service.configureWebhook(octokit, 'acme/api', 'secret')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    octokit.rest.repos.listWebhooks.mockRejectedValueOnce({ status: 500, message: 'boom' });
    await expect(service.configureWebhook(octokit, 'acme/api', 'secret')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('filters repositories by organization and user role', async () => {
    dataFilterService.createRepositoryFilter.mockResolvedValue({
      organizationId: 'org-1',
      teamId: 'team-1',
    });
    prisma.repository.findMany.mockResolvedValue([repository]);

    await expect(service.getRepositoriesByOrganization('org-1', 'user-1', Role.TEAM_LEAD)).resolves.toEqual([
      repository,
    ]);
    expect(prisma.repository.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        teamId: 'team-1',
      },
      select: {
        id: true,
        organizationId: true,
        githubId: true,
        name: true,
        fullName: true,
        isEnabled: true,
        lastSyncAt: true,
      },
    });
  });

  it('throws not found for repository operations when repository is missing', async () => {
    prisma.repository.findFirst.mockResolvedValue(null);

    await expect(service.updateWebhookEnabled('org-1', 'missing', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.updateWebhookSecret('org-1', 'missing', 'secret')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.testWebhookConnectivity('org-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('OAuth 2.0 Flow', () => {
    it('generates a valid GitHub authorization URL with signed state', () => {
      const result = service.generateOAuthAuthorizeUrl('org-1', 'user-1');

      expect(result).toHaveProperty('url');
      const parsedUrl = new URL(result.url);

      expect(parsedUrl.origin).toBe('https://github.com');
      expect(parsedUrl.pathname).toBe('/login/oauth/authorize');
      expect(parsedUrl.searchParams.get('client_id')).toBe('mock-client-id');
      expect(parsedUrl.searchParams.get('scope')).toBe('repo,read:org,admin:repo_hook');
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/github/callback');

      const state = parsedUrl.searchParams.get('state');
      expect(state).toBeDefined();
      expect(state).toContain('.');

      // Verify the state with service
      const verified = service.verifyOAuthState(state!);
      expect(verified).toEqual({
        organizationId: 'org-1',
        userId: 'user-1',
      });
    });

    it('throws InternalServerErrorException if GITHUB_CLIENT_ID is missing', () => {
      configService.get.mockReturnValueOnce(null);

      expect(() => service.generateOAuthAuthorizeUrl('org-1', 'user-1')).toThrow(
        InternalServerErrorException,
      );
    });

    it('rejects tampered OAuth state parameter', () => {
      const result = service.generateOAuthAuthorizeUrl('org-1', 'user-1');
      const parsedUrl = new URL(result.url);
      const state = parsedUrl.searchParams.get('state')!;
      const [payload] = state.split('.');
      const tamperedState = `${payload}.invalid-signature`;

      expect(() => service.verifyOAuthState(tamperedState)).toThrow(BadRequestException);
    });

    it('rejects expired OAuth state parameter', () => {
      const secret = 'test-jwt-secret';
      const expiredPayload = {
        organizationId: 'org-1',
        userId: 'user-1',
        timestamp: Date.now() - 15 * 60 * 1000, // 15 mins ago (TTL is 10 mins)
        nonce: 'expired-nonce',
      };
      const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const crypto = require('crypto');
      const sig = crypto.createHmac('sha256', secret).update(encoded).digest('hex');
      const expiredState = `${encoded}.${sig}`;

      expect(() => service.verifyOAuthState(expiredState)).toThrow(BadRequestException);
    });

    it('successfully handles OAuth callback and connects account', async () => {
      const authUrlResult = service.generateOAuthAuthorizeUrl('org-1', 'user-1');
      const state = new URL(authUrlResult.url).searchParams.get('state')!;

      // Mock configService for client credentials
      configService.get.mockImplementation((key: string) => {
        if (key === 'GITHUB_CLIENT_ID') return 'mock-client-id';
        if (key === 'GITHUB_CLIENT_SECRET') return 'mock-client-secret';
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        return null;
      });

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          access_token: 'gho_test_access_token',
          scope: 'repo,admin:org,admin:repo_hook',
          token_type: 'bearer',
        }),
      } as any);

      // Mock validatePAT and connectAccount dependencies
      octokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'octocat' },
        headers: {
          'x-oauth-scopes': 'repo, admin:org, admin:repo_hook',
        },
      });

      prisma.gitHubConnection.findUnique.mockResolvedValue(null);
      prisma.gitHubConnection.create.mockResolvedValue({
        id: 'new-conn-id',
        organizationId: 'org-1',
        encryptedPAT: 'encrypted:gho_test_access_token',
        scopes: ['repo', 'admin:org', 'admin:repo_hook'],
        connectedAt: new Date(),
      });

      const response = await service.handleOAuthCallback('valid-code', state);

      expect(response).toEqual(
        expect.objectContaining({
          id: 'new-conn-id',
          organizationId: 'org-1',
          scopes: expect.arrayContaining(['repo', 'admin:org', 'admin:repo_hook']),
        }),
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }),
      );

      global.fetch = originalFetch;
    });

    it('throws BadRequestException if GitHub returns OAuth error', async () => {
      const authUrlResult = service.generateOAuthAuthorizeUrl('org-1', 'user-1');
      const state = new URL(authUrlResult.url).searchParams.get('state')!;

      configService.get.mockImplementation((key: string) => {
        if (key === 'GITHUB_CLIENT_ID') return 'mock-client-id';
        if (key === 'GITHUB_CLIENT_SECRET') return 'mock-client-secret';
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        return null;
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        }),
      } as any);

      await expect(service.handleOAuthCallback('invalid-code', state)).rejects.toThrow(
        BadRequestException,
      );

      global.fetch = originalFetch;
    });
  });
});

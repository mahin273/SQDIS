import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, NotificationType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { EmailThrottlerGuard } from '../src/modules/auth/guards/email-throttler.guard';
import { GitHubAuthGuard } from '../src/modules/auth/guards/github-auth.guard';
import { GoogleAuthGuard } from '../src/modules/auth/guards/google-auth.guard';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../src/modules/auth/guards/organization.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { GitHubController } from '../src/modules/github/github.controller';
import { GitHubService } from '../src/modules/github/github.service';
import { BackfillService } from '../src/modules/github/services/backfill.service';
import { RateLimitService } from '../src/modules/github/services/rate-limit.service';
import { WebhookLogService } from '../src/modules/github/services/webhook-log.service';
import { WebhookMonitoringService } from '../src/modules/github/services/webhook-monitoring.service';
import { WebhookService } from '../src/modules/github/services/webhook.service';
import { MetricsController } from '../src/modules/metrics/metrics.controller';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import { NotificationsController } from '../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { ProjectsController } from '../src/modules/projects/projects.controller';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { WebSocketGateway } from '../src/modules/websocket/websocket.gateway';

const authUser = {
  id: 'user-1',
  email: 'dev@example.com',
  name: 'Dev User',
  organizationId: 'org-1',
  role: Role.ADMIN,
};

class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = authUser;
    return true;
  }
}

class AllowGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

async function initApp(
  controllers: any[],
  providers: any[],
  options: { validation?: boolean } = {},
): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({
    controllers,
    providers,
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(TestJwtAuthGuard)
    .overrideGuard(RolesGuard)
    .useClass(AllowGuard)
    .overrideGuard(OrganizationGuard)
    .useClass(AllowGuard)
    .overrideGuard(EmailThrottlerGuard)
    .useClass(AllowGuard)
    .overrideGuard(GoogleAuthGuard)
    .useClass(AllowGuard)
    .overrideGuard(GitHubAuthGuard)
    .useClass(AllowGuard);

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  if (options.validation) {
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
  }
  await app.init();
  return app as INestApplication<App>;
}

describe('Auth API integration', () => {
  let app: INestApplication<App>;
  let authService: Record<string, jest.Mock>;

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user-1', email: 'dev@example.com', name: 'Dev User' },
      }),
      login: jest.fn().mockResolvedValue({
        accessToken: 'login-token',
        refreshToken: 'refresh-token',
        user: { id: 'user-1', email: 'dev@example.com', name: 'Dev User' },
      }),
      refreshToken: jest.fn().mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        user: { id: 'user-1', email: 'dev@example.com', name: 'Dev User' },
      }),
      logout: jest.fn().mockResolvedValue(undefined),
      forgotPassword: jest.fn().mockResolvedValue({ message: 'Password reset email sent' }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'Password reset successfully' }),
      getCurrentUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'dev@example.com',
        name: 'Dev User',
      }),
      getUserOrganizations: jest.fn().mockResolvedValue([{ id: 'org-1', name: 'SQDIS' }]),
      switchOrganization: jest.fn().mockResolvedValue({
        accessToken: 'org-token',
        refreshToken: 'org-refresh',
        user: { id: 'user-1', email: 'dev@example.com', name: 'Dev User' },
      }),
    };

    app = await initApp([AuthController], [{ provide: AuthService, useValue: authService }]);
  });

  afterEach(async () => {
    await app?.close();
  });

  it('registers, logs in, refreshes, and logs out through HTTP routes', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dev@example.com', password: 'Secret123!', name: 'Dev User' })
      .expect(201)
      .expect(({ body }) => expect(body.accessToken).toBe('access-token'));

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '203.0.113.1, 10.0.0.1')
      .send({ email: 'dev@example.com', password: 'Secret123!' })
      .expect(200)
      .expect(({ body }) => expect(body.accessToken).toBe('login-token'));

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(200)
      .expect(({ body }) => expect(body.accessToken).toBe('new-token'));

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: 'refresh-token' })
      .expect(200)
      .expect({ message: 'Logout successful' });

    expect(authService.register).toHaveBeenCalled();
    expect(authService.login).toHaveBeenCalledWith({
      email: 'dev@example.com',
      password: 'Secret123!',
    });
    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
  });

  it('returns authenticated user and organization context routes', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.email).toBe('dev@example.com'));

    await request(app.getHttpServer())
      .get('/auth/organizations')
      .expect(200)
      .expect(({ body }) => expect(body).toEqual([{ id: 'org-1', name: 'SQDIS' }]));

    await request(app.getHttpServer())
      .post('/auth/switch-organization')
      .send({ organizationId: 'org-1' })
      .expect(200)
      .expect(({ body }) => expect(body.accessToken).toBe('org-token'));
  });
});

describe('Notifications API integration', () => {
  let app: INestApplication<App>;
  let notificationsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    notificationsService = {
      findAll: jest.fn().mockResolvedValue({
        data: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Build passed' }],
        meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
      }),
      getUnreadCount: jest.fn().mockResolvedValue({ count: 3 }),
      findOne: jest.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' }),
      markAsRead: jest.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', isRead: true }),
      markAllAsRead: jest.fn().mockResolvedValue({ count: 3 }),
      delete: jest.fn().mockResolvedValue({ deleted: true }),
    };

    app = await initApp(
      [NotificationsController],
      [{ provide: NotificationsService, useValue: notificationsService }],
      { validation: true },
    );
  });

  afterEach(async () => {
    await app?.close();
  });

  it('lists notifications with transformed query filters', async () => {
    await request(app.getHttpServer())
      .get('/notifications')
      .query({ page: '2', limit: '5', isRead: 'true', type: NotificationType.ALERT })
      .expect(200)
      .expect(({ body }) => expect(body.meta).toEqual({ total: 1, page: 2, limit: 5, totalPages: 1 }));

    expect(notificationsService.findAll).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      expect.objectContaining({
        page: 2,
        limit: 5,
        isRead: true,
        type: NotificationType.ALERT,
      }),
    );
  });

  it('routes notification commands and rejects invalid UUID params', async () => {
    const id = '11111111-1111-4111-8111-111111111111';

    await request(app.getHttpServer()).get('/notifications/unread-count').expect(200, { count: 3 });
    await request(app.getHttpServer()).get(`/notifications/${id}`).expect(200);
    await request(app.getHttpServer()).patch(`/notifications/${id}/read`).expect(200);
    await request(app.getHttpServer()).post('/notifications/read-all').expect(201, { count: 3 });
    await request(app.getHttpServer()).delete(`/notifications/${id}`).expect(200, { deleted: true });
    await request(app.getHttpServer()).get('/notifications/not-a-uuid').expect(400);
  });
});

describe('Projects API integration', () => {
  let app: INestApplication<App>;
  let projectsService: Record<string, jest.Mock>;
  let organizationsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    projectsService = {
      create: jest.fn().mockResolvedValue({ id: 'project-1', name: 'API' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'project-1', name: 'API' }]),
      verifyProjectAccess: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ id: 'project-1', name: 'API' }),
      getProjectMetrics: jest.fn().mockResolvedValue({ totalCommits: 4 }),
      getTechnicalDebt: jest.fn().mockResolvedValue([{ id: 'debt-1' }]),
      update: jest.fn().mockResolvedValue({ id: 'project-1', name: 'API v2' }),
      delete: jest.fn().mockResolvedValue(undefined),
      assignRepository: jest.fn().mockResolvedValue({ projectId: 'project-1', repositoryId: 'repo-1' }),
      removeRepository: jest.fn().mockResolvedValue(undefined),
      assignTeam: jest.fn().mockResolvedValue({ projectId: 'project-1', teamId: 'team-1' }),
      removeTeam: jest.fn().mockResolvedValue(undefined),
    };
    organizationsService = {
      isUserMember: jest.fn().mockResolvedValue(true),
    };

    app = await initApp(
      [ProjectsController],
      [
        { provide: ProjectsService, useValue: projectsService },
        { provide: OrganizationsService, useValue: organizationsService },
      ],
    );
  });

  afterEach(async () => {
    await app?.close();
  });

  it('uses x-organization-id for project collection routes', async () => {
    await request(app.getHttpServer())
      .post('/projects')
      .set('x-organization-id', 'org-1')
      .send({ name: 'API', description: 'Core API' })
      .expect(201)
      .expect({ id: 'project-1', name: 'API' });

    await request(app.getHttpServer())
      .get('/projects')
      .set('x-organization-id', 'org-1')
      .expect(200)
      .expect([{ id: 'project-1', name: 'API' }]);

    expect(projectsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'API' }),
      'org-1',
    );
    expect(projectsService.findAll).toHaveBeenCalledWith('org-1', 'user-1', Role.ADMIN);
  });

  it('verifies project access before resource and relationship routes', async () => {
    await request(app.getHttpServer()).get('/projects/project-1').set('x-organization-id', 'org-1').expect(200);
    await request(app.getHttpServer()).get('/projects/project-1/metrics').set('x-organization-id', 'org-1').expect(200);
    await request(app.getHttpServer()).get('/projects/project-1/debt').set('x-organization-id', 'org-1').expect(200);
    await request(app.getHttpServer())
      .patch('/projects/project-1')
      .set('x-organization-id', 'org-1')
      .send({ name: 'API v2' })
      .expect(200);
    await request(app.getHttpServer()).delete('/projects/project-1').set('x-organization-id', 'org-1').expect(204);
    await request(app.getHttpServer())
      .post('/projects/project-1/repositories')
      .set('x-organization-id', 'org-1')
      .send({ repositoryId: 'repo-1' })
      .expect(201);
    await request(app.getHttpServer())
      .delete('/projects/project-1/repositories/repo-1')
      .set('x-organization-id', 'org-1')
      .expect(204);
    await request(app.getHttpServer())
      .post('/projects/project-1/teams')
      .set('x-organization-id', 'org-1')
      .send({ teamId: 'team-1' })
      .expect(201);
    await request(app.getHttpServer())
      .delete('/projects/project-1/teams/team-1')
      .set('x-organization-id', 'org-1')
      .expect(204);

    expect(projectsService.verifyProjectAccess).toHaveBeenCalledWith('project-1', 'org-1');
    expect(projectsService.assignRepository).toHaveBeenCalledWith('project-1', 'repo-1', 'org-1');
    expect(projectsService.assignTeam).toHaveBeenCalledWith('project-1', 'team-1', 'org-1');
  });
});

describe('GitHub and metrics API integration', () => {
  let app: INestApplication<App>;
  let githubService: Record<string, jest.Mock>;
  let webhookService: Record<string, jest.Mock>;
  let backfillService: Record<string, jest.Mock>;
  let rateLimitService: Record<string, jest.Mock>;
  let webhookLogService: Record<string, jest.Mock>;
  let webhookMonitoringService: Record<string, jest.Mock>;
  let wsGateway: Record<string, jest.Mock>;

  beforeEach(async () => {
    githubService = {
      validatePAT: jest.fn().mockResolvedValue({ valid: true }),
      connectAccount: jest.fn().mockResolvedValue({ connected: true }),
      disconnectAccount: jest.fn().mockResolvedValue(undefined),
      listRepositories: jest.fn().mockResolvedValue([{ id: 'repo-1' }]),
      enableRepository: jest.fn().mockResolvedValue({ id: 'repo-1', isEnabled: true }),
      disableRepository: jest.fn().mockResolvedValue(undefined),
      updateWebhookSecret: jest.fn().mockResolvedValue({ id: 'repo-1', message: 'updated' }),
      updateWebhookEnabled: jest.fn().mockResolvedValue({ id: 'repo-1', isEnabled: true }),
      getConnectionStatus: jest.fn().mockResolvedValue({ connected: true }),
      updateAllWebhooks: jest.fn().mockResolvedValue({ refreshed: 2 }),
      testWebhookConnectivity: jest.fn().mockResolvedValue({ success: true }),
      getRepository: jest.fn().mockResolvedValue({ id: 'repo-1', organizationId: 'org-1' }),
      getRepositoriesByOrganization: jest.fn().mockResolvedValue([{ id: 'repo-1' }]),
    };
    webhookService = {
      processWebhook: jest.fn().mockResolvedValue({ success: true, commitsQueued: 1 }),
      retryWebhookDelivery: jest.fn().mockResolvedValue({ success: true }),
    };
    backfillService = {
      backfillRepository: jest.fn().mockResolvedValue({ commitsQueued: 2 }),
      getBackfillStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
    };
    rateLimitService = {
      updateRateLimitConfig: jest.fn().mockResolvedValue(undefined),
      getRateLimitConfig: jest.fn().mockResolvedValue({ requestsPerMinute: 120, enabled: true }),
    };
    webhookLogService = {
      queryLogs: jest.fn().mockResolvedValue([
        { id: 'log-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      ]),
    };
    webhookMonitoringService = {
      getOrganizationMetrics: jest.fn().mockResolvedValue([{ repositoryId: 'repo-1' }]),
    };
    wsGateway = {
      emitTestCommitEvent: jest.fn().mockReturnValue({ emitted: true }),
    };

    app = await initApp(
      [GitHubController, MetricsController],
      [
        { provide: GitHubService, useValue: githubService },
        { provide: WebhookService, useValue: webhookService },
        { provide: BackfillService, useValue: backfillService },
        { provide: WebSocketGateway, useValue: wsGateway },
        { provide: WebhookLogService, useValue: webhookLogService },
        { provide: WebhookMonitoringService, useValue: webhookMonitoringService },
        { provide: RateLimitService, useValue: rateLimitService },
        {
          provide: MetricsService,
          useValue: {
            getMetrics: jest.fn().mockResolvedValue('# HELP sqdis_test_metric test\n'),
            getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
          },
        },
      ],
      { validation: true },
    );
  });

  afterEach(async () => {
    await app?.close();
  });

  it('processes public GitHub webhooks and forwards required headers', async () => {
    await request(app.getHttpServer())
      .post('/github/webhook')
      .set('x-hub-signature-256', 'sha256=abc')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-1')
      .send({ repository: { full_name: 'acme/api' } })
      .expect(200)
      .expect({ success: true, commitsQueued: 1 });

    expect(webhookService.processWebhook).toHaveBeenCalledWith(
      JSON.stringify({ repository: { full_name: 'acme/api' } }),
      'sha256=abc',
      'push',
      'delivery-1',
    );
  });

  it('sets Retry-After when webhook processing is rate limited', async () => {
    webhookService.processWebhook.mockRejectedValueOnce(
      new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: 30,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await request(app.getHttpServer())
      .post('/github/webhook')
      .set('x-hub-signature-256', 'sha256=abc')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-2')
      .send({ ok: true })
      .expect(429)
      .expect('Retry-After', '30');
  });

  it('requires organization context for protected GitHub routes', async () => {
    const previousOrganizationId = authUser.organizationId;
    delete (authUser as { organizationId?: string }).organizationId;

    try {
      await request(app.getHttpServer())
        .post('/github/connect')
        .send({ pat: 'ghp_1234567890123456789012345678901234567890' })
        .expect(403);
    } finally {
      authUser.organizationId = previousOrganizationId;
    }
  });

  it('delegates protected GitHub routes with organization header', async () => {
    await request(app.getHttpServer()).post('/github/validate').send({ pat: 'ghp_1234567890123456789012345678901234567890' }).expect(201);
    await request(app.getHttpServer()).post('/github/connect').set('x-organization-id', 'org-1').send({ pat: 'ghp_1234567890123456789012345678901234567890' }).expect(201);
    await request(app.getHttpServer()).get('/github/repositories').set('x-organization-id', 'org-1').expect(200);
    await request(app.getHttpServer()).post('/github/repositories/repo-1/enable').set('x-organization-id', 'org-1').send({ githubId: 123, name: 'api', fullName: 'acme/api' }).expect(201);
    await request(app.getHttpServer()).put('/github/repositories/repo-1/webhook-secret').set('x-organization-id', 'org-1').send({ webhookSecret: 'secret_123456' }).expect(200);
    await request(app.getHttpServer()).put('/github/webhooks/rate-limit').set('x-organization-id', 'org-1').send({ requestsPerMinute: 120, enabled: true }).expect(200);
    await request(app.getHttpServer()).get('/github/webhooks/health?period=24h').set('x-organization-id', 'org-1').expect(200);

    expect(githubService.connectAccount).toHaveBeenCalledWith('org-1', expect.stringMatching(/^ghp_/));
    expect(githubService.enableRepository).toHaveBeenCalledWith(
      'org-1',
      'repo-1',
      expect.objectContaining({ githubId: 123, fullName: 'acme/api' }),
    );
    expect(rateLimitService.updateRateLimitConfig).toHaveBeenCalledWith('org-1', {
      requestsPerMinute: 120,
      enabled: true,
    });
    expect(webhookMonitoringService.getOrganizationMetrics).toHaveBeenCalledWith('org-1', '24h');
  });

  it('serves Prometheus metrics with the service content type', async () => {
    await request(app.getHttpServer())
      .get('/metrics')
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect(({ text }) => expect(text).toContain('sqdis_test_metric'));
  });
});

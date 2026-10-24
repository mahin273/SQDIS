import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../src/modules/auth/guards/organization.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { PermissionCacheService } from '../src/modules/auth/services/permission-cache.service';
import { AuditLogService } from '../src/modules/audit/services/audit-log.service';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { GitHubController } from '../src/modules/github/github.controller';
import { GitHubService } from '../src/modules/github/github.service';
import { WebhookService } from '../src/modules/github/services/webhook.service';
import { BackfillService } from '../src/modules/github/services/backfill.service';
import { WebhookLogService } from '../src/modules/github/services/webhook-log.service';
import { WebhookMonitoringService } from '../src/modules/github/services/webhook-monitoring.service';
import { RateLimitService } from '../src/modules/github/services/rate-limit.service';
import { PrQualityGateBotService } from '../src/modules/github/services/pr-quality-gate-bot.service';
import { WebSocketGateway } from '../src/modules/websocket/websocket.gateway';
import { ScoresController } from '../src/modules/scores/scores.controller';
import { ScoresService } from '../src/modules/scores/scores.service';
import { AuditLogController } from '../src/modules/audit/audit-log.controller';
import { EnhancedAuditLogService } from '../src/modules/audit/services/enhanced-audit-log.service';
import { AuditExportService } from '../src/modules/audit/services/audit-export.service';
import { AuditRetentionService } from '../src/modules/audit/services/audit-retention.service';
import { AuditAnalyticsService } from '../src/modules/audit/services/audit-analytics.service';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import { LeaderboardService } from '../src/modules/reports/services/leaderboard.service';
import { FileStorageService } from '../src/modules/reports/services/file-storage.service';
import { PrismaService } from '../src/prisma';

describe('RBAC Stakeholder Role Matrix & Tenant Isolation (e2e)', () => {
  let app: INestApplication<App>;
  let currentAuthUser: {
    id: string;
    email: string;
    role: Role;
    organizationId: string;
  };

  class DynamicJwtAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      req.user = currentAuthUser;
      return true;
    }
  }

  class DynamicOrgGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      req.organizationId = currentAuthUser.organizationId;
      return true;
    }
  }

  let organizationsServiceMock: Record<string, jest.Mock>;
  let githubServiceMock: Record<string, jest.Mock>;
  let scoresServiceMock: Record<string, jest.Mock>;
  let enhancedAuditLogServiceMock: Record<string, jest.Mock>;
  let reportsServiceMock: Record<string, jest.Mock>;
  let prismaServiceMock: Record<string, any>;

  beforeAll(async () => {
    organizationsServiceMock = {
      findAllForUser: jest.fn().mockResolvedValue([{ id: 'org-1' }]),
      verifyUserRole: jest.fn(),
      removeMember: jest.fn(),
      createRemovalRequest: jest.fn(),
      getRemovalRequests: jest.fn(),
      approveRemovalRequest: jest.fn(),
      rejectRemovalRequest: jest.fn(),
      cancelRemovalRequest: jest.fn(),
    };

    githubServiceMock = {
      validatePAT: jest.fn().mockResolvedValue({ valid: true, user: 'octocat' }),
      getOAuthAuthorizationUrl: jest.fn().mockReturnValue('https://github.com/login/oauth/authorize'),
      getConnectionStatus: jest.fn().mockResolvedValue({ connected: true }),
    };

    scoresServiceMock = {
      getSQS: jest.fn(),
      getDQS: jest.fn(),
      triggerRecalculation: jest.fn().mockResolvedValue({ success: true }),
    };

    enhancedAuditLogServiceMock = {
      queryLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };

    reportsServiceMock = {
      createReport: jest.fn().mockResolvedValue({ id: 'report-1', status: 'PENDING' }),
      findAll: jest.fn().mockResolvedValue({ reports: [], total: 0 }),
      findById: jest.fn().mockResolvedValue({ id: 'report-1', status: 'COMPLETED' }),
    };

    prismaServiceMock = {
      organizationMember: {
        findFirst: jest.fn().mockImplementation(async () => ({
          organizationId: currentAuthUser?.organizationId || 'org-1',
        })),
        findUnique: jest.fn().mockImplementation(async () => ({
          role: currentAuthUser?.role || Role.DEVELOPER,
          organizationId: currentAuthUser?.organizationId || 'org-1',
        })),
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [
        OrganizationsController,
        GitHubController,
        ScoresController,
        AuditLogController,
        ReportsController,
      ],
      providers: [
        Reflector,
        RolesGuard,
        {
          provide: PermissionCacheService,
          useValue: {
            getCachedPermission: jest.fn().mockResolvedValue(null),
            setCachedPermission: jest.fn().mockResolvedValue(undefined),
            invalidateUserPermissions: jest.fn().mockResolvedValue(undefined),
            invalidateOrganizationPermissions: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logPermissionCheck: jest.fn(),
            logAction: jest.fn(),
          },
        },
        { provide: OrganizationsService, useValue: organizationsServiceMock },
        { provide: GitHubService, useValue: githubServiceMock },
        { provide: WebhookService, useValue: {} },
        { provide: BackfillService, useValue: {} },
        { provide: WebSocketGateway, useValue: {} },
        { provide: WebhookLogService, useValue: {} },
        { provide: WebhookMonitoringService, useValue: {} },
        { provide: RateLimitService, useValue: {} },
        { provide: PrQualityGateBotService, useValue: {} },
        { provide: ScoresService, useValue: scoresServiceMock },
        { provide: EnhancedAuditLogService, useValue: enhancedAuditLogServiceMock },
        { provide: AuditExportService, useValue: {} },
        { provide: AuditRetentionService, useValue: {} },
        { provide: AuditAnalyticsService, useValue: {} },
        { provide: ReportsService, useValue: reportsServiceMock },
        { provide: LeaderboardService, useValue: {} },
        { provide: FileStorageService, useValue: {} },
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(DynamicJwtAuthGuard)
      .overrideGuard(OrganizationGuard)
      .useClass(DynamicOrgGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('1. Member Removal Workflow & Owner/Admin Boundary', () => {
    it('Admin removing a developer returns 202 Accepted and creates pending removal request', async () => {
      currentAuthUser = {
        id: 'admin-1',
        email: 'admin@acme.com',
        role: Role.ADMIN,
        organizationId: 'org-1',
      };

      organizationsServiceMock.removeMember.mockResolvedValueOnce({
        status: 'PENDING_APPROVAL',
        requestId: 'req-123',
        message: 'Removal request submitted for Owner approval',
      });

      const res = await request(app.getHttpServer())
        .delete('/organizations/members/dev-target-1')
        .expect(202);

      expect(res.body).toEqual({
        status: 'PENDING_APPROVAL',
        requestId: 'req-123',
        message: 'Removal request submitted for Owner approval',
      });
      expect(organizationsServiceMock.removeMember).toHaveBeenCalledWith(
        'org-1',
        'dev-target-1',
        'admin-1',
      );
    });

    it('Admin attempting to remove an Owner or another Admin is rejected with 403 Forbidden', async () => {
      currentAuthUser = {
        id: 'admin-1',
        email: 'admin@acme.com',
        role: Role.ADMIN,
        organizationId: 'org-1',
      };

      organizationsServiceMock.removeMember.mockRejectedValueOnce(
        new ForbiddenException('Administrators cannot remove Organization Owners or other Administrators.'),
      );

      await request(app.getHttpServer())
        .delete('/organizations/members/admin-peer')
        .expect(403);
    });

    it('Owner direct member removal executes immediately and returns 204 No Content', async () => {
      currentAuthUser = {
        id: 'owner-1',
        email: 'owner@acme.com',
        role: Role.OWNER,
        organizationId: 'org-1',
      };

      organizationsServiceMock.removeMember.mockResolvedValueOnce({
        deleted: true,
      });

      await request(app.getHttpServer())
        .delete('/organizations/members/dev-target-1')
        .expect(204);
    });

    it('Owner can approve a member removal request', async () => {
      currentAuthUser = {
        id: 'owner-1',
        email: 'owner@acme.com',
        role: Role.OWNER,
        organizationId: 'org-1',
      };

      organizationsServiceMock.approveRemovalRequest.mockResolvedValueOnce({
        id: 'req-123',
        status: 'APPROVED',
      });

      await request(app.getHttpServer())
        .post('/organizations/removal-requests/req-123/approve')
        .send({ decisionReason: 'Approved as requested' })
        .expect(201);
    });

    it('Admin attempting to approve a removal request is rejected with 403 Forbidden', async () => {
      currentAuthUser = {
        id: 'admin-1',
        email: 'admin@acme.com',
        role: Role.ADMIN,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .post('/organizations/removal-requests/req-123/approve')
        .send({ decisionReason: 'Attempted self-approval' })
        .expect(403);
    });
  });

  describe('2. GitHub Connection Endpoints (Owner-Only Boundary)', () => {
    it('Owner can validate GitHub PAT', async () => {
      currentAuthUser = {
        id: 'owner-1',
        email: 'owner@acme.com',
        role: Role.OWNER,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .post('/github/validate')
        .send({ pat: 'ghp_123456789012345678901234567890123456' })
        .expect(201);
    });

    it('Admin is forbidden from validating GitHub PAT (403)', async () => {
      currentAuthUser = {
        id: 'admin-1',
        email: 'admin@acme.com',
        role: Role.ADMIN,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .post('/github/validate')
        .send({ pat: 'ghp_123456789012345678901234567890123456' })
        .expect(403);
    });

    it('Developer is forbidden from accessing GitHub connection endpoints (403)', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .post('/github/validate')
        .send({ pat: 'ghp_123456789012345678901234567890123456' })
        .expect(403);

      await request(app.getHttpServer())
        .get('/github/oauth/authorize')
        .expect(403);
    });
  });

  describe('3. Project SQS Access Scoping', () => {
    const assignedProjectId = '33333333-3333-4333-8333-333333333333';
    const unassignedProjectId = '44444444-4444-4444-8444-444444444444';

    it('Developer accessing an assigned project SQS succeeds', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      scoresServiceMock.getSQS.mockResolvedValueOnce({
        score: 88,
        projectId: assignedProjectId,
      });

      await request(app.getHttpServer())
        .get(`/scores/sqs/${assignedProjectId}`)
        .expect(200);

      expect(scoresServiceMock.getSQS).toHaveBeenCalledWith(
        assignedProjectId,
        'org-1',
        currentAuthUser,
      );
    });

    it('Developer accessing an unassigned project SQS is denied (403)', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      scoresServiceMock.getSQS.mockRejectedValueOnce(
        new ForbiddenException('Access denied: This project is not assigned to any of your active teams.'),
      );

      await request(app.getHttpServer())
        .get(`/scores/sqs/${unassignedProjectId}`)
        .expect(403);
    });

    it('Team Lead accessing an unassigned project SQS is denied (403)', async () => {
      currentAuthUser = {
        id: 'lead-1',
        email: 'lead@acme.com',
        role: Role.TEAM_LEAD,
        organizationId: 'org-1',
      };

      scoresServiceMock.getSQS.mockRejectedValueOnce(
        new ForbiddenException('Access denied: This project is not assigned to any of your active teams.'),
      );

      await request(app.getHttpServer())
        .get(`/scores/sqs/${unassignedProjectId}`)
        .expect(403);
    });

    it('Owner has access to all project SQS in organization', async () => {
      currentAuthUser = {
        id: 'owner-1',
        email: 'owner@acme.com',
        role: Role.OWNER,
        organizationId: 'org-1',
      };

      scoresServiceMock.getSQS.mockResolvedValueOnce({
        score: 92,
        projectId: assignedProjectId,
      });

      await request(app.getHttpServer())
        .get(`/scores/sqs/${assignedProjectId}`)
        .expect(200);
    });
  });

  describe('4. Developer Telemetry Privacy Scoping', () => {
    const validUuid1 = '11111111-1111-4111-8111-111111111111';
    const validUuid2 = '22222222-2222-4222-8222-222222222222';

    it('Developer can view their own DQS telemetry', async () => {
      currentAuthUser = {
        id: validUuid1,
        email: 'dev1@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      scoresServiceMock.getDQS.mockResolvedValueOnce({
        score: 85,
        developerId: validUuid1,
      });

      await request(app.getHttpServer())
        .get(`/scores/dqs/${validUuid1}`)
        .expect(200);
    });

    it('Developer is forbidden from viewing another developers DQS telemetry (403)', async () => {
      currentAuthUser = {
        id: validUuid1,
        email: 'dev1@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      scoresServiceMock.getDQS.mockRejectedValueOnce(
        new ForbiddenException('Access denied: Developers can only view their own DQS telemetry score.'),
      );

      await request(app.getHttpServer())
        .get(`/scores/dqs/${validUuid2}`)
        .expect(403);
    });

    it('Team Lead is forbidden from viewing a non-team members DQS telemetry (403)', async () => {
      currentAuthUser = {
        id: 'lead-1',
        email: 'lead@acme.com',
        role: Role.TEAM_LEAD,
        organizationId: 'org-1',
      };

      scoresServiceMock.getDQS.mockRejectedValueOnce(
        new ForbiddenException('Access denied: You can only view DQS scores for developers in squads you lead.'),
      );

      await request(app.getHttpServer())
        .get(`/scores/dqs/${validUuid2}`)
        .expect(403);
    });
  });

  describe('5. Audit Logs, Reports & Recalculate Policy Boundary', () => {
    it('Admin and Owner can query audit logs', async () => {
      currentAuthUser = {
        id: 'admin-1',
        email: 'admin@acme.com',
        role: Role.ADMIN,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .get('/audit-logs')
        .expect(200);

      currentAuthUser.role = Role.OWNER;
      await request(app.getHttpServer())
        .get('/audit-logs')
        .expect(200);
    });

    it('Developer and Team Lead are rejected from audit logs with 403', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .get('/audit-logs')
        .expect(403);

      currentAuthUser.role = Role.TEAM_LEAD;
      await request(app.getHttpServer())
        .get('/audit-logs')
        .expect(403);
    });

    it('Team Lead can create reports, but Developer is rejected with 403', async () => {
      currentAuthUser = {
        id: 'lead-1',
        email: 'lead@acme.com',
        role: Role.TEAM_LEAD,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .post('/reports')
        .send({
          title: 'Squad Quality Report',
          type: 'PDF',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
        })
        .expect(201);

      currentAuthUser.role = Role.DEVELOPER;
      await request(app.getHttpServer())
        .post('/reports')
        .send({
          title: 'Developer Report',
          type: 'PDF',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T00:00:00.000Z',
        })
        .expect(403);
    });

    it('Recalculate endpoint is allowed for Team Lead, Admin, Owner, but denied for Developer (403)', async () => {
      const validEntityId = '33333333-3333-4333-8333-333333333333';

      currentAuthUser = {
        id: 'lead-1',
        email: 'lead@acme.com',
        role: Role.TEAM_LEAD,
        organizationId: 'org-1',
      };

      await request(app.getHttpServer())
        .post('/scores/recalculate')
        .send({ entityId: validEntityId, type: 'sqs' })
        .expect(201);

      currentAuthUser.role = Role.DEVELOPER;
      await request(app.getHttpServer())
        .post('/scores/recalculate')
        .send({ entityId: validEntityId, type: 'sqs' })
        .expect(403);
    });
  });
});

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
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { CodeIntelligenceController } from '../src/modules/code-intelligence/code-intelligence.controller';
import { CodeIntelligenceService } from '../src/modules/code-intelligence/code-intelligence.service';
import { CodeRemediationService } from '../src/modules/code-intelligence/services/code-remediation.service';
import { CommitsController } from '../src/modules/commits/commits.controller';
import { CommitsService } from '../src/modules/commits/commits.service';
import { CoverageController } from '../src/modules/coverage/coverage.controller';
import { CoverageService } from '../src/modules/coverage/coverage.service';
import { ReviewsController } from '../src/modules/reviews/reviews.controller';
import { ReviewsService } from '../src/modules/reviews/reviews.service';
import { DataFilterService } from '../src/modules/auth/services/data-filter.service';
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
  let dashboardServiceMock: Record<string, jest.Mock>;
  let codeIntelligenceServiceMock: Record<string, jest.Mock>;
  let commitsServiceMock: Record<string, jest.Mock>;
  let coverageServiceMock: Record<string, jest.Mock>;
  let reviewsServiceMock: Record<string, jest.Mock>;
  let dataFilterServiceMock: Record<string, jest.Mock>;
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

    dashboardServiceMock = {
      getOrganizationStats: jest.fn().mockImplementation(async (orgId, user) => {
        if (user?.role === Role.DEVELOPER) {
          return { totalRepositories: 1, totalTeams: 1, totalDevelopers: 1, totalProjects: 1 };
        }
        return { totalRepositories: 10, totalTeams: 5, totalDevelopers: 20, totalProjects: 8 };
      }),
      getSQSTrend: jest.fn().mockResolvedValue([]),
      getCommitTrend: jest.fn().mockResolvedValue([]),
      getTopRepositories: jest.fn().mockResolvedValue([]),
      getBottomRepositories: jest.fn().mockResolvedValue([]),
      getTopDevelopers: jest.fn().mockResolvedValue([]),
      getTopTeams: jest.fn().mockResolvedValue([]),
      getRecentActivity: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getAlerts: jest.fn().mockResolvedValue([]),
    };

    codeIntelligenceServiceMock = {
      getRepositoryStats: jest.fn().mockImplementation(async (repoId, orgId, user) => {
        if (user?.role === Role.DEVELOPER && repoId === 'unassigned-repo') {
          throw new ForbiddenException('Access denied: This repository is not part of any project assigned to your active teams.');
        }
        return { analyzedFiles: 10, hotspots: { total: 0 } };
      }),
      calculateTeamBusFactor: jest.fn().mockImplementation(async (teamId, orgId, user) => {
        if (user?.role === Role.DEVELOPER && teamId === 'other-team') {
          throw new ForbiddenException('Access denied: You are not an active member or leader of this team.');
        }
        return { teamId, overall_bus_factor: 2 };
      }),
      getBusFactorSnapshots: jest.fn().mockResolvedValue([]),
      getRepositoryHotspots: jest.fn().mockResolvedValue([]),
      getRepositoryCommitsRisk: jest.fn().mockResolvedValue([]),
      getPullRequestTestImpact: jest.fn().mockResolvedValue({}),
      getRepositoryTreemap: jest.fn().mockImplementation(async (repoId, sizeBy, colorBy, orgId, user) => {
        if (user?.role === Role.DEVELOPER && repoId === 'unassigned-repo') {
          throw new ForbiddenException('Access denied: This repository is not part of any project assigned to your active teams.');
        }
        return { repositoryId: repoId, nodes: [] };
      }),
      predictCommitRisk: jest.fn().mockImplementation(async (dto, orgId) => {
        return { id: 'pred-1', defectProbability: 0.2, riskLevel: 'LOW' };
      }),
      analyzeTestImpact: jest.fn().mockImplementation(async (dto) => {
        return { impacted_tests_count: 1 };
      }),
      predictAstDefect: jest.fn().mockImplementation(async (dto, orgId) => {
        return { id: 'pred-ast-1', riskLevel: 'LOW' };
      }),
      getDefectHistory: jest.fn().mockImplementation(async (orgId, limit, user) => {
        if (user?.role === Role.DEVELOPER && user.id === 'dev-unassigned') {
          return [];
        }
        return [{ id: 'pred-1', repositoryId: 'repo-1', riskLevel: 'LOW' }];
      }),
      verifyRepositoryAccess: jest.fn().mockImplementation(async (repoId, orgId, user) => {
        return dataFilterServiceMock.verifyRepositoryAccess(repoId, orgId, user);
      }),
    };

    commitsServiceMock = {
      findAll: jest.fn().mockImplementation(async (filters, allowedRepoIds) => {
        if (allowedRepoIds && allowedRepoIds.length === 0) {
          return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
        }
        return { data: [{ id: 'commit-1' }], total: 1, page: 1, limit: 20, totalPages: 1 };
      }),
      getStatistics: jest.fn().mockResolvedValue({ totalCommits: 5 }),
      getHeatmapData: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'commit-1', repositoryId: 'repo-1', repository: { organizationId: 'org-1' } }),
    };

    coverageServiceMock = {
      uploadCoverage: jest.fn().mockResolvedValue({ id: 'cov-1', repositoryId: 'repo-1' }),
      findAll: jest.fn().mockImplementation(async (orgId, filters, allowedRepoIds) => {
        if (allowedRepoIds && allowedRepoIds.length === 0) {
          return { reports: [], total: 0, page: 1, limit: 20, totalPages: 0 };
        }
        return { reports: [{ id: 'cov-1', repositoryId: 'repo-1' }], total: 1, page: 1, limit: 20, totalPages: 1 };
      }),
      findById: jest.fn().mockImplementation(async (id, orgId, user) => {
        if (user?.role === Role.DEVELOPER && id === 'unassigned-report') {
          throw new ForbiddenException('Access denied: This repository is not part of any project assigned to your active teams.');
        }
        return { id, repositoryId: 'repo-1', coveragePercentage: 85.0 };
      }),
      findLatest: jest.fn().mockResolvedValue({ id: 'cov-1', repositoryId: 'repo-1' }),
      getCoverageTrends: jest.fn().mockResolvedValue({ repositoryId: 'repo-1', trends: [] }),
    };

    reviewsServiceMock = {
      findAll: jest.fn().mockImplementation(async (orgId, filters, currentUserId, user) => {
        if (user?.role === Role.DEVELOPER && filters.repositoryId === 'unassigned-repo') {
          throw new ForbiddenException('Access denied: This repository is not part of any project assigned to your active teams.');
        }
        return { data: [{ id: 'review-1' }], total: 1, page: 1, limit: 20, totalPages: 1 };
      }),
      findById: jest.fn().mockImplementation(async (id, orgId, user) => {
        if (user?.role === Role.DEVELOPER && id === 'unassigned-review') {
          throw new ForbiddenException('Access denied: This repository is not part of any project assigned to your active teams.');
        }
        return { id, repositoryId: 'repo-1' };
      }),
      getTeamDebt: jest.fn().mockResolvedValue({ debtScore: 10 }),
      getDeveloperStats: jest.fn().mockImplementation(async (devId, orgId, user) => {
        if (user?.role === Role.DEVELOPER && user.id !== devId) {
          throw new ForbiddenException('Access denied: You can only view your own review statistics.');
        }
        return { totalReviews: 5, approvedReviews: 4 };
      }),
      exportReviews: jest.fn().mockResolvedValue('ID,Title\n1,Test'),
    };

    dataFilterServiceMock = {
      getScopedProjectAndRepoIds: jest.fn().mockImplementation(async (userId, orgId, role) => {
        if (role === Role.DEVELOPER && userId === 'dev-unassigned') {
          return { isOrgScoped: false, projectIds: [], repositoryIds: [], teamIds: [] };
        }
        if (role === Role.DEVELOPER) {
          return { isOrgScoped: false, projectIds: ['proj-1'], repositoryIds: ['repo-1'], teamIds: ['team-1'] };
        }
        return { isOrgScoped: true, projectIds: [], repositoryIds: [], teamIds: [] };
      }),
      verifyRepositoryAccess: jest.fn().mockImplementation(async (repoId, orgId, user) => {
        if (user?.role === Role.DEVELOPER && (repoId === 'unassigned-repo' || repoId === 'a0000000-0000-4000-8000-000000000002')) {
          throw new ForbiddenException('Access denied: This repository is not part of any project assigned to your active teams.');
        }
        return { repositoryId: repoId, organizationId: orgId };
      }),
      verifyTeamAccess: jest.fn().mockImplementation(async (teamId, orgId, user) => {
        if (user?.role === Role.DEVELOPER && teamId === 'other-team') {
          throw new ForbiddenException('Access denied: You are not an active member or leader of this team.');
        }
        return { teamId, organizationId: orgId };
      }),
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
      repository: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => ({
          id: where?.id || 'repo-1',
          organizationId: 'org-1',
        })),
        findFirst: jest.fn().mockImplementation(async ({ where }) => ({
          id: where?.id || 'repo-1',
          organizationId: 'org-1',
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
        DashboardController,
        CodeIntelligenceController,
        CommitsController,
        CoverageController,
        ReviewsController,
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
        { provide: DashboardService, useValue: dashboardServiceMock },
        { provide: CodeIntelligenceService, useValue: codeIntelligenceServiceMock },
        { provide: CodeRemediationService, useValue: {} },
        { provide: CommitsService, useValue: commitsServiceMock },
        { provide: CoverageService, useValue: coverageServiceMock },
        { provide: ReviewsService, useValue: reviewsServiceMock },
        { provide: DataFilterService, useValue: dataFilterServiceMock },
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

    it('Dashboard stats are scoped to assigned projects for Developer', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      const res = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(res.body.totalRepositories).toBe(1);
      expect(res.body.totalDevelopers).toBe(1);

      currentAuthUser.role = Role.OWNER;
      const ownerRes = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(ownerRes.body.totalRepositories).toBe(10);
      expect(ownerRes.body.totalDevelopers).toBe(20);
    });

    it('Code intelligence endpoints reject Developer access to unassigned repositories or teams', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      // Unassigned repository stats rejected with 403
      await request(app.getHttpServer())
        .get('/code-intelligence/repositories/unassigned-repo/stats')
        .expect(403);

      // Other team bus factor rejected with 403
      await request(app.getHttpServer())
        .get('/code-intelligence/teams/other-team/bus-factor')
        .expect(403);

      // Assigned repository stats allowed with 200
      await request(app.getHttpServer())
        .get('/code-intelligence/repositories/repo-1/stats')
        .expect(200);
    });

    it('Commits endpoint enforces assigned-repository scoping for Developer', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      // Unassigned repository rejected with 403
      await request(app.getHttpServer())
        .get('/commits?repositoryId=a0000000-0000-4000-8000-000000000002')
        .expect(403);

      // Developer with no assigned projects receives empty commits list
      currentAuthUser.id = 'dev-unassigned';
      const emptyRes = await request(app.getHttpServer())
        .get('/commits')
        .expect(200);
      expect(emptyRes.body.data).toEqual([]);
      expect(emptyRes.body.total).toBe(0);
    });
  });

  describe('6. Coverage, Reviews and Code Intelligence Scoping Boundary', () => {
    it('Coverage endpoints reject Developer access to unassigned repositories', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      // Unassigned repository trends rejected with 403
      await request(app.getHttpServer())
        .get('/coverage/trends/unassigned-repo')
        .expect(403);

      // Unassigned repository latest report rejected with 403
      await request(app.getHttpServer())
        .get('/coverage/latest/unassigned-repo')
        .expect(403);

      // Unassigned repository report details rejected with 403
      await request(app.getHttpServer())
        .get('/coverage/unassigned-report')
        .expect(403);

      // Assigned repository trends allowed with 200
      await request(app.getHttpServer())
        .get('/coverage/trends/repo-1')
        .expect(200);

      // Developer with no assigned projects gets empty reports list
      currentAuthUser.id = 'dev-unassigned';
      const emptyRes = await request(app.getHttpServer())
        .get('/coverage')
        .expect(200);
      expect(emptyRes.body.reports).toEqual([]);
      expect(emptyRes.body.total).toBe(0);
    });

    it('Review endpoints enforce repository and developer privacy scoping', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      // Querying unassigned repository reviews rejected with 403
      await request(app.getHttpServer())
        .get('/reviews?repositoryId=unassigned-repo')
        .expect(403);

      // Querying unassigned team debt rejected with 403
      await request(app.getHttpServer())
        .get('/reviews/debt?teamId=other-team')
        .expect(403);

      // Querying peer developer review statistics rejected with 403
      await request(app.getHttpServer())
        .get('/reviews/stats/other-dev-id')
        .expect(403);

      // Querying own developer review statistics allowed with 200
      await request(app.getHttpServer())
        .get('/reviews/stats/dev-1')
        .expect(200);
    });

    it('Code intelligence operations validate repository access and scope defect history', async () => {
      currentAuthUser = {
        id: 'dev-1',
        email: 'dev@acme.com',
        role: Role.DEVELOPER,
        organizationId: 'org-1',
      };

      // Commit risk with unassigned repository rejected with 403
      await request(app.getHttpServer())
        .post('/code-intelligence/commit-risk')
        .send({
          repositoryId: 'unassigned-repo',
          addedLines: 10,
          deletedLines: 5,
          modifiedFilesCount: 1,
        })
        .expect(403);

      // Test impact with unassigned repository rejected with 403
      await request(app.getHttpServer())
        .post('/code-intelligence/test-impact')
        .send({
          repositoryId: 'unassigned-repo',
          changedFiles: ['src/file.ts'],
        })
        .expect(403);

      // Remediation advice with unassigned repository rejected with 403
      await request(app.getHttpServer())
        .post('/code-intelligence/remediation/advise')
        .send({
          repositoryId: 'unassigned-repo',
          code: 'function test() {}',
        })
        .expect(403);

      // Defect history returns empty list for unassigned developer
      currentAuthUser.id = 'dev-unassigned';
      const historyRes = await request(app.getHttpServer())
        .get('/code-intelligence/history')
        .expect(200);
      expect(historyRes.body).toEqual([]);
    });
  });
});

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { BullBoardConfigModule } from './modules/bull-board/bull-board.module.js';
import { CacheModule } from './modules/cache/cache.module.js';
import { DebtModule } from './modules/debt/debt.module.js';
import { MetricsModule } from './modules/metrics/metrics.module.js';
import { WebSocketModule } from './modules/websocket/websocket.module.js';
import { BullMQConfig } from './config/bullmq.config.js';
import { CommitsModule } from './modules/commits/commits.module.js';
import { CoverageModule } from './modules/coverage/coverage.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { EmailAliasesModule } from './modules/email-aliases/email-aliases.module.js';
import { GitHubModule } from './modules/github/github.module.js';
import { GoalsModule } from './modules/goals/goals.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OnboardingModule } from './modules/onboarding/onboarding.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { ReleasesModule } from './modules/releases/releases.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { ScoresModule } from './modules/scores/scores.module.js';
import { SprintsModule } from './modules/sprints/sprints.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';

/**
 * Root Application Module
 * Registers all feature modules
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60000,
        limit: 60,
      },
      {
        name: 'passwordReset',
        ttl: 3600000,
        limit: 3,
      },
    ]),
    BullMQConfig,
    AuthModule,
    OrganizationsModule,
    AlertsModule,
    AuditModule,
    BullBoardConfigModule,
    CacheModule,
    DebtModule,
    MetricsModule,
    WebSocketModule,
    CommitsModule,
    CoverageModule,
    DashboardModule,
    EmailAliasesModule,
    GitHubModule,
    GoalsModule,
    NotificationsModule,
    OnboardingModule,
    ProjectsModule,
    ReleasesModule,
    ReportsModule,
    ReviewsModule,
    ScoresModule,
    SprintsModule,
    TeamsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

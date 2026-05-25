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

/**
 * Root Application Module
 * Registers all feature modules
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

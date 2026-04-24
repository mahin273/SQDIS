import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { HashService } from './services/hash.service';
import { EnhancedAuditLogService } from './services/enhanced-audit-log.service';
import { AuditLogService } from './services/audit-log.service';
import { AuditExportService } from './services/audit-export.service';
import { AuditRetentionService } from './services/audit-retention.service';
import { AuditArchivalSchedulerService } from './services/audit-archival-scheduler.service';
import { AuditAnalyticsService } from './services/audit-analytics.service';
import { AuditMonitorService } from './services/audit-monitor.service';
import { AuditWriteProcessor } from './processors/audit-write.processor';
import { ArchivalProcessor } from './processors/archival.processor';
import { ExportProcessor } from './processors/export.processor';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditLogController } from './audit-log.controller';
import { AuditEventsGateway } from './audit-events.gateway';
import { PrismaModule } from '../../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

/**
 * Queue name for audit write operations
 */
export const AUDIT_WRITE_QUEUE = 'audit-write';

/**
 * Queue name for archival operations
 */
export const ARCHIVAL_QUEUE = 'audit-archival';

/**
 * Queue name for export operations
 */
export const EXPORT_QUEUE = 'audit-export';

/**
 * AuditModule provides comprehensive audit logging functionality.
 *
 * This module includes services for:
 * - Cryptographic hashing for tamper-proof logging
 * - Audit entry creation and management
 * - Query and export capabilities
 * - Retention and archival
 * - Analytics and reporting
 * - Real-time monitoring
 */
@Module({
  imports: [
    PrismaModule,
    CacheModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    BullModule.registerQueue({
      name: AUDIT_WRITE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    BullModule.registerQueue({
      name: ARCHIVAL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 500,
      },
    }),
    BullModule.registerQueue({
      name: EXPORT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        removeOnComplete: 50,
        removeOnFail: 500,
      },
    }),
  ],
  providers: [
    HashService,
    EnhancedAuditLogService,
    AuditLogService,
    AuditExportService,
    AuditRetentionService,
    AuditArchivalSchedulerService,
    AuditAnalyticsService,
    AuditMonitorService,
    AuditLogInterceptor,
    AuditWriteProcessor,
    ArchivalProcessor,
    ExportProcessor,
    AuditEventsGateway,
  ],
  controllers: [AuditLogController],
  exports: [HashService, EnhancedAuditLogService, AuditLogService, AuditExportService, AuditRetentionService, AuditAnalyticsService, AuditMonitorService, AuditLogInterceptor],
})
export class AuditModule {}

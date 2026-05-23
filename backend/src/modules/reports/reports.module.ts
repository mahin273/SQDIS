import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsController, LeaderboardController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportGeneratorProcessor } from './processors/report-generator.processor';
import { FileStorageService } from './services/file-storage.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { LeaderboardService } from './services/leaderboard.service';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScoresModule } from '../scores/scores.module';
import { CommitsModule } from '../commits/commits.module';
import { TeamsModule } from '../teams/teams.module';
import { CacheModule } from '../cache/cache.module';
import { REPORT_QUEUE } from './constants';

/**
 * Module for report generation, export, and leaderboard
 */
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: REPORT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    forwardRef(() => AuthModule),
    forwardRef(() => OrganizationsModule),
    forwardRef(() => ScoresModule),
    forwardRef(() => CommitsModule),
    forwardRef(() => TeamsModule),
    CacheModule,
  ],
  controllers: [ReportsController, LeaderboardController],
  providers: [
    ReportsService,
    ReportGeneratorProcessor,
    FileStorageService,
    PdfGeneratorService,
    LeaderboardService,
  ],
  exports: [ReportsService, FileStorageService, PdfGeneratorService, LeaderboardService],
})
export class ReportsModule {}

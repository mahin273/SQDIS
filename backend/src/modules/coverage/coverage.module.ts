import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { CoverageController } from './coverage.controller';
import { CoverageService } from './coverage.service';
import { CoverageProcessor } from './processors';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { COVERAGE_QUEUE, COVERAGE_UPLOAD_CONFIG } from './constants';

/**
 * Module for coverage report upload and processing
 */
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: COVERAGE_QUEUE,
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
    MulterModule.register(COVERAGE_UPLOAD_CONFIG),
    forwardRef(() => AuthModule),
    forwardRef(() => OrganizationsModule),
  ],
  controllers: [CoverageController],
  providers: [CoverageService, CoverageProcessor],
  exports: [CoverageService],
})
export class CoverageModule {}

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CommitsController } from './commits.controller';
import { CommitsService } from './commits.service';
import { CommitProcessor } from './processors';
import { MlClientService } from './services';
import { PrismaModule } from '../../prisma';
import { GitHubModule } from '../github';
import { ScoresModule } from '../scores';
import { DebtModule } from '../debt';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AlertsModule } from '../alerts/alerts.module';
import { CommitQueueModule } from '../../config';

/**
 * Commits module for processing and storing commit data
 */
@Module({
  imports: [
    PrismaModule,
    CommitQueueModule,
    ConfigModule,
    EventEmitterModule.forRoot(),
    forwardRef(() => GitHubModule),
    forwardRef(() => ScoresModule),
    forwardRef(() => DebtModule),
    forwardRef(() => OnboardingModule),
    forwardRef(() => AlertsModule),
  ],
  controllers: [CommitsController],
  providers: [CommitsService, CommitProcessor, MlClientService],
  exports: [CommitsService, MlClientService],
})
export class CommitsModule {}

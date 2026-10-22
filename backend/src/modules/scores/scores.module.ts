import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScoresController } from './scores.controller';
import { ScoresService } from './scores.service';
import { ScoresMlClientService } from './services/scores-ml-client.service';
import { ScoresCacheService } from './services/scores-cache.service';
import { ScoreProcessor } from './processors';
import { PrismaModule } from '../../prisma';
import { ScoreQueueModule } from '../../config';
import { GitHubModule } from '../github/github.module';
import { OrganizationsModule } from '../organizations/organizations.module';

/**
 * Scores module for DQS and SQS score management
 */
@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    ScoreQueueModule,
    GitHubModule,
    forwardRef(() => OrganizationsModule),
  ],
  controllers: [ScoresController],
  providers: [ScoresService, ScoresMlClientService, ScoresCacheService, ScoreProcessor],
  exports: [ScoresService, ScoresMlClientService, ScoresCacheService],
})
export class ScoresModule {}

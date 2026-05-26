import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalTemplatesService } from './services/goal-templates.service';
import { GoalProgressService } from './services/goal-progress.service';
import { GoalAchievementService } from './services/goal-achievement.service';
import { GoalHistoryService } from './services/goal-history.service';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

/**
 * Goals module for quality goals and OKRs management
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    forwardRef(() => AuthModule),
    forwardRef(() => OrganizationsModule),
  ],
  controllers: [GoalsController],
  providers: [
    GoalsService,
    GoalTemplatesService,
    GoalProgressService,
    GoalAchievementService,
    GoalHistoryService,
  ],
  exports: [
    GoalsService,
    GoalTemplatesService,
    GoalProgressService,
    GoalAchievementService,
    GoalHistoryService,
  ],
})
export class GoalsModule {}

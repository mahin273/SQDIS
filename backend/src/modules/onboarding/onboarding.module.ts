import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { MilestoneDetectionService } from './services/milestone-detection.service';
import { MilestoneNotificationHandler } from './services/milestone-notification.handler';
import { AuthModule } from '../auth/auth.module';

/**
 * Onboarding module for developer onboarding management
 */
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    EventEmitterModule.forRoot(),
    forwardRef(() => AuthModule),
  ],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    MilestoneDetectionService,
    MilestoneNotificationHandler,
    ProgressTrackingService,
  ],
  exports: [OnboardingService, ProgressTrackingService],
})
export class OnboardingModule {}

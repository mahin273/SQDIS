import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { EmailService, EmailQueueService, EmailProcessor } from './email';
import { EMAIL_QUEUE } from '../../config/bullmq.config';

/**
 * Notifications module for managing in-app notifications and email sending
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    EventEmitterModule.forRoot(),
    forwardRef(() => AuthModule),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, EmailQueueService, EmailProcessor],
  exports: [NotificationsService, EmailService, EmailQueueService],
})
export class NotificationsModule {}

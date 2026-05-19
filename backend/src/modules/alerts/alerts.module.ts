import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { NotificationService } from './services/notification.service';
import { DigestService } from './services/digest.service';
import { ThresholdConfigService } from './services/threshold-config.service';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

/**
 * Alerts module for anomaly detection and notification management
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
  controllers: [AlertsController],
  providers: [AlertsService, NotificationService, DigestService, ThresholdConfigService],
  exports: [AlertsService, NotificationService, DigestService, ThresholdConfigService],
})
export class AlertsModule {}

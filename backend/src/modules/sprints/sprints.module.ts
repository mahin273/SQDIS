import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';
import { SprintAutoGenerationService } from './services/sprint-auto-generation.service';
import { SprintExportService } from './services/sprint-export.service';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { TeamsModule } from '../teams/teams.module';

/**
 * Module for sprint management including auto-generation and export
 */
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    forwardRef(() => AuthModule),
    forwardRef(() => OrganizationsModule),
    forwardRef(() => TeamsModule),
  ],
  controllers: [SprintsController],
  providers: [SprintsService, SprintAutoGenerationService, SprintExportService],
  exports: [SprintsService, SprintAutoGenerationService, SprintExportService],
})
export class SprintsModule {}

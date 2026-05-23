import { Module, forwardRef } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamLeadOrAdminGuard } from '../auth/guards/team-lead-or-admin.guard';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), forwardRef(() => OrganizationsModule)],
  controllers: [TeamsController],
  providers: [TeamsService, TeamLeadOrAdminGuard],
  exports: [TeamsService],
})
export class TeamsModule {}

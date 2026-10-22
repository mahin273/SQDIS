import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuthModule } from '../auth/auth.module';
import { CodeIntelligenceController } from './code-intelligence.controller';
import { CodeIntelligenceService } from './code-intelligence.service';
import { CodeRemediationService } from './services/code-remediation.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => OrganizationsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [CodeIntelligenceController],
  providers: [CodeIntelligenceService, CodeRemediationService],
  exports: [CodeIntelligenceService, CodeRemediationService],
})
export class CodeIntelligenceModule {}

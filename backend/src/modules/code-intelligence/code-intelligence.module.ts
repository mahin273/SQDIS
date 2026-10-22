import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CodeIntelligenceController } from './code-intelligence.controller.js';
import { CodeIntelligenceService } from './code-intelligence.service.js';
import { CodeRemediationService } from './services/code-remediation.service.js';

@Module({
  imports: [
    PrismaModule,
    OrganizationsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [CodeIntelligenceController],
  providers: [CodeIntelligenceService, CodeRemediationService],
  exports: [CodeIntelligenceService, CodeRemediationService],
})
export class CodeIntelligenceModule {}

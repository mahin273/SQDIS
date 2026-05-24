import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailAliasesController } from './email-aliases.controller';
import { AdminEmailAliasesController } from './admin-email-aliases.controller';
import { EmailAliasesService } from './email-aliases.service';
import { EmailValidationService } from './services/email-validation.service';
import { EmailService } from './services/email.service';
import { ReattributionService } from './services/reattribution.service';
import { AdminEmailAliasesService } from './services/admin-email-aliases.service';
import { ReattributionProcessor } from './processors/reattribution.processor';
import { PrismaModule } from '../../prisma';
import { ReattributionQueueModule } from '../../config';
import { AuthModule } from '../auth/auth.module';

/**
 * Module for managing developer email aliases
 */
@Module({
  imports: [PrismaModule, ConfigModule, ReattributionQueueModule, forwardRef(() => AuthModule)],
  controllers: [EmailAliasesController, AdminEmailAliasesController],
  providers: [
    EmailAliasesService,
    EmailValidationService,
    EmailService,
    ReattributionService,
    AdminEmailAliasesService,
    ReattributionProcessor,
  ],
  exports: [
    EmailAliasesService,
    EmailValidationService,
    EmailService,
    ReattributionService,
    AdminEmailAliasesService,
  ],
})
export class EmailAliasesModule {}

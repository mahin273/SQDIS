import { Module, forwardRef } from '@nestjs/common';
import { DebtController } from './debt.controller';
import { DebtService } from './debt.service';
import { DebtScannerService } from './services';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

/**
 * Debt module for tracking technical debt markers
 */
@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), forwardRef(() => OrganizationsModule)],
  controllers: [DebtController],
  providers: [DebtService, DebtScannerService],
  exports: [DebtService, DebtScannerService],
})
export class DebtModule {}

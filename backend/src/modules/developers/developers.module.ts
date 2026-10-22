import { Module, forwardRef } from '@nestjs/common';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { PrismaModule } from '../../prisma';
import { ScoresModule } from '../scores/scores.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, ScoresModule, forwardRef(() => OrganizationsModule)],
  controllers: [DevelopersController],
  providers: [DevelopersService],
  exports: [DevelopersService],
})
export class DevelopersModule {}

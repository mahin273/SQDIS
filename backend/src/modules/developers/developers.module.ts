import { Module } from '@nestjs/common';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { PrismaModule } from '../../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [DevelopersController],
  providers: [DevelopersService],
  exports: [DevelopersService],
})
export class DevelopersModule {}

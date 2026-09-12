import { Module } from '@nestjs/common';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { PrismaModule } from '../../prisma';
import { ScoresModule } from '../scores/scores.module';

@Module({
  imports: [PrismaModule, ScoresModule],
  controllers: [DevelopersController],
  providers: [DevelopersService],
  exports: [DevelopersService],
})
export class DevelopersModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CodeIntelligenceController } from './code-intelligence.controller.js';
import { CodeIntelligenceService } from './code-intelligence.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CodeIntelligenceController],
  providers: [CodeIntelligenceService],
  exports: [CodeIntelligenceService],
})
export class CodeIntelligenceModule {}

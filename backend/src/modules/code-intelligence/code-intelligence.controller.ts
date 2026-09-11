import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GetOrganization } from '../auth/decorators/get-organization.decorator.js';
import { CodeIntelligenceService } from './code-intelligence.service.js';
import {
  AstDefectDto,
  CommitRiskDto,
  TestImpactDto,
  CanaryAnalysisDto,
} from './dto/index.js';

@ApiTags('Code Intelligence')
@ApiBearerAuth()
@Controller('code-intelligence')
@UseGuards(JwtAuthGuard)
export class CodeIntelligenceController {
  constructor(private readonly codeIntelligenceService: CodeIntelligenceService) {}

  @Post('ast-defect')
  @ApiOperation({ summary: 'Predict module defect risk using Tree-sitter AST and NASA MDP model' })
  async predictAstDefect(
    @Body() dto: AstDefectDto,
    @GetOrganization() organizationId?: string,
  ) {
    return this.codeIntelligenceService.predictAstDefect(dto, organizationId);
  }

  @Post('commit-risk')
  @ApiOperation({ summary: 'Predict commit/PR defect risk using Kamei JIT model' })
  async predictCommitRisk(
    @Body() dto: CommitRiskDto,
    @GetOrganization() organizationId?: string,
  ) {
    return this.codeIntelligenceService.predictCommitRisk(dto, organizationId);
  }

  @Post('test-impact')
  @ApiOperation({ summary: 'Execute Test Impact Analysis (TIA) via dependency DAG' })
  async analyzeTestImpact(@Body() dto: TestImpactDto) {
    return this.codeIntelligenceService.analyzeTestImpact(dto);
  }

  @Post('canary-analysis')
  @ApiOperation({ summary: 'Detect deployment performance regressions via Prometheus TSDB' })
  async analyzeCanary(@Body() dto: CanaryAnalysisDto) {
    return this.codeIntelligenceService.analyzeCanary(dto);
  }

  @Get('teams/:teamId/bus-factor')
  @ApiOperation({ summary: 'Calculate live Bus Factor and knowledge silos for a team' })
  async getTeamBusFactor(
    @Param('teamId') teamId: string,
    @GetOrganization() organizationId?: string,
  ) {
    return this.codeIntelligenceService.calculateTeamBusFactor(teamId, organizationId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Retrieve historical defect predictions' })
  async getDefectHistory(
    @GetOrganization() organizationId?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.codeIntelligenceService.getDefectHistory(organizationId, limit);
  }

  @Get('bus-factor-snapshots')
  @ApiOperation({ summary: 'Retrieve historical team Bus Factor audit snapshots' })
  async getBusFactorSnapshots(
    @Query('teamId') teamId?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    return this.codeIntelligenceService.getBusFactorSnapshots(teamId, limit);
  }
}

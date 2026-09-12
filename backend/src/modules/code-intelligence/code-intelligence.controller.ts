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
import { CodeRemediationService } from './services/code-remediation.service.js';
import {
  AstDefectDto,
  CommitRiskDto,
  TestImpactDto,
  CanaryAnalysisDto,
  RemediationRequestDto,
  RemediationResponseDto,
  TreemapQueryDto,
  RepositoryTreemapResponseDto,
} from './dto/index.js';

@ApiTags('Code Intelligence')
@ApiBearerAuth()
@Controller('code-intelligence')
@UseGuards(JwtAuthGuard)
export class CodeIntelligenceController {
  constructor(
    private readonly codeIntelligenceService: CodeIntelligenceService,
    private readonly codeRemediationService: CodeRemediationService,
  ) {}

  @Post('remediation/advise')
  @ApiOperation({ summary: 'Diagnose structural code smells and generate prescriptive refactoring advice' })
  async generateRemediationAdvice(@Body() dto: RemediationRequestDto): Promise<RemediationResponseDto> {
    return this.codeRemediationService.generateAdvice(dto);
  }

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

  @Get('repositories/:repositoryId/hotspots')
  @ApiOperation({ summary: 'Retrieve top complexity & defect hotspots for a repository' })
  async getRepositoryHotspots(
    @Param('repositoryId') repositoryId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.codeIntelligenceService.getRepositoryHotspots(repositoryId, limit);
  }

  @Get('repositories/:repositoryId/commits-risk')
  @ApiOperation({ summary: 'Retrieve recent commits with JIT defect risk predictions' })
  async getRepositoryCommitsRisk(
    @Param('repositoryId') repositoryId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.codeIntelligenceService.getRepositoryCommitsRisk(repositoryId, limit);
  }

  @Post('repositories/:repositoryId/test-impact')
  @ApiOperation({ summary: 'Analyze test impact for a pull request changed files list' })
  async getPullRequestTestImpact(
    @Param('repositoryId') repositoryId: string,
    @Body('changedFiles') changedFiles: string[],
  ) {
    return this.codeIntelligenceService.getPullRequestTestImpact(repositoryId, changedFiles);
  }

  @Get('repositories/:repositoryId/treemap')
  @ApiOperation({ summary: 'Retrieve hierarchical architectural treemap and churn vs complexity hotspot matrix' })
  async getRepositoryTreemap(
    @Param('repositoryId') repositoryId: string,
    @Query() query: TreemapQueryDto,
  ): Promise<RepositoryTreemapResponseDto> {
    return this.codeIntelligenceService.getRepositoryTreemap(
      repositoryId,
      query.sizeBy,
      query.colorBy,
    );
  }
}


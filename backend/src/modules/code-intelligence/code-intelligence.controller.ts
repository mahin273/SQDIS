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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, OrganizationGuard } from '../auth/guards/index.js';
import { GetOrganization } from '../auth/decorators/get-organization.decorator.js';
import { GetUser } from '../auth/decorators/get-user.decorator.js';
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
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class CodeIntelligenceController {
  constructor(
    private readonly codeIntelligenceService: CodeIntelligenceService,
    private readonly codeRemediationService: CodeRemediationService,
  ) {}

  @Post('remediation/advise')
  @ApiOperation({ summary: 'Diagnose structural code smells and generate prescriptive refactoring advice' })
  async generateRemediationAdvice(
    @Body() dto: RemediationRequestDto,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ): Promise<RemediationResponseDto> {
    if (dto.repositoryId) {
      await this.codeIntelligenceService.verifyRepositoryAccess(dto.repositoryId, organizationId, user);
    } else if (user) {
      const scoped = await this.codeIntelligenceService.getScopedProjectAndRepoIds(user.id, organizationId, user.role);
      if (!scoped.isOrgScoped) {
        if (scoped.repositoryIds.length === 0) {
          throw new ForbiddenException('No assigned repositories available for this operation');
        }
        dto.repositoryId = scoped.repositoryIds[0];
      }
    }
    return this.codeRemediationService.generateAdvice(dto);
  }

  @Post('ast-defect')
  @ApiOperation({ summary: 'Predict module defect risk using Tree-sitter AST and NASA MDP model' })
  async predictAstDefect(
    @Body() dto: AstDefectDto,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    if (dto.repositoryId) {
      await this.codeIntelligenceService.verifyRepositoryAccess(dto.repositoryId, organizationId, user);
    } else if (user) {
      const scoped = await this.codeIntelligenceService.getScopedProjectAndRepoIds(user.id, organizationId, user.role);
      if (!scoped.isOrgScoped) {
        if (scoped.repositoryIds.length === 0) {
          throw new ForbiddenException('No assigned repositories available for this operation');
        }
        dto.repositoryId = scoped.repositoryIds[0];
      }
    }
    return this.codeIntelligenceService.predictAstDefect(dto, organizationId, dto.repositoryId);
  }

  @Post('commit-risk')
  @ApiOperation({ summary: 'Predict commit/PR defect risk using Kamei JIT model' })
  async predictCommitRisk(
    @Body() dto: CommitRiskDto,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    if (dto.repositoryId) {
      await this.codeIntelligenceService.verifyRepositoryAccess(dto.repositoryId, organizationId, user);
    } else if (user) {
      const scoped = await this.codeIntelligenceService.getScopedProjectAndRepoIds(user.id, organizationId, user.role);
      if (!scoped.isOrgScoped) {
        if (scoped.repositoryIds.length === 0) {
          throw new ForbiddenException('No assigned repositories available for this operation');
        }
        dto.repositoryId = scoped.repositoryIds[0];
      }
    }
    return this.codeIntelligenceService.predictCommitRisk(dto, organizationId, dto.repositoryId);
  }

  @Post('test-impact')
  @ApiOperation({ summary: 'Execute Test Impact Analysis (TIA) via dependency DAG' })
  async analyzeTestImpact(
    @Body() dto: TestImpactDto,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    if (dto.repositoryId) {
      await this.codeIntelligenceService.verifyRepositoryAccess(dto.repositoryId, organizationId, user);
    } else if (user) {
      const scoped = await this.codeIntelligenceService.getScopedProjectAndRepoIds(user.id, organizationId, user.role);
      if (!scoped.isOrgScoped) {
        if (scoped.repositoryIds.length === 0) {
          throw new ForbiddenException('No assigned repositories available for this operation');
        }
        dto.repositoryId = scoped.repositoryIds[0];
      }
    }
    return this.codeIntelligenceService.analyzeTestImpact(dto);
  }

  @Post('canary-analysis')
  @ApiOperation({ summary: 'Detect deployment performance regressions via Prometheus TSDB' })
  async analyzeCanary(
    @Body() dto: CanaryAnalysisDto,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    if (user?.role === 'DEVELOPER') {
      throw new ForbiddenException('Developers cannot trigger deployment canary analysis');
    }
    if (dto.repositoryId) {
      await this.codeIntelligenceService.verifyRepositoryAccess(dto.repositoryId, organizationId, user);
    }
    return this.codeIntelligenceService.analyzeCanary(dto);
  }

  @Get('teams/:teamId/bus-factor')
  @ApiOperation({ summary: 'Calculate live Bus Factor and knowledge silos for a team' })
  async getTeamBusFactor(
    @Param('teamId') teamId: string,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    return this.codeIntelligenceService.calculateTeamBusFactor(teamId, organizationId, user);
  }

  @Get('history')
  @ApiOperation({ summary: 'Retrieve historical defect predictions' })
  async getDefectHistory(
    @GetOrganization() organizationId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @GetUser() user?: any,
  ) {
    return this.codeIntelligenceService.getDefectHistory(organizationId, limit, user);
  }

  @Get('bus-factor-snapshots')
  @ApiOperation({ summary: 'Retrieve historical team Bus Factor audit snapshots' })
  async getBusFactorSnapshots(
    @GetOrganization() organizationId: string,
    @Query('teamId') teamId?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @GetUser() user?: any,
  ) {
    return this.codeIntelligenceService.getBusFactorSnapshots(teamId, limit, organizationId, user);
  }

  @Get('repositories/:repositoryId/stats')
  @ApiOperation({ summary: 'Retrieve repository code intelligence telemetry summary stats' })
  async getRepositoryStats(
    @Param('repositoryId') repositoryId: string,
    @GetOrganization() organizationId: string,
    @GetUser() user?: any,
  ) {
    return this.codeIntelligenceService.getRepositoryStats(repositoryId, organizationId, user);
  }

  @Get('repositories/:repositoryId/hotspots')
  @ApiOperation({ summary: 'Retrieve top complexity & defect hotspots for a repository' })
  async getRepositoryHotspots(
    @Param('repositoryId') repositoryId: string,
    @GetOrganization() organizationId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @GetUser() user?: any,
  ) {
    return this.codeIntelligenceService.getRepositoryHotspots(repositoryId, limit, organizationId, user);
  }

  @Get('repositories/:repositoryId/commits-risk')
  @ApiOperation({ summary: 'Retrieve recent commits with JIT defect risk predictions' })
  async getRepositoryCommitsRisk(
    @Param('repositoryId') repositoryId: string,
    @GetOrganization() organizationId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @GetUser() user?: any,
  ) {
    return this.codeIntelligenceService.getRepositoryCommitsRisk(repositoryId, limit, organizationId, user);
  }

  @Post('repositories/:repositoryId/test-impact')
  @ApiOperation({ summary: 'Analyze test impact for a pull request changed files list' })
  async getPullRequestTestImpact(
    @Param('repositoryId') repositoryId: string,
    @GetOrganization() organizationId: string,
    @Body('changedFiles') changedFiles: string[],
    @GetUser() user?: any,
  ) {
    return this.codeIntelligenceService.getPullRequestTestImpact(repositoryId, changedFiles, organizationId, user);
  }

  @Get('repositories/:repositoryId/treemap')
  @ApiOperation({ summary: 'Retrieve hierarchical architectural treemap and churn vs complexity hotspot matrix' })
  async getRepositoryTreemap(
    @Param('repositoryId') repositoryId: string,
    @GetOrganization() organizationId: string,
    @Query() query: TreemapQueryDto,
    @GetUser() user?: any,
  ): Promise<RepositoryTreemapResponseDto> {
    return this.codeIntelligenceService.getRepositoryTreemap(
      repositoryId,
      query.sizeBy,
      query.colorBy,
      organizationId,
      user,
    );
  }
}


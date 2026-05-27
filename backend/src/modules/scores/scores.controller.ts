import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ScoresService } from './scores.service';
import { JwtAuthGuard } from '../auth/guards';
import { GetUser } from '../auth/decorators';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { DQSHistoryQueryDto, SQSHistoryQueryDto, RecalculateDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

/**
 * Controller for DQS and SQS score endpoints
 */
@ApiTags('Scores')
@ApiBearerAuth()
@Controller('scores')
@UseGuards(JwtAuthGuard)
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  /**
   * Get current user's DQS score
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user\'s DQS score detail' })
  @ApiResponse({ status: 200, description: 'User DQS score retrieved.' })
  async getMyScore(@GetUser('id') userId: string, @GetOrganization() organizationId: string) {
    const dqsResult = await this.scoresService.getDQS(userId, organizationId);
    return {
      dqs: dqsResult.score || 0,
      score: dqsResult.score || 0,
      trend: 0,
      codeQuality: dqsResult.features?.coverage_avg || 0,
      reviewSpeed: dqsResult.features?.review_turnaround_avg
        ? Math.max(0, 100 - dqsResult.features.review_turnaround_avg * 4)
        : 0,
      bugFixRate: dqsResult.features?.bug_fix_ratio
        ? Math.round(dqsResult.features.bug_fix_ratio * 100)
        : 0,
      modelVersion: dqsResult.modelVersion,
      calculatedAt: dqsResult.calculatedAt,
      shapValues: dqsResult.shapValues,
    };
  }

  /**
   * Get developer DQS score
   */
  @Get('dqs/:developerId')
  @ApiOperation({ summary: 'Get a specific developer DQS score by ID' })
  @ApiParam({ name: 'developerId', description: 'Developer User ID' })
  @ApiResponse({ status: 200, description: 'Developer DQS score details retrieved.' })
  async getDQS(
    @Param('developerId', ParseUUIDPipe) developerId: string,
    @GetOrganization() organizationId: string,
  ) {
    return this.scoresService.getDQS(developerId, organizationId);
  }

  /**
   * Get developer DQS history
   */
  @Get('dqs/:developerId/history')
  @ApiOperation({ summary: 'Get DQS score history for a developer' })
  @ApiParam({ name: 'developerId', description: 'Developer User ID' })
  @ApiResponse({ status: 200, description: 'DQS score history list retrieved.' })
  async getDQSHistory(
    @Param('developerId', ParseUUIDPipe) developerId: string,
    @Query() query: DQSHistoryQueryDto,
    @GetOrganization() organizationId: string,
  ) {
    return this.scoresService.getDQSHistory(developerId, organizationId, query);
  }

  /**
   * Get DQS SHAP explanation
   */
  @Get('dqs/:developerId/explain')
  @ApiOperation({ summary: 'Get SHAP explanations for developer DQS score' })
  @ApiParam({ name: 'developerId', description: 'Developer User ID' })
  @ApiResponse({ status: 200, description: 'SHAP explanation details retrieved.' })
  async getDQSExplanation(
    @Param('developerId', ParseUUIDPipe) developerId: string,
    @GetOrganization() organizationId: string,
  ) {
    return this.scoresService.getDQSExplanation(developerId, organizationId);
  }

  /**
   * Get project SQS score
   */
  @Get('sqs/:projectId')
  @ApiOperation({ summary: 'Get SQS score for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project SQS details retrieved.' })
  async getSQS(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @GetOrganization() organizationId: string,
  ) {
    return this.scoresService.getSQS(projectId, organizationId);
  }

  /**
   * Get project SQS history
   */
  @Get('sqs/:projectId/history')
  @ApiOperation({ summary: 'Get SQS score history for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project SQS history list retrieved.' })
  async getSQSHistory(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: SQSHistoryQueryDto,
    @GetOrganization() organizationId: string,
  ) {
    return this.scoresService.getSQSHistory(projectId, organizationId, query);
  }

  /**
   * Get risky modules for a project
   */
  @Get('sqs/:projectId/risks')
  @ApiOperation({ summary: 'Get risky modules identification for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Risky modules list retrieved.' })
  async getRiskyModules(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @GetOrganization() organizationId: string,
  ) {
    return this.scoresService.getRiskyModules(projectId, organizationId);
  }

  /**
   * Trigger score recalculation
   */
  @Post('recalculate')
  @ApiOperation({ summary: 'Trigger score recalculation manually' })
  @ApiResponse({ status: 201, description: 'Recalculation successfully triggered.' })
  async recalculate(@Body() body: RecalculateDto, @GetOrganization() organizationId: string) {
    return this.scoresService.triggerRecalculation(body.entityId, body.type, organizationId);
  }
}

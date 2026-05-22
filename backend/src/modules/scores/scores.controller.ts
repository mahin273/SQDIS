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

/**
 * Controller for DQS and SQS score endpoints
 */
@Controller('scores')
@UseGuards(JwtAuthGuard)
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  /**
   * Get current user's DQS score
   */
  @Get('me')
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
  async recalculate(@Body() body: RecalculateDto, @GetOrganization() organizationId: string) {
    return this.scoresService.triggerRecalculation(body.entityId, body.type, organizationId);
  }
}

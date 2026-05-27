 
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DebtService } from './debt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DebtFiltersDto } from './dto';

/**
 * Controller for technical debt tracking endpoints
 */
@ApiTags('Technical Debt')
@Controller('debt')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@ApiBearerAuth()
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  /**
   * Get all debt items with pagination and filters
   * GET /api/debt
   */
  @Get()
  @ApiOperation({ summary: 'Get all debt items with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of debt items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @GetUser('organizationId') organizationId: string,
    @Query() filters: DebtFiltersDto,
  ) {
    return await this.debtService.findAll(organizationId, filters);
  }

  /**
   * Get code hot spots - files with high churn and bug correlation
   * GET /api/debt/hotspots
   */
  @Get('hotspots')
  @ApiOperation({ summary: 'Get code hot spots with high churn and bug correlation' })
  @ApiQuery({ name: 'repositoryId', required: false, description: 'Filter by repository ID' })
  @ApiResponse({ status: 200, description: 'List of hot spot files ranked by severity' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHotSpots(
    @GetUser('organizationId') organizationId: string,
    @Query('repositoryId') repositoryId?: string,
  ) {
    return await this.debtService.getHotSpots(organizationId, repositoryId);
  }

  /**
   * Get debt trends over time
   * GET /api/debt/trends
   */
  @Get('trends')
  @ApiOperation({ summary: 'Get debt trends over time' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to look back (default: 30)' })
  @ApiQuery({ name: 'repositoryId', required: false, description: 'Filter by repository ID' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Filter by team ID' })
  @ApiResponse({ status: 200, description: 'Debt trend data with velocity and accumulation status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTrends(
    @GetUser('organizationId') organizationId: string,
    @Query('days') days?: number,
    @Query('repositoryId') repositoryId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return await this.debtService.getTrends(organizationId, days || 30, repositoryId, teamId);
  }

  /**
   * Get prioritized debt recommendations
   * GET /api/debt/recommendations
   */
  @Get('recommendations')
  @ApiOperation({ summary: 'Get prioritized debt recommendations' })
  @ApiQuery({ name: 'repositoryId', required: false, description: 'Filter by repository ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of recommendations (default: 10)' })
  @ApiResponse({ status: 200, description: 'Prioritized list of debt remediation recommendations' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecommendations(
    @GetUser('organizationId') organizationId: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('limit') limit?: number,
  ) {
    return await this.debtService.getRecommendations(organizationId, repositoryId, limit || 10);
  }

  /**
   * Get debt attribution by developer
   * GET /api/debt/attribution
   */
  @Get('attribution')
  @ApiOperation({ summary: 'Get debt attribution by developer' })
  @ApiResponse({ status: 200, description: 'Debt introduced and resolved per developer' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAttribution(@GetUser('organizationId') organizationId: string) {
    return await this.debtService.getAttribution(organizationId);
  }

  /**
   * Get module debt scores
   * GET /api/debt/modules
   */
  @Get('modules')
  @ApiOperation({ summary: 'Get module-level debt scores' })
  @ApiQuery({ name: 'repositoryId', required: false, description: 'Filter by repository ID' })
  @ApiQuery({ name: 'threshold', required: false, description: 'Score threshold for flagging (default: 10)' })
  @ApiResponse({ status: 200, description: 'Debt scores per module with marker breakdowns' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getModuleScores(
    @GetUser('organizationId') organizationId: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('threshold') threshold?: number,
  ) {
    return await this.debtService.getModuleDebtScore(
      organizationId,
      repositoryId,
      threshold || 10,
    );
  }

  /**
   * Get a debt item by ID
   * GET /api/debt/:id
   * Note: This route MUST be defined last to avoid matching specific routes like /hotspots
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a debt item by ID' })
  @ApiParam({ name: 'id', description: 'Debt item ID' })
  @ApiResponse({ status: 200, description: 'Debt item details with related data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Debt item not found' })
  async findById(@Param('id') id: string) {
    const debtItem = await this.debtService.findById(id);
    if (!debtItem) {
      throw new NotFoundException(`Debt item with ID ${id} not found`);
    }
    return debtItem;
  }
}

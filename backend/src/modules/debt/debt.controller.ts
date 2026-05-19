/*eslint-disable */
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { DebtService } from './debt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DebtFiltersDto } from './dto';

/**
 * Controller for technical debt tracking endpoints
 */
@Controller('debt')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  /**
   * Get all debt items with pagination and filters
   * GET /api/debt
   */
  @Get()
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
  async getAttribution(@GetUser('organizationId') organizationId: string) {
    return await this.debtService.getAttribution(organizationId);
  }

  /**
   * Get module debt scores
   * GET /api/debt/modules
   */
  @Get('modules')
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
  async findById(@Param('id') id: string) {
    const debtItem = await this.debtService.findById(id);
    if (!debtItem) {
      throw new NotFoundException(`Debt item with ID ${id} not found`);
    }
    return debtItem;
  }
}

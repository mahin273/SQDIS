import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DebtService } from './debt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DataFilterService } from '../auth/services/data-filter.service';
import { Role } from '@prisma/client';
import { DebtFiltersDto } from './dto';

/**
 * Controller for technical debt tracking endpoints
 */
@ApiTags('Technical Debt')
@Controller('debt')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@ApiBearerAuth()
export class DebtController {
  constructor(
    private readonly debtService: DebtService,
    @Optional() private readonly dataFilterService?: DataFilterService,
  ) {}

  /**
   * Helper to resolve allowed repositories for the caller
   */
  private async resolveAllowedRepositoryIds(
    organizationId: string,
    user: any,
    repositoryId?: string,
  ): Promise<{ repositoryId?: string; allowedRepoIds?: string[]; empty: boolean }> {
    if (repositoryId) {
      if (this.dataFilterService && user && typeof user === 'object' && user.id) {
        await this.dataFilterService.verifyRepositoryAccess(repositoryId, organizationId, user);
      }
      return { repositoryId, allowedRepoIds: [repositoryId], empty: false };
    }
    if (this.dataFilterService && user && typeof user === 'object' && user.id) {
      const scope = await this.dataFilterService.getScopedProjectAndRepoIds(
        user.id,
        organizationId,
        user.role as any,
      );
      if (!scope.isOrgScoped) {
        if (scope.repositoryIds.length === 0) {
          return { empty: true };
        }
        return { allowedRepoIds: scope.repositoryIds, empty: false };
      }
    }
    return { empty: false };
  }

  /**
   * Get all debt items with pagination and filters
   * GET /api/debt
   */
  @Get()
  @ApiOperation({ summary: 'Get all debt items with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of debt items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
    @Query() filters: DebtFiltersDto,
  ) {
    if (!organizationId) {
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
    const scope = await this.resolveAllowedRepositoryIds(organizationId, user, filters.repositoryId);
    if (scope.empty) {
      return { data: [], total: 0, page: filters.page || 1, limit: filters.limit || 20, totalPages: 0 };
    }
    return await this.debtService.findAll(organizationId, filters, scope.allowedRepoIds);
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
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
    @Query('repositoryId') repositoryId?: string,
  ) {
    if (!organizationId) return [];
    const scope = await this.resolveAllowedRepositoryIds(organizationId, user, repositoryId);
    if (scope.empty) return [];
    return await this.debtService.getHotSpots(organizationId, scope.repositoryId, scope.allowedRepoIds);
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
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
    @Query('days') days?: number,
    @Query('repositoryId') repositoryId?: string,
    @Query('teamId') teamId?: string,
  ) {
    if (!organizationId) return { trends: [], velocity: 0, status: 'STABLE' };
    if (teamId && this.dataFilterService && user && typeof user === 'object' && user.id) {
      await this.dataFilterService.verifyTeamAccess(teamId, organizationId, user);
    }
    const scope = await this.resolveAllowedRepositoryIds(organizationId, user, repositoryId);
    if (scope.empty) return { trends: [], velocity: 0, status: 'STABLE' };
    return await this.debtService.getTrends(organizationId, days || 30, scope.repositoryId, teamId, scope.allowedRepoIds);
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
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
    @Query('repositoryId') repositoryId?: string,
    @Query('limit') limit?: number,
  ) {
    if (!organizationId) return [];
    const scope = await this.resolveAllowedRepositoryIds(organizationId, user, repositoryId);
    if (scope.empty) return [];
    return await this.debtService.getRecommendations(organizationId, scope.repositoryId, limit || 10, scope.allowedRepoIds);
  }

  /**
   * Get debt attribution by developer
   * GET /api/debt/attribution
   */
  @Get('attribution')
  @ApiOperation({ summary: 'Get debt attribution by developer' })
  @ApiResponse({ status: 200, description: 'Debt introduced and resolved per developer' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAttribution(
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    if (!organizationId) return [];
    let allowedDeveloperIds: string[] | null = null;
    let allowedRepoIds: string[] | undefined;

    if (this.dataFilterService && user && typeof user === 'object' && user.id) {
      const scope = await this.dataFilterService.getScopedProjectAndRepoIds(
        user.id,
        organizationId,
        user.role as any,
      );
      if (!scope.isOrgScoped) {
        if (scope.repositoryIds.length === 0) return [];
        allowedRepoIds = scope.repositoryIds;

        if (user.role === Role.DEVELOPER) {
          allowedDeveloperIds = [user.id];
        } else if (user.role === Role.TEAM_LEAD) {
          const teamMembers = await this.debtService.getTeamMemberUserIds(organizationId, user.id);
          allowedDeveloperIds = teamMembers;
        }
      }
    }
    return await this.debtService.getAttribution(organizationId, allowedDeveloperIds, allowedRepoIds);
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
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
    @Query('repositoryId') repositoryId?: string,
    @Query('threshold') threshold?: number,
  ) {
    if (!organizationId) return [];
    const scope = await this.resolveAllowedRepositoryIds(organizationId, user, repositoryId);
    if (scope.empty) return [];
    return await this.debtService.getModuleDebtScore(
      organizationId,
      scope.repositoryId,
      threshold || 10,
      scope.allowedRepoIds,
    );
  }

  /**
   * Mark a debt item as resolved
   * POST /api/debt/:id/resolve
   */
  @Post(':id/resolve')
  @ApiOperation({ summary: 'Mark a technical debt item as resolved' })
  @ApiParam({ name: 'id', description: 'Debt item ID' })
  @ApiResponse({ status: 200, description: 'Debt item resolved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Debt item not found' })
  async resolve(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser() user: any,
    @GetOrganization() organizationId: string,
  ) {
    const existing = await this.debtService.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundException(`Debt item with ID ${id} not found`);
    }
    if (this.dataFilterService && user && typeof user === 'object' && existing.repositoryId) {
      await this.dataFilterService.verifyRepositoryAccess(existing.repositoryId, organizationId, user);
    }
    return await this.debtService.resolve(id, userId, undefined, organizationId);
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
  async findById(
    @Param('id') id: string,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    const debtItem = await this.debtService.findById(id, organizationId);
    if (!debtItem) {
      throw new NotFoundException(`Debt item with ID ${id} not found`);
    }
    if (this.dataFilterService && user && typeof user === 'object' && debtItem.repositoryId) {
      await this.dataFilterService.verifyRepositoryAccess(debtItem.repositoryId, organizationId, user);
    }
    return debtItem;
  }
}

import { Controller, Get, Post, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CommitsService } from './commits.service';
import { CommitFiltersDto, CommitStatsQueryDto, HeatmapQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import type { RequestUser } from '../auth/decorators/get-user.decorator';
import { PrismaService } from '../../prisma';

/**
 * Controller for commit endpoints
 */
@ApiTags('Commits')
@Controller('commits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommitsController {
  constructor(
    private readonly commitsService: CommitsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all commits with pagination and filters
   */
  @Get()
  @ApiOperation({ summary: 'Get all commits with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of commits',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to the requested organization',
  })
  async findAll(
    @Query() filters: CommitFiltersDto,
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: RequestUser,
  ) {
    const organizationId = filters.organizationId || orgId || (user as any)?.organizationId;

    if (!organizationId) {
      return {
        data: [],
        total: 0,
        page: filters.page || 1,
        limit: filters.pageSize || filters.limit || 20,
        totalPages: 0,
      };
    }

    // Verify user has access to the organization
    await this.verifyOrganizationAccess(organizationId, user.id);
    filters.organizationId = organizationId;

    // If repositoryId is provided, verify access through repository's organization
    if (filters.repositoryId) {
      const repository = await this.prisma.repository.findUnique({
        where: { id: filters.repositoryId },
        select: { organizationId: true },
      });
      if (repository) {
        await this.verifyOrganizationAccess(repository.organizationId, user.id);
      }
    }

    return this.commitsService.findAll(filters);
  }

  /**
   * Get commit statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get commit statistics' })
  @ApiResponse({
    status: 200,
    description: 'Commit statistics',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to the requested organization',
  })
  async getStats(
    @Query() query: CommitStatsQueryDto,
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: RequestUser,
  ) {
    const organizationId = query.organizationId || orgId || (user as any)?.organizationId;

    if (!organizationId) {
      return {
        totalCommits: 0,
        totalInsertions: 0,
        totalDeletions: 0,
        averageChurnRatio: 0,
        anomalyCount: 0,
        classifications: {},
        topAuthors: [],
      };
    }

    // Verify user has access to the organization
    await this.verifyOrganizationAccess(organizationId, user.id);
    query.organizationId = organizationId;

    // If repositoryId is provided, verify access through repository's organization
    if (query.repositoryId) {
      const repository = await this.prisma.repository.findUnique({
        where: { id: query.repositoryId },
        select: { organizationId: true },
      });
      if (repository) {
        await this.verifyOrganizationAccess(repository.organizationId, user.id);
      }
    }

    return this.commitsService.getStatistics(query);
  }

  /**
   * Get churn heatmap data for a repository
   */
  @Get('heatmap')
  @ApiOperation({ summary: 'Get churn heatmap data for a repository' })
  @ApiResponse({
    status: 200,
    description: 'Heatmap data with file churn information',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to the repository',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async getHeatmap(@Query() query: HeatmapQueryDto, @GetUser() user: RequestUser) {
    // Verify user has access to the repository's organization
    const repository = await this.prisma.repository.findUnique({
      where: { id: query.repositoryId },
      select: { organizationId: true },
    });

    if (repository) {
      await this.verifyOrganizationAccess(repository.organizationId, user.id);
    }

    return this.commitsService.getHeatmapData(query);
  }

  /**
   * Get commit by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get commit by ID' })
  @ApiParam({ name: 'id', description: 'Commit ID' })
  @ApiResponse({
    status: 200,
    description: 'Commit details with file changes',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to this commit',
  })
  @ApiResponse({
    status: 404,
    description: 'Commit not found',
  })
  async findOne(@Param('id') id: string, @GetUser() user: RequestUser) {
    const commit = await this.commitsService.findById(id);

    // Verify user has access to the commit's organization
    if (commit.repository?.organizationId) {
      await this.verifyOrganizationAccess(commit.repository.organizationId, user.id);
    }

    return commit;
  }

  /**
   * Re-attribute existing unattributed commits to developers
   */
  @Post('reattribute')
  @ApiOperation({ summary: 'Re-attribute existing unattributed commits to developers' })
  @ApiResponse({
    status: 200,
    description: 'Re-attribution completed',
  })
  async reattributeCommits(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: RequestUser,
    @Query('repositoryId') repositoryId?: string,
  ) {
    const organizationId = orgId || (user as any)?.organizationId;
    if (!organizationId) {
      return { updated: 0, developersDiscovered: 0 };
    }
    await this.verifyOrganizationAccess(organizationId, user.id);
    return this.commitsService.reattributeExistingCommits(organizationId, repositoryId);
  }

  /**
   * Verify user has access to an organization
   */
  private async verifyOrganizationAccess(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization');
    }
  }
}

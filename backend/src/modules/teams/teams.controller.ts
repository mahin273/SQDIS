import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { TeamMetricsQueryDto, TeamMetricsResponseDto } from './dto/team-metrics.dto';
import { TeamLeaderboardQueryDto, TeamLeaderboardResponseDto } from './dto/team-leaderboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { TeamLeadOrAdminGuard } from '../auth/guards/team-lead-or-admin.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationsService } from '../organizations/organizations.service';
import { Role } from '@prisma/client';
import { AuditLog } from '../audit/decorators/audit-log.decorator';

/**
 * Controller for team management
 */
@ApiTags('Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@SkipThrottle() // Skip rate limiting for teams endpoints (frequently accessed by dashboard)
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Create a new team
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'CREATE',
    resourceType: 'Team',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({
    status: 201,
    description: 'Team created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to create teams',
  })
  @ApiResponse({
    status: 409,
    description: 'Team with this name already exists',
  })
  async create(
    @Body() dto: CreateTeamDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required. Please select an organization.');
    }

    return this.teamsService.create(dto, organizationId);
  }

  /**
   * Get all teams for the current organization
   */
  @Get()
  @ApiOperation({ summary: 'Get all teams for the current organization' })
  @ApiResponse({
    status: 200,
    description: 'List of teams',
  })
  async findAll(
    @GetOrganization() organizationId: string,
    @GetUser() user: { id: string; role: Role },
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    return this.teamsService.findAll(organizationId, user.id, user.role);
  }

  /**
   * Get team leaderboard
   */
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get team leaderboard ranked by DQS' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiResponse({
    status: 200,
    description: 'Team leaderboard',
    type: TeamLeaderboardResponseDto,
  })
  async getLeaderboard(
    @Query() query: TeamLeaderboardQueryDto,
    @GetOrganization() organizationId: string,
  ): Promise<TeamLeaderboardResponseDto> {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    return this.teamsService.getLeaderboard(organizationId, query);
  }

  /**
   * Get team by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({
    status: 200,
    description: 'Team details',
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  async findOne(@Param('id') id: string, @GetOrganization() organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    await this.teamsService.verifyTeamAccess(id, '', organizationId);
    return this.teamsService.findById(id);
  }

  /**
   * Get team metrics
   */
  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get aggregated team metrics' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days for rolling metrics (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Team metrics',
    type: TeamMetricsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  async getMetrics(
    @Param('id') id: string,
    @Query() query: TeamMetricsQueryDto,
    @GetOrganization() organizationId: string,
  ): Promise<TeamMetricsResponseDto> {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    await this.teamsService.verifyTeamAccess(id, '', organizationId);
    return this.teamsService.getMetrics(id, query);
  }

  /**
   * Update team
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, TeamLeadOrAdminGuard)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Team',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Update team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({
    status: 200,
    description: 'Team updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to update this team',
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Team with this name already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    await this.teamsService.verifyTeamAccess(id, userId, organizationId);

    return this.teamsService.update(id, dto);
  }

  /**
   * Delete team (soft delete)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'DELETE',
    resourceType: 'Team',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({
    status: 204,
    description: 'Team deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to delete this team',
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  async delete(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    await this.teamsService.verifyTeamAccess(id, userId, organizationId);

    return this.teamsService.delete(id);
  }

  /**
   * Add member to team
   */
  @Post(':id/members')
  @UseGuards(JwtAuthGuard, TeamLeadOrAdminGuard, OrganizationGuard)
  @AuditLog({
    action: 'ADD_MEMBER',
    resourceType: 'Team',
    captureSnapshot: false,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Add member to team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({
    status: 201,
    description: 'Member added successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to add members',
  })
  @ApiResponse({
    status: 404,
    description: 'Team or user not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User is already a member of this team',
  })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    await this.teamsService.verifyTeamAccess(id, userId, organizationId);

    return this.teamsService.addMember(id, dto);
  }

  /**
   * Remove member from team
   */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, TeamLeadOrAdminGuard, OrganizationGuard)
  @AuditLog({
    action: 'REMOVE_MEMBER',
    resourceType: 'Team',
    captureSnapshot: false,
    includeRequestBody: false,
    includeResponseBody: false,
  })
  @ApiOperation({ summary: 'Remove member from team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'userId', description: 'User ID of the member to remove' })
  @ApiResponse({
    status: 204,
    description: 'Member removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove team lead',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to remove members',
  })
  @ApiResponse({
    status: 404,
    description: 'Team or membership not found',
  })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    await this.teamsService.verifyTeamAccess(id, userId, organizationId);

    return this.teamsService.removeMember(id, targetUserId);
  }

  /**
   * Assign team lead
   */
  @Patch(':id/lead')
  @ApiOperation({ summary: 'Assign team lead' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({
    status: 200,
    description: 'Team lead assigned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'User must be a team member to be assigned as lead',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to assign team lead',
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  async assignLead(
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    await this.teamsService.verifyTeamAccess(id, userId, organizationId);

    // Only OWNER and ADMIN can assign team lead
    await this.organizationsService.verifyUserRole(organizationId, userId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return this.teamsService.assignLead(id, dto.userId);
  }
}

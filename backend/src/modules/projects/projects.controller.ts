import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignRepositoryDto } from './dto/assign-repository.dto';
import { AssignTeamDto } from './dto/assign-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { OrganizationsService } from '../organizations/organizations.service';
import { Role } from '@prisma/client';
import { AuditLog } from '../audit/decorators/audit-log.decorator';

/**
 * Controller for project management
 */
@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Create a new project
   */
  @Post()
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'CREATE',
    resourceType: 'Project',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to create projects',
  })
  @ApiResponse({
    status: 409,
    description: 'Project with this name already exists',
  })
  async create(
    @Body() dto: CreateProjectDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    return this.projectsService.create(dto, organizationId);
  }

  /**
   * Get all projects for the current organization
   */
  @Get()
  @ApiOperation({ summary: 'Get all projects for the current organization' })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
  })
  async findAll(
    @GetOrganization() organizationId: string,
    @GetUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.findAll(organizationId, user.id, user.role);
  }

  /**
   * Get project by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async findOne(@Param('id') id: string, @GetOrganization() organizationId: string) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.findById(id);
  }

  /**
   * Get project metrics including commit breakdown, recent activity, and technical debt
   */
  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get project metrics' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project metrics',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async getMetrics(@Param('id') id: string, @GetOrganization() organizationId: string) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.getProjectMetrics(id);
  }

  /**
   * Get technical debt items for a project
   */
  @Get(':id/debt')
  @ApiOperation({ summary: 'Get technical debt items for a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Technical debt items',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async getTechnicalDebt(@Param('id') id: string, @GetOrganization() organizationId: string) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.getTechnicalDebt(id);
  }

  /**
   * Update project
   */
  @Patch(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Project',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to update this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Project with this name already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.update(id, dto);
  }

  /**
   * Delete project (soft delete)
   */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'DELETE',
    resourceType: 'Project',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 204,
    description: 'Project deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to delete this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async delete(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.delete(id);
  }

  /**
   * Assign repository to project
   */
  @Post(':id/repositories')
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Project',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Assign repository to project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Repository assigned successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to assign repositories',
  })
  @ApiResponse({
    status: 404,
    description: 'Project or repository not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Repository is already assigned to this project',
  })
  async assignRepository(
    @Param('id') id: string,
    @Body() dto: AssignRepositoryDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.assignRepository(id, dto.repositoryId, organizationId);
  }

  /**
   * Remove repository from project
   */
  @Delete(':id/repositories/:repoId')
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Project',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove repository from project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiParam({ name: 'repoId', description: 'Repository ID' })
  @ApiResponse({
    status: 204,
    description: 'Repository removed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to remove repositories',
  })
  @ApiResponse({
    status: 404,
    description: 'Project or repository assignment not found',
  })
  async removeRepository(
    @Param('id') id: string,
    @Param('repoId') repoId: string,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.removeRepository(id, repoId, organizationId);
  }

  /**
   * Assign team to project
   */
  @Post(':id/teams')
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Project',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Assign team to project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Team assigned successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to assign teams',
  })
  @ApiResponse({
    status: 404,
    description: 'Project or team not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Team is already assigned to this project',
  })
  async assignTeam(
    @Param('id') id: string,
    @Body() dto: AssignTeamDto,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.assignTeam(id, dto.teamId, organizationId);
  }

  /**
   * Remove team from project
   */
  @Delete(':id/teams/:teamId')
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Project',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove team from project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: 204,
    description: 'Team removed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to remove teams',
  })
  @ApiResponse({
    status: 404,
    description: 'Project or team assignment not found',
  })
  async removeTeam(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @GetUser('id') userId: string,
    @GetOrganization() organizationId: string,
  ) {
    await this.projectsService.verifyProjectAccess(id, organizationId);
    return this.projectsService.removeTeam(id, teamId, organizationId);
  }
}

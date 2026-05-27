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
import { ReleasesService } from './releases.service';
import { CreateReleaseDto } from './dto/create-release.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';
import { AssociateSprintDto } from './dto/release-sprint-association.dto';
import { ReleaseResponseDto, ReadinessScoreDto } from './dto/release-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { OrganizationsService } from '../organizations/organizations.service';
import { Role } from '@prisma/client';

/**
 * Controller for release management
 */
@ApiTags('Releases')
@Controller('releases')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReleasesController {
  constructor(
    private readonly releasesService: ReleasesService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Create a new release
   */
  @Post()
  @ApiOperation({ summary: 'Create a new release' })
  @ApiResponse({
    status: 201,
    description: 'Release created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to create releases',
  })
  @ApiResponse({
    status: 409,
    description: 'Release version already exists',
  })
  async create(
    @Body() dto: CreateReleaseDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    // Only OWNER and ADMIN can create releases
    await this.organizationsService.verifyUserRole(organizationId, userId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return this.releasesService.create(dto, organizationId);
  }

  /**
   * Get all releases for the current organization
   */
  @Get()
  @ApiOperation({ summary: 'Get all releases for the current organization' })
  @ApiResponse({
    status: 200,
    description: 'List of releases',
  })
  async findAll(@GetUser('organizationId') organizationId: string) {
    return this.releasesService.findAll(organizationId);
  }

  /**
   * Get release by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get release by ID with associated sprints' })
  @ApiParam({ name: 'id', description: 'Release ID' })
  @ApiResponse({
    status: 200,
    description: 'Release details with associated sprints',
    type: ReleaseResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Release not found',
  })
  async findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<ReleaseResponseDto> {
    await this.releasesService.verifyReleaseAccess(id, organizationId);
    return this.releasesService.findById(id);
  }

  /**
   * Update release
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update release' })
  @ApiParam({ name: 'id', description: 'Release ID' })
  @ApiResponse({
    status: 200,
    description: 'Release updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to update this release',
  })
  @ApiResponse({
    status: 404,
    description: 'Release not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Release version already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReleaseDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.releasesService.verifyReleaseAccess(id, organizationId);

    // Only OWNER and ADMIN can update releases
    await this.organizationsService.verifyUserRole(organizationId, userId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return this.releasesService.update(id, dto);
  }

  /**
   * Delete release (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete release' })
  @ApiParam({ name: 'id', description: 'Release ID' })
  @ApiResponse({
    status: 204,
    description: 'Release deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to delete this release',
  })
  @ApiResponse({
    status: 404,
    description: 'Release not found',
  })
  async delete(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.releasesService.verifyReleaseAccess(id, organizationId);

    // Only OWNER and ADMIN can delete releases
    await this.organizationsService.verifyUserRole(organizationId, userId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return this.releasesService.delete(id);
  }

  /**
   * Associate a sprint with a release
   */
  @Post(':id/sprints')
  @ApiOperation({ summary: 'Associate a sprint with a release' })
  @ApiParam({ name: 'id', description: 'Release ID' })
  @ApiResponse({
    status: 201,
    description: 'Sprint associated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission',
  })
  @ApiResponse({
    status: 404,
    description: 'Release or sprint not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Sprint is already associated with this release',
  })
  async associateSprint(
    @Param('id') releaseId: string,
    @Body() dto: AssociateSprintDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    // Only OWNER and ADMIN can associate sprints
    await this.organizationsService.verifyUserRole(organizationId, userId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return this.releasesService.associateSprint(releaseId, dto.sprintId, organizationId);
  }

  /**
   * Remove sprint association from a release
   */
  @Delete(':id/sprints/:sprintId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove sprint association from a release' })
  @ApiParam({ name: 'id', description: 'Release ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({
    status: 204,
    description: 'Sprint association removed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission',
  })
  @ApiResponse({
    status: 404,
    description: 'Release or sprint association not found',
  })
  async dissociateSprint(
    @Param('id') releaseId: string,
    @Param('sprintId') sprintId: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    // Only OWNER and ADMIN can remove sprint associations
    await this.organizationsService.verifyUserRole(organizationId, userId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return this.releasesService.dissociateSprint(releaseId, sprintId, organizationId);
  }

  /**
   * Get release readiness score
   */
  @Get(':id/readiness')
  @ApiOperation({ summary: 'Get release readiness score' })
  @ApiParam({ name: 'id', description: 'Release ID' })
  @ApiResponse({
    status: 200,
    description: 'Release readiness score with breakdown',
    type: ReadinessScoreDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Release not found',
  })
  async getReadiness(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<ReadinessScoreDto> {
    await this.releasesService.verifyReleaseAccess(id, organizationId);
    return this.releasesService.calculateReadiness(id);
  }
}

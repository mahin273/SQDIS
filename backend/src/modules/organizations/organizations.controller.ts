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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';
import { AuditLog } from '../audit/decorators/audit-log.decorator';

/**
 * Controller for organization management
 */
@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Create a new organization
   */
  @Post()
  @AuditLog({
    action: 'CREATE',
    resourceType: 'Organization',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Organization with this slug already exists',
  })
  async create(@Body() dto: CreateOrganizationDto, @GetUser('id') userId: string) {
    return this.organizationsService.create(dto, userId);
  }

  /**
   * Get all organizations for the current user
   */
  @Get()
  @ApiOperation({ summary: 'Get all organizations for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of organizations',
  })
  async findAll(@GetUser('id') userId: string) {
    return this.organizationsService.findAllForUser(userId);
  }

  /**
   * Get organization by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'Organization details',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to this organization',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  async findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    // Verify user is a member of the organization
    await this.organizationsService.verifyUserRole(id, userId, [
      Role.OWNER,
      Role.ADMIN,
      Role.TEAM_LEAD,
      Role.DEVELOPER,
    ]);

    return this.organizationsService.findById(id);
  }

  /**
   * Update organization settings
   */
  @Patch(':id')
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Organization',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to update this organization',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Organization with this slug already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @GetUser('id') userId: string,
  ) {
    // Only OWNER and ADMIN can update organization settings
    await this.organizationsService.verifyUserRole(id, userId, [Role.OWNER, Role.ADMIN]);

    return this.organizationsService.update(id, dto);
  }

  /**
   * Delete organization
   */
  @Delete(':id')
  @AuditLog({
    action: 'DELETE',
    resourceType: 'Organization',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({
    status: 204,
    description: 'Organization deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to delete this organization',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  async delete(@Param('id') id: string, @GetUser('id') userId: string) {
    // Only OWNER can delete organization
    await this.organizationsService.verifyUserRole(id, userId, [Role.OWNER]);

    return this.organizationsService.delete(id);
  }

  /**
   * Get organization members
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'Get organization members' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'List of organization members',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to this organization',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  async getMembers(@Param('id') id: string, @GetUser('id') userId: string) {
    // Verify user is a member of the organization
    await this.organizationsService.verifyUserRole(id, userId, [
      Role.OWNER,
      Role.ADMIN,
      Role.TEAM_LEAD,
      Role.DEVELOPER,
    ]);

    return this.organizationsService.getMembers(id);
  }

  /**
   * Invite a member to the organization
   */
  @Post(':id/invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'CREATE',
    resourceType: 'OrganizationInvitation',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Invite a member to the organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to invite members',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User is already a member or invitation already exists',
  })
  async inviteMember(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @GetUser('id') userId: string,
  ) {
    // Only OWNER and ADMIN can invite members
    await this.organizationsService.verifyUserRole(id, userId, [Role.OWNER, Role.ADMIN]);

    return this.organizationsService.createInvitation(id, dto.email);
  }

  /**
   * Accept an invitation to join an organization
   */
  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept an invitation to join an organization' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({
    status: 201,
    description: 'Invitation accepted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invitation has already been accepted',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User is already a member of this organization',
  })
  @ApiResponse({
    status: 410,
    description: 'Invitation has expired',
  })
  async acceptInvitation(@Param('token') token: string, @GetUser('id') userId: string) {
    return this.organizationsService.acceptInvitation(token, userId);
  }

  /**
   * Get invitation details by token
   */
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Get invitation details by token' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({
    status: 200,
    description: 'Invitation details',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  async getInvitation(@Param('token') token: string) {
    return this.organizationsService.getInvitationByToken(token);
  }

  /**
   * Resend an invitation
   */
  @Post(':id/invite/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'OrganizationInvitation',
    resourceIdParam: 'id',
    captureSnapshot: false,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({
    status: 201,
    description: 'Invitation resent successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to resend invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'No pending invitation found',
  })
  async resendInvitation(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @GetUser('id') userId: string,
  ) {
    // Only OWNER and ADMIN can resend invitations
    await this.organizationsService.verifyUserRole(id, userId, [Role.OWNER, Role.ADMIN]);

    return this.organizationsService.resendInvitation(id, dto.email);
  }

  /**
   * Update member role
   */
  @Patch(':id/members/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'OrganizationMember',
    resourceIdParam: 'userId',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Update member role' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'userId', description: 'User ID of the member to update' })
  @ApiResponse({
    status: 200,
    description: 'Member role updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot demote the last owner',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to update roles',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization or member not found',
  })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @GetUser('id') requestingUserId: string,
  ) {
    // Only OWNER can update member roles
    await this.organizationsService.verifyUserRole(id, requestingUserId, [Role.OWNER]);

    return this.organizationsService.updateMemberRole(id, targetUserId, dto.role, requestingUserId);
  }

  /**
   * Remove member from organization
   */
  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'DELETE',
    resourceType: 'OrganizationMember',
    resourceIdParam: 'userId',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'userId', description: 'User ID of the member to remove' })
  @ApiResponse({
    status: 204,
    description: 'Member removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove the last owner',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to remove members',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization or member not found',
  })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @GetUser('id') requestingUserId: string,
  ) {
    // Only OWNER and ADMIN can remove members
    await this.organizationsService.verifyUserRole(id, requestingUserId, [Role.OWNER, Role.ADMIN]);

    return this.organizationsService.removeMember(id, targetUserId, requestingUserId);
  }
}

/* eslint-disable */
import { Controller, Get, Post, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto, UpdateOrganizationDto, InviteMemberDto, UpdateMemberRoleDto } from './dto/index.js';
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * POST /organizations
   * Creates a new organization — caller becomes the OWNER
   */
  @Post()
  create(
    @Body() dto: CreateOrganizationDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.create(dto, userId);
  }

  /**
   * GET /organizations
   * Returns all organizations the current user belongs to
   */
  @Get()
  findAll(@Headers('x-user-id') userId: string) {
    return this.organizationsService.findAllForUser(userId);
  }

  /**
   * GET /organizations/:id
   * Returns a single organization by ID (user must be a member)
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.findById(id, userId);
  }

  /**
   * PATCH /organizations/:id
   * Updates organization name or logo (OWNER or ADMIN only)
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.update(id, dto, userId);
  }

  /**
   * DELETE /organizations/:id
   * Permanently deletes an organization (OWNER only)
   */
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.delete(id, userId);
  }

  /**
   * GET /organizations/:id/members
   * Returns all members of an organization (members only)
   */
  @Get(':id/members')
  getMembers(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.getMembers(id, userId);
  }

  /**
   * POST /organizations/:id/invite
   * Invites a new member by email (OWNER or ADMIN only)
   */
  @Post(':id/invite')
  invite(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.createInvitation(id, dto, userId);
  }

  /**
   * POST /organizations/invitations/:token/accept
   * Accepts an invitation using a token
   */
  @Post('invitations/:token/accept')
  acceptInvitation(
    @Param('token') token: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.acceptInvitation(token, userId);
  }
/**
   * PATCH /organizations/:id/members/:targetUserId
   * Updates the role of a member. Only OWNER or ADMIN can do this.
   */
  @Patch(':id/members/:targetUserId')
  updateMemberRole(
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.updateMemberRole(id, targetUserId, dto, userId);
  }

  /**
   * DELETE /organizations/:id/members/:targetUserId
   * Removes a member from the organization. Only OWNER or ADMIN can do this.
   */
  @Delete(':id/members/:targetUserId')
  removeMember(
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.organizationsService.removeMember(id, targetUserId, userId);
  }
}

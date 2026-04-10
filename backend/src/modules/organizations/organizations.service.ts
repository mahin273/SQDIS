import { Injectable, NotFoundException, ConflictException, ForbiddenException, GoneException } from '@nestjs/common';
import { CreateOrganizationDto, UpdateOrganizationDto, InviteMemberDto, UpdateMemberRoleDto, Role } from './dto/index.js';
import { randomBytes } from 'crypto';

// Interface representing an Organization
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interface representing an Organization Member
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  joinedAt: Date;
}

// Interface representing an Invitation
export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

@Injectable()
export class OrganizationsService {
  // In-memory storage (will be replaced with Prisma later)
  private organizations: Organization[] = [];
  private members: OrganizationMember[] = [];
  private invitations: Invitation[] = [];

  /**
   * Creates a new organization and assigns the creator as OWNER
   * @param dto - Organization creation data
   * @param userId - ID of the user creating the organization
   */
  create(dto: CreateOrganizationDto, userId: string): Organization {
    // Check if slug is already taken
    const existing = this.organizations.find(o => o.slug === dto.slug.toLowerCase());
    if (existing) {
      throw new ConflictException('Organization with this slug already exists');
    }

    // Create the new organization
    const org: Organization = {
      id: randomBytes(8).toString('hex'),
      name: dto.name,
      slug: dto.slug.toLowerCase(),
      logoUrl: dto.logoUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.organizations.push(org);

    // Automatically make the creator the OWNER
    const member: OrganizationMember = {
      id: randomBytes(8).toString('hex'),
      organizationId: org.id,
      userId,
      role: Role.OWNER,
      joinedAt: new Date(),
    };
    this.members.push(member);

    return org;
  }

  /**
   * Returns all organizations the user is a member of
   * @param userId - ID of the current user
   */
  findAllForUser(userId: string): Organization[] {
    // Get all organization IDs where this user is a member
    const userOrgIds = this.members
      .filter(m => m.userId === userId)
      .map(m => m.organizationId);

    return this.organizations.filter(o => userOrgIds.includes(o.id));
  }

  /**
   * Finds a single organization by ID
   * @param id - Organization ID
   * @param userId - ID of the current user (must be a member)
   */
  findById(id: string, userId: string): Organization {
    const org = this.organizations.find(o => o.id === id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Make sure the user is a member
    const isMember = this.members.some(m => m.organizationId === id && m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    return org;
  }

  /**
   * Updates organization details (name or logo)
   * @param id - Organization ID
   * @param dto - Fields to update
   * @param userId - Must be OWNER or ADMIN
   */
  update(id: string, dto: UpdateOrganizationDto, userId: string): Organization {
    const org = this.organizations.find(o => o.id === id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Only OWNER or ADMIN can update
    this.verifyUserRole(id, userId, [Role.OWNER, Role.ADMIN]);

    // Apply updates
    if (dto.name) org.name = dto.name;
    if (dto.logoUrl) org.logoUrl = dto.logoUrl;
    org.updatedAt = new Date();

    return org;
  }

  /**
   * Deletes an organization permanently
   * @param id - Organization ID
   * @param userId - Must be OWNER
   */
  delete(id: string, userId: string): void {
    const orgIndex = this.organizations.findIndex(o => o.id === id);
    if (orgIndex === -1) {
      throw new NotFoundException('Organization not found');
    }

    // Only OWNER can delete the organization
    this.verifyUserRole(id, userId, [Role.OWNER]);

    // Remove organization and all related data
    this.organizations.splice(orgIndex, 1);
    this.members = this.members.filter(m => m.organizationId !== id);
    this.invitations = this.invitations.filter(i => i.organizationId !== id);
  }

  /**
   * Returns all members of an organization
   * @param id - Organization ID
   * @param userId - Must be a member
   */
  getMembers(id: string, userId: string): OrganizationMember[] {
    this.findById(id, userId);
    return this.members.filter(m => m.organizationId === id);
  }

  /**
   * Sends an invitation to join the organization
   * @param id - Organization ID
   * @param dto - Contains the email to invite
   * @param userId - Must be OWNER or ADMIN
   */
  createInvitation(id: string, dto: InviteMemberDto, userId: string): Invitation {
    this.findById(id, userId);

    // Only OWNER or ADMIN can invite members
    this.verifyUserRole(id, userId, [Role.OWNER, Role.ADMIN]);

    // Create invitation with 7-day expiry
    const invitation: Invitation = {
      id: randomBytes(8).toString('hex'),
      organizationId: id,
      email: dto.email,
      token: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };
    this.invitations.push(invitation);

    return invitation;
  }

  /**
   * Accepts a pending invitation using a token
   * @param token - Unique invitation token
   * @param userId - ID of the user accepting
   */
  acceptInvitation(token: string, userId: string): OrganizationMember {
    const invitation = this.invitations.find(i => i.token === token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      throw new GoneException('Invitation has expired');
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      throw new ConflictException('Invitation already accepted');
    }

    // Check if user is already a member
    const alreadyMember = this.members.some(
      m => m.organizationId === invitation.organizationId && m.userId === userId
    );
    if (alreadyMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Mark invitation as accepted
    invitation.acceptedAt = new Date();

    // Add user as DEVELOPER (default role)
    const member: OrganizationMember = {
      id: randomBytes(8).toString('hex'),
      organizationId: invitation.organizationId,
      userId,
      role: Role.DEVELOPER,
      joinedAt: new Date(),
    };
    this.members.push(member);

    return member;
  }

  /**
   * Updates the role of a member in the organization
   * @param id - Organization ID
   * @param targetUserId - User whose role is being changed
   * @param dto - Contains the new role
   * @param userId - Must be OWNER or ADMIN
   */
  updateMemberRole(id: string, targetUserId: string, dto: UpdateMemberRoleDto, userId: string): OrganizationMember {
    // Only OWNER or ADMIN can change roles
    this.verifyUserRole(id, userId, [Role.OWNER, Role.ADMIN]);

    const member = this.members.find(m => m.organizationId === id && m.userId === targetUserId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Prevent demoting the last OWNER
    if (member.role === Role.OWNER && dto.role !== Role.OWNER) {
      const ownerCount = this.members.filter(m => m.organizationId === id && m.role === Role.OWNER).length;
      if (ownerCount === 1) {
        throw new ForbiddenException('Cannot demote the last owner of the organization');
      }
    }

    member.role = dto.role;
    return member;
  }

  /**
   * Removes a member from the organization
   * @param id - Organization ID
   * @param targetUserId - User to remove
   * @param userId - Must be OWNER or ADMIN
   */
  removeMember(id: string, targetUserId: string, userId: string): void {
    // Only OWNER or ADMIN can remove members
    this.verifyUserRole(id, userId, [Role.OWNER, Role.ADMIN]);

    // Users cannot remove themselves
    if (targetUserId === userId) {
      throw new ForbiddenException('You cannot remove yourself from the organization');
    }

    const memberIndex = this.members.findIndex(
      m => m.organizationId === id && m.userId === targetUserId
    );
    if (memberIndex === -1) {
      throw new NotFoundException('Member not found');
    }

    this.members.splice(memberIndex, 1);
  }

  /**
   * Checks if a user has the required role in an organization
   * Throws ForbiddenException if the user does not have permission
   * @param orgId - Organization ID
   * @param userId - User to check
   * @param allowedRoles - List of roles that are allowed
   */
  private verifyUserRole(orgId: string, userId: string, allowedRoles: Role[]): void {
    const member = this.members.find(m => m.organizationId === orgId && m.userId === userId);
    if (!member || !allowedRoles.includes(member.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
  }
}
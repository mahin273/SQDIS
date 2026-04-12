/* eslint-disable */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from "../../prisma/prisma.service.js";
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/index.js';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Response type for organization data
 */
export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response type for organization with member count
 */
export interface OrganizationWithMemberCount extends OrganizationResponse {
  memberCount: number;
}

/**
 * Response type for organization member
 */
export interface OrganizationMemberResponse {
  id: string;
  userId: string;
  role: Role;
  joinedAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

/**
 * Response type for invitation
 */
export interface InvitationResponse {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  organizationId: string;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    // private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Create a new organization
   * Validates: Requirements 0.1.2, 0.1.3, 0.1.4, 0.1.5
   */
  async create(dto: CreateOrganizationDto, ownerId: string): Promise<OrganizationResponse> {
    // Check if slug already exists (Requirement 0.1.5)
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });

    if (existingOrg) {
      throw new ConflictException(`Organization with slug '${dto.slug}' already exists`);
    }

    // Create organization and assign creator as OWNER (Requirement 0.1.3)
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        members: {
          create: {
            userId: ownerId,
            role: Role.OWNER,
          },
        },
      },
    });

    return this.mapToResponse(organization);
  }

  /**
   * Find organization by ID
   * Validates: Requirements 0.4.1
   */
  async findById(id: string): Promise<OrganizationResponse> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    return this.mapToResponse(organization);
  }

  /**
   * Find organization by slug
   */
  async findBySlug(slug: string): Promise<OrganizationResponse> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with slug '${slug}' not found`);
    }

    return this.mapToResponse(organization);
  }

  /**
   * Update organization settings
   * Validates: Requirements 0.4.1, 0.4.2
   */
  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationResponse> {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    // If slug is being updated, check for uniqueness
    if (dto.slug && dto.slug.toLowerCase() !== existingOrg.slug) {
      const slugExists = await this.prisma.organization.findUnique({
        where: { slug: dto.slug.toLowerCase() },
      });

      if (slugExists) {
        throw new ConflictException(`Organization with slug '${dto.slug}' already exists`);
      }
    }

    // Update organization
    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug.toLowerCase() }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      },
    });

    return this.mapToResponse(organization);
  }

  /**
   * Delete organization (cascade deletes all related data)
   * Validates: Requirements 0.5.5
   */
  async delete(id: string): Promise<void> {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    // Delete organization (cascade will handle related data)
    await this.prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * Get all organizations for a user
   */
  async findAllForUser(userId: string): Promise<OrganizationWithMemberCount[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    return memberships.map((membership) => ({
      ...this.mapToResponse(membership.organization),
      memberCount: membership.organization._count.members,
    }));
  }

  /**
   * Check if user is a member of the organization
   * Validates: Requirements 0.5.2
   */
  async isUserMember(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return !!membership;
  }

  /**
   * Get user's role in organization
   */
  async getUserRole(organizationId: string, userId: string): Promise<Role | null> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return membership?.role ?? null;
  }

  /**
   * Verify user has required role or higher
   * Validates: Requirements 0.5.2, 0.5.4
   */
  async verifyUserRole(
    organizationId: string,
    userId: string,
    requiredRoles: Role[],
  ): Promise<void> {
    const role = await this.getUserRole(organizationId, userId);

    if (!role) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
  }

  /**
   * Get organization members
   * Validates: Requirements 0.2.5
   */
  async getMembers(organizationId: string): Promise<OrganizationMemberResponse[]> {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${organizationId}' not found`);
    }

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: member.user,
    }));
  }

  /**
   * Create invitation with 7-day expiry token
   * Validates: Requirements 0.2.1, 0.2.4
   */
  async createInvitation(organizationId: string, email: string): Promise<InvitationResponse> {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${organizationId}' not found`);
    }

    // Check if user is already a member (Requirement 0.2.4)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: email.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new ConflictException('An active invitation already exists for this email');
    }

    // Generate secure token and set 7-day expiry (Requirement 0.2.1)
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email: email.toLowerCase(),
        token,
        expiresAt,
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      organizationId: invitation.organizationId,
    };
  }

  /**
   * Accept invitation and add user to organization
   * Validates: Requirements 0.2.2, 0.2.3
   */
  async acceptInvitation(token: string, userId: string): Promise<OrganizationMemberResponse> {
    // Find invitation by token
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if invitation is already accepted
    if (invitation.acceptedAt) {
      throw new BadRequestException('Invitation has already been accepted');
    }

    // Check if invitation is expired (Requirement 0.2.3)
    if (invitation.expiresAt < new Date()) {
      throw new GoneException('Invitation has expired. Please request a new invitation.');
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Create membership with DEVELOPER role (Requirement 0.2.2) and mark invitation as accepted
    const [membership] = await this.prisma.$transaction([
      this.prisma.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: Role.DEVELOPER,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return {
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt,
      user: membership.user,
    };
  }

  /**
   * Resend invitation (creates new token with fresh expiry)
   * Validates: Requirements 0.2.3
   */
  async resendInvitation(organizationId: string, email: string): Promise<InvitationResponse> {
    // Find existing invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: email.toLowerCase(),
        acceptedAt: null,
      },
    });

    if (!existingInvitation) {
      throw new NotFoundException('No pending invitation found for this email');
    }

    // Generate new token and expiry
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.update({
      where: { id: existingInvitation.id },
      data: {
        token,
        expiresAt,
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      organizationId: invitation.organizationId,
    };
  }

  /**
   * Update member role
   * Validates: Requirements 0.3.1
   */
  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    newRole: Role,
    requestingUserId: string,
  ): Promise<OrganizationMemberResponse> {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${organizationId}' not found`);
    }

    // Find the target membership
    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Prevent changing own role
    if (targetUserId === requestingUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    // Prevent demoting the last OWNER
    if (targetMembership.role === Role.OWNER && newRole !== Role.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: {
          organizationId,
          role: Role.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot demote the last owner. Assign another owner first.');
      }
    }

    // Store old role for audit logging
    const oldRole = targetMembership.role;

    // Update the role
    const updatedMembership = await this.prisma.organizationMember.update({
      where: { id: targetMembership.id },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Log role change to audit log 
    // await this.auditLogService.logRoleChange({
    //   userId: requestingUserId,
    //   targetUserId,
    //   organizationId,
    //   oldRole,
    //   newRole,
    // });

    return {
      id: updatedMembership.id,
      userId: updatedMembership.userId,
      role: updatedMembership.role,
      joinedAt: updatedMembership.joinedAt,
      user: updatedMembership.user,
    };
  }

  /**
   * Remove member from organization
   * Validates: Requirements 0.2 (implicit - member management)
   */
  async removeMember(
    organizationId: string,
    targetUserId: string,
    requestingUserId: string,
  ): Promise<void> {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${organizationId}' not found`);
    }

    // Find the target membership
    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Prevent removing self (use leave organization instead)
    if (targetUserId === requestingUserId) {
      throw new ForbiddenException('You cannot remove yourself. Use leave organization instead.');
    }

    // Prevent removing the last OWNER
    if (targetMembership.role === Role.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: {
          organizationId,
          role: Role.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner. Assign another owner first.');
      }
    }

    // Remove the membership
    await this.prisma.organizationMember.delete({
      where: { id: targetMembership.id },
    });
  }

  /**
   * Get invitation by token (for acceptance flow)
   */
  async getInvitationByToken(
    token: string,
  ): Promise<InvitationResponse & { organization: OrganizationResponse }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      organizationId: invitation.organizationId,
      organization: this.mapToResponse(invitation.organization),
    };
  }

  /**
   * Map Prisma organization to response type
   */
  private mapToResponse(organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): OrganizationResponse {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logoUrl: organization.logoUrl,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }
}

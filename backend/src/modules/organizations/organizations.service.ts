// Organizations Service - Fixed timestamp error
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  GoneException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditLogService } from '../audit/services/audit-log.service';
import { EmailQueueService } from '../notifications/email';

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
  role?: Role;
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
  status: 'ACTIVE' | 'INVITED' | 'UNINVITED';
  invitationId?: string | null;
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

/**
 * Response type for discovered repository contributor
 */
export interface RepositoryContributorResponse {
  email: string;
  name: string;
  commitCount: number;
  lastCommittedAt: Date | null;
  repositories: string[];
  isMember: boolean;
  isInvited: boolean;
  memberRole?: Role | null;
  invitationId?: string | null;
  userId?: string | null;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Optional() private readonly emailQueueService?: EmailQueueService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Create a new organization
   */
  async create(dto: CreateOrganizationDto, ownerId: string): Promise<OrganizationResponse> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });

    if (existingOrg) {
      throw new ConflictException(`Organization with slug '${dto.slug}' already exists`);
    }

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
      role: membership.role,
      memberCount: membership.organization._count.members,
    }));
  }

  /**
   * Check if user is a member of the organization
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
            passwordHash: true,
            githubId: true,
            googleId: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const pendingInvitations = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    const invitationMap = new Map<string, string>();
    for (const inv of pendingInvitations) {
      invitationMap.set(inv.email.toLowerCase().trim(), inv.id);
    }

    return members.map((member) => {
      const u = member.user;
      const isActivated = !!(u.passwordHash || u.githubId || u.googleId);
      const pendingInvitationId = invitationMap.get(u.email.toLowerCase().trim()) || null;

      let status: 'ACTIVE' | 'INVITED' | 'UNINVITED' = 'ACTIVE';
      if (!isActivated) {
        status = pendingInvitationId ? 'INVITED' : 'UNINVITED';
      }

      return {
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        status,
        invitationId: pendingInvitationId,
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          avatarUrl: u.avatarUrl,
        },
      };
    });
  }

  /**
   * Create invitation with 7-day expiry token and queue email dispatch
   */
  async createInvitation(
    organizationId: string,
    email: string,
    inviterUserId?: string,
  ): Promise<InvitationResponse> {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${organizationId}' not found`);
    }

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
        const isActivated = !!(existingUser.passwordHash || existingUser.githubId || existingUser.googleId);
        if (isActivated) {
          throw new ConflictException('User is already an active member of this organization');
        }
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

    // Queue email invitation
    if (this.emailQueueService) {
      try {
        let inviterName = 'An administrator';
        let inviterEmail: string | undefined;

        if (inviterUserId) {
          const inviter = await this.prisma.user.findUnique({
            where: { id: inviterUserId },
            select: { name: true, email: true },
          });
          if (inviter?.name && inviter.name.trim()) {
            inviterName = inviter.name.trim();
          } else if (inviter?.email) {
            inviterName = inviter.email;
          }
          inviterEmail = inviter?.email;
        } else {
          const ownerMember = await this.prisma.organizationMember.findFirst({
            where: { organizationId, role: Role.OWNER },
            include: { user: { select: { name: true, email: true } } },
          });
          if (ownerMember?.user?.name && ownerMember.user.name.trim()) {
            inviterName = ownerMember.user.name.trim();
          } else if (ownerMember?.user?.email) {
            inviterName = ownerMember.user.email;
          }
          inviterEmail = ownerMember?.user?.email;
        }

        const frontendUrl =
          this.configService?.get<string>('FRONTEND_URL') ||
          process.env.FRONTEND_URL ||
          'http://localhost:5173';
        const invitationUrl = `${frontendUrl}/invitations/${token}`;

        await this.emailQueueService.queueInvitationEmail(invitation.email, {
          inviterName,
          inviterEmail,
          organizationName: existingOrg.name,
          invitationUrl,
          expiresIn: '7 days',
          recipientEmail: invitation.email,
        });
        this.logger.log(
          `Queued invitation email for ${invitation.email} to join ${existingOrg.name}`,
        );
      } catch (emailError) {
        this.logger.warn(
          `Failed to queue invitation email for ${invitation.email}: ${
            emailError instanceof Error ? emailError.message : String(emailError)
          }`,
        );
      }
    }

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
   * Get all pending invitations for an organization
   */
  async getInvitations(organizationId: string): Promise<InvitationResponse[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      organizationId: invitation.organizationId,
    }));
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.prisma.invitation.delete({
      where: { id: invitationId },
    });
  }

  /**
   * Accept invitation and add user to organization
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

    let membership: any;

    if (existingMembership) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      membership = await this.prisma.organizationMember.findUnique({
        where: { id: existingMembership.id },
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
    } else {
      const [createdMembership] = await this.prisma.$transaction([
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
      membership = createdMembership;
    }

    // Attribute any unmapped commits with this email to the user
    try {
      await this.prisma.commit.updateMany({
        where: {
          authorEmail: invitation.email.toLowerCase(),
          developerId: null,
        },
        data: {
          developerId: userId,
        },
      });

      await this.prisma.unmappedEmail.deleteMany({
        where: {
          organizationId: invitation.organizationId,
          email: invitation.email.toLowerCase(),
        },
      });
    } catch (attributionErr) {
      this.logger.warn(`Commit attribution skipped during invitation accept: ${attributionErr}`);
    }

    return {
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt,
      status: 'ACTIVE',
      invitationId: null,
      user: membership.user,
    };
  }

  /**
   * Resend invitation (creates new token with fresh expiry and re-queues email)
   */
  async resendInvitation(
    organizationId: string,
    email: string,
    inviterUserId?: string,
  ): Promise<InvitationResponse> {
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

    if (this.emailQueueService) {
      try {
        const org = await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        });

        let inviterName = org?.name || 'An administrator';
        let inviterEmail: string | undefined;

        if (inviterUserId) {
          const inviter = await this.prisma.user.findUnique({
            where: { id: inviterUserId },
            select: { name: true, email: true },
          });
          if (inviter?.name && inviter.name.trim()) {
            inviterName = inviter.name.trim();
          } else if (inviter?.email) {
            inviterName = inviter.email;
          }
          inviterEmail = inviter?.email;
        } else {
          const ownerMember = await this.prisma.organizationMember.findFirst({
            where: { organizationId, role: Role.OWNER },
            include: { user: { select: { name: true, email: true } } },
          });
          if (ownerMember?.user?.name && ownerMember.user.name.trim()) {
            inviterName = ownerMember.user.name.trim();
          } else if (ownerMember?.user?.email) {
            inviterName = ownerMember.user.email;
          }
          inviterEmail = ownerMember?.user?.email;
        }

        const frontendUrl =
          this.configService?.get<string>('FRONTEND_URL') ||
          process.env.FRONTEND_URL ||
          'http://localhost:5173';
        const invitationUrl = `${frontendUrl}/invitations/${token}`;

        await this.emailQueueService.queueInvitationEmail(invitation.email, {
          inviterName,
          inviterEmail,
          organizationName: org?.name || 'Organization',
          invitationUrl,
          expiresIn: '7 days',
          recipientEmail: invitation.email,
        });
        this.logger.log(`Resent invitation email to ${invitation.email} for ${org?.name}`);
      } catch (err) {
        this.logger.warn(
          `Failed to queue resent invitation email to ${invitation.email}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

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
    let targetMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      targetMembership = await this.prisma.organizationMember.findFirst({
        where: {
          id: targetUserId,
          organizationId,
        },
      });
    }

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Prevent changing own role
    if (targetMembership.userId === requestingUserId) {
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

    await this.auditLogService.logRoleChange({
      userId: requestingUserId,
      targetUserId: targetMembership.userId,
      organizationId,
      oldRole,
      newRole,
    });

    return {
      id: updatedMembership.id,
      userId: updatedMembership.userId,
      role: updatedMembership.role,
      joinedAt: updatedMembership.joinedAt,
      status: 'ACTIVE',
      user: updatedMembership.user,
    };
  }

  /**
   * Remove member from organization
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
    let targetMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      targetMembership = await this.prisma.organizationMember.findFirst({
        where: {
          id: targetUserId,
          organizationId,
        },
      });
    }

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Prevent removing self (use leave organization instead)
    if (targetMembership.userId === requestingUserId) {
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
   * Get discovered repository contributors across enabled repositories for an organization
   */
  async getRepositoryContributors(organizationId: string): Promise<RepositoryContributorResponse[]> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${organizationId}' not found`);
    }

    // 1. Find all enabled repositories for this organization
    const repositories = await this.prisma.repository.findMany({
      where: { organizationId, isEnabled: true },
      select: { id: true, name: true, fullName: true },
    });

    if (!repositories.length) {
      return [];
    }

    const repoMap = new Map<string, string>(repositories.map((r) => [r.id, r.name]));
    const repoIds = repositories.map((r) => r.id);

    // 2. Query all commits for enabled repositories
    const commits = await this.prisma.commit.findMany({
      where: { repositoryId: { in: repoIds } },
      select: {
        authorEmail: true,
        authorName: true,
        committedAt: true,
        repositoryId: true,
      },
      orderBy: { committedAt: 'desc' },
    });

    // 3. Aggregate contributors by lowercase email
    const contributorMap = new Map<
      string,
      {
        email: string;
        name: string;
        commitCount: number;
        lastCommittedAt: Date | null;
        repositories: Set<string>;
      }
    >();

    for (const commit of commits) {
      if (!commit.authorEmail) continue;
      const email = commit.authorEmail.toLowerCase().trim();
      const repoName = repoMap.get(commit.repositoryId) || 'Repository';
      const existing = contributorMap.get(email);

      if (existing) {
        existing.commitCount += 1;
        existing.repositories.add(repoName);
        if (!existing.lastCommittedAt || commit.committedAt > existing.lastCommittedAt) {
          existing.lastCommittedAt = commit.committedAt;
          if (commit.authorName && commit.authorName.trim()) {
            existing.name = commit.authorName;
          }
        }
      } else {
        contributorMap.set(email, {
          email,
          name: commit.authorName || email.split('@')[0],
          commitCount: 1,
          lastCommittedAt: commit.committedAt,
          repositories: new Set([repoName]),
        });
      }
    }

    // Also include any recorded unmapped emails if not yet collected
    try {
      const unmapped = await this.prisma.unmappedEmail.findMany({
        where: { organizationId },
      });
      for (const u of unmapped) {
        const email = u.email.toLowerCase().trim();
        const existing = contributorMap.get(email);
        if (!existing) {
          contributorMap.set(email, {
            email,
            name: u.authorName || email.split('@')[0],
            commitCount: u.commitCount,
            lastCommittedAt: u.lastSeenAt,
            repositories: new Set(repositories.map((r) => r.name)),
          });
        }
      }
    } catch (unmappedErr) {
      this.logger.debug(`Could not query unmapped_emails table: ${unmappedErr}`);
    }

    // 4. Fetch existing organization members (including verified aliases)
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            githubId: true,
            googleId: true,
            emailAliases: {
              select: { email: true, isVerified: true },
            },
          },
        },
      },
    });

    const memberMap = new Map<string, { role: Role; userId: string; name: string; isRealAccount: boolean }>();
    for (const m of members) {
      const isRealAccount = !!(m.user?.passwordHash || m.user?.githubId || m.user?.googleId);
      if (m.user?.email) {
        memberMap.set(m.user.email.toLowerCase().trim(), {
          role: m.role,
          userId: m.user.id,
          name: m.user.name || '',
          isRealAccount,
        });
      }
      if (m.user?.emailAliases) {
        for (const alias of m.user.emailAliases) {
          if (alias.isVerified && alias.email) {
            memberMap.set(alias.email.toLowerCase().trim(), {
              role: m.role,
              userId: m.user.id,
              name: m.user.name || '',
              isRealAccount,
            });
          }
        }
      }
    }

    // 5. Fetch pending invitations for this organization
    const pendingInvitations = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    const invitationMap = new Map<string, string>();
    for (const inv of pendingInvitations) {
      invitationMap.set(inv.email.toLowerCase().trim(), inv.id);
    }

    // 6. Map into response array
    const result: RepositoryContributorResponse[] = Array.from(contributorMap.values()).map((c) => {
      const memberInfo = memberMap.get(c.email);
      const pendingInvitationId = invitationMap.get(c.email);
      const isMember = !!(memberInfo && memberInfo.isRealAccount);
      const isInvited = !isMember && !!pendingInvitationId;

      return {
        email: c.email,
        name: memberInfo?.name || c.name,
        commitCount: c.commitCount,
        lastCommittedAt: c.lastCommittedAt,
        repositories: Array.from(c.repositories),
        isMember,
        isInvited,
        memberRole: memberInfo?.role || null,
        invitationId: pendingInvitationId || null,
        userId: memberInfo?.userId || null,
      };
    });

    result.sort((a, b) => b.commitCount - a.commitCount);
    return result;
  }

  /**
   * Invite all uninvited members and contributors
   */
  async inviteAll(
    organizationId: string,
    inviterUserId?: string,
  ): Promise<{ totalInvited: number; emails: string[] }> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID '${organizationId}' not found`);
    }

    // Fetch members and repo contributors
    const members = await this.getMembers(organizationId);
    const uninvitedMembers = members.filter((m) => m.status === 'UNINVITED');

    const contributors = await this.getRepositoryContributors(organizationId);
    const uninvitedContributors = contributors.filter((c) => !c.isMember && !c.isInvited);

    // Deduplicate emails across members and contributors
    const targetEmails = new Set<string>();
    for (const m of uninvitedMembers) {
      if (m.user?.email) {
        targetEmails.add(m.user.email.toLowerCase().trim());
      }
    }
    for (const c of uninvitedContributors) {
      if (c.email) {
        targetEmails.add(c.email.toLowerCase().trim());
      }
    }

    const invitedEmails: string[] = [];

    for (const email of targetEmails) {
      try {
        await this.createInvitation(organizationId, email, inviterUserId);
        invitedEmails.push(email);
      } catch (err: any) {
        this.logger.warn(`Could not invite ${email} during inviteAll: ${err?.message || err}`);
      }
    }

    this.logger.log(
      `Dispatched bulk invitations for organization ${organizationId}: ${invitedEmails.length} invitations queued`,
    );

    return {
      totalInvited: invitedEmails.length,
      emails: invitedEmails,
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

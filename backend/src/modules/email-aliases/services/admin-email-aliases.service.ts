import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { ReattributionService } from './reattribution.service';
import { AliasSource } from '@prisma/client';

/**
 * Service for admin email alias management
 */
@Injectable()
export class AdminEmailAliasesService {
  private readonly logger = new Logger(AdminEmailAliasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reattributionService: ReattributionService,
  ) {}

  /**
   * Get all unmapped emails for an organization
   */
  async getUnmappedEmails(organizationId: string) {
    const unmappedEmails = await this.prisma.unmappedEmail.findMany({
      where: { organizationId },
      orderBy: { commitCount: 'desc' },
      select: {
        id: true,
        email: true,
        authorName: true,
        commitCount: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });

    return unmappedEmails;
  }

  /**
   * Admin assigns an email to a user (creates verified alias without email verification)
   */
  async assignEmailToUser(email: string, userId: string, adminId: string, organizationId: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // Verify the user exists and belongs to the organization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { organizationId },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.memberships.length === 0) {
      throw new BadRequestException('User does not belong to this organization');
    }

    // Check if email is already claimed by another user
    const existingAlias = await this.prisma.emailAlias.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingAlias) {
      if (existingAlias.userId === userId) {
        throw new ConflictException('Email is already assigned to this user');
      }
      throw new ConflictException('Email already claimed');
    }

    // Check if email is a primary email of another user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email already claimed');
    }

    // Create verified alias with admin assignment source
    const alias = await this.prisma.emailAlias.create({
      data: {
        userId,
        email: normalizedEmail,
        isVerified: true,
        verifiedAt: new Date(),
        source: AliasSource.ADMIN_ASSIGNED,
        // Note: assignedByAdminId would be stored if we had that field in schema
        // For audit trail, we log the admin ID
      },
    });

    // Log admin assignment for audit trail
    this.logger.log(`Admin ${adminId} assigned email ${normalizedEmail} to user ${userId}`);

    // Remove from unmapped emails if it exists
    await this.prisma.unmappedEmail.deleteMany({
      where: {
        organizationId,
        email: normalizedEmail,
      },
    });

    // Trigger commit re-attribution job
    try {
      const jobId = await this.reattributionService.triggerAttributionOnVerification(
        normalizedEmail,
        userId,
      );
      this.logger.log(
        `Triggered re-attribution job ${jobId} for admin-assigned email ${normalizedEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to trigger re-attribution for admin-assigned ${normalizedEmail}: ${error}`,
      );
    }

    return {
      id: alias.id,
      email: alias.email,
      userId: alias.userId,
      isVerified: alias.isVerified,
      source: alias.source,
      verifiedAt: alias.verifiedAt,
      assignedByAdminId: adminId,
      message: 'Email assigned successfully',
    };
  }

  /**
   * Admin removes an email mapping
   */
  async removeEmailMapping(aliasId: string, adminId: string, organizationId: string) {
    const alias = await this.prisma.emailAlias.findUnique({
      where: { id: aliasId },
      include: {
        user: {
          include: {
            memberships: {
              where: { organizationId },
            },
          },
        },
      },
    });

    if (!alias) {
      throw new NotFoundException('Email alias not found');
    }

    // Verify the user belongs to the organization
    if (alias.user.memberships.length === 0) {
      throw new BadRequestException('Email alias does not belong to this organization');
    }

    // Check if this is the user's primary email
    if (alias.email.toLowerCase() === alias.user.email.toLowerCase()) {
      throw new BadRequestException('Cannot remove primary email');
    }

    // Log admin removal for audit trail
    this.logger.log(
      `Admin ${adminId} removed email mapping ${alias.email} from user ${alias.userId}`,
    );

    // Trigger un-attribution to update commits to unmapped status
    if (alias.isVerified) {
      try {
        const jobId = await this.reattributionService.triggerUnattributionOnRemoval(
          alias.email,
          alias.userId,
        );
        this.logger.log(`Triggered un-attribution job ${jobId} for removed email ${alias.email}`);
      } catch (error) {
        this.logger.error(`Failed to trigger un-attribution for ${alias.email}: ${error}`);
      }
    }

    // Delete the alias
    await this.prisma.emailAlias.delete({
      where: { id: aliasId },
    });

    return;
  }
}

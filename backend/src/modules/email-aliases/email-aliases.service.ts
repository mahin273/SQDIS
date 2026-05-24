import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  GoneException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { EmailValidationService } from './services/email-validation.service';
import { EmailService } from './services/email.service';
import { ReattributionService } from './services/reattribution.service';
import { AliasSource } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Service for managing email aliases
 */
@Injectable()
export class EmailAliasesService {
  private readonly logger = new Logger(EmailAliasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailValidationService: EmailValidationService,
    private readonly emailService: EmailService,
    private readonly reattributionService: ReattributionService,
  ) {}

  /**
   * Add a new email alias for a user
   */
  async addAlias(email: string, userId: string, userPrimaryEmail: string) {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!this.emailValidationService.isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    // Check if email matches user's primary email
    if (normalizedEmail === userPrimaryEmail.toLowerCase()) {
      throw new BadRequestException('Email matches your primary email');
    }

    // Check if email is already claimed by another user
    const existingAlias = await this.prisma.emailAlias.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingAlias) {
      throw new ConflictException('Email already claimed');
    }

    // Check if email is a primary email of another user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email already claimed');
    }

    // Generate verification token with 24-hour expiry
    const verifyToken = this.generateVerificationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create the alias
    const alias = await this.prisma.emailAlias.create({
      data: {
        userId,
        email: normalizedEmail,
        isVerified: false,
        verifyToken,
        tokenExpiry,
        source: AliasSource.MANUAL,
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(normalizedEmail, verifyToken);

    return {
      id: alias.id,
      email: alias.email,
      isVerified: alias.isVerified,
      createdAt: alias.createdAt,
      message: 'Verification email sent. Please check your inbox.',
    };
  }

  /**
   * Get all email aliases for a user
   */
  async getAliasesByUserId(userId: string) {
    const aliases = await this.prisma.emailAlias.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        isVerified: true,
        source: true,
        createdAt: true,
        verifiedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get commit counts for each alias
    const aliasesWithCommitCount = await Promise.all(
      aliases.map(async (alias) => {
        const commitCount = await this.prisma.commit.count({
          where: { authorEmail: alias.email },
        });
        return {
          ...alias,
          commitCount,
        };
      }),
    );

    return aliasesWithCommitCount;
  }

  /**
   * Verify an email alias using the verification token
   */
  async verifyAlias(token: string) {
    const alias = await this.prisma.emailAlias.findFirst({
      where: { verifyToken: token },
    });

    if (!alias) {
      throw new NotFoundException('Invalid verification token');
    }

    // Check if already verified
    if (alias.isVerified) {
      throw new BadRequestException('Email alias already verified');
    }

    // Check if token has expired
    if (alias.tokenExpiry && alias.tokenExpiry < new Date()) {
      throw new GoneException('Verification token has expired. Please request a new one.');
    }

    // Mark as verified
    const updatedAlias = await this.prisma.emailAlias.update({
      where: { id: alias.id },
      data: {
        isVerified: true,
        verifyToken: null,
        tokenExpiry: null,
        verifiedAt: new Date(),
      },
    });

    // Trigger commit re-attribution job
    try {
      const jobId = await this.reattributionService.triggerAttributionOnVerification(
        updatedAlias.email,
        updatedAlias.userId,
      );
      this.logger.log(
        `Triggered re-attribution job ${jobId} for verified email ${updatedAlias.email}`,
      );
    } catch (error) {
      // Log error but don't fail the verification
      this.logger.error(`Failed to trigger re-attribution for ${updatedAlias.email}: ${error}`);
    }

    return {
      id: updatedAlias.id,
      email: updatedAlias.email,
      isVerified: updatedAlias.isVerified,
      verifiedAt: updatedAlias.verifiedAt,
      message: 'Email alias verified successfully',
    };
  }

  /**
   * Resend verification email for a pending alias
   */
  async resendVerification(aliasId: string, userId: string) {
    const alias = await this.prisma.emailAlias.findUnique({
      where: { id: aliasId },
    });

    if (!alias) {
      throw new NotFoundException('Email alias not found');
    }

    if (alias.userId !== userId) {
      throw new ForbiddenException('Email alias does not belong to you');
    }

    if (alias.isVerified) {
      throw new BadRequestException('Email alias is already verified');
    }

    // Generate new verification token and invalidate old one
    const verifyToken = this.generateVerificationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.emailAlias.update({
      where: { id: aliasId },
      data: {
        verifyToken,
        tokenExpiry,
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(alias.email, verifyToken);

    return {
      message: 'Verification email resent successfully',
    };
  }

  /**
   * Remove an email alias
   */
  async removeAlias(aliasId: string, userId: string) {
    const alias = await this.prisma.emailAlias.findUnique({
      where: { id: aliasId },
    });

    if (!alias) {
      throw new NotFoundException('Email alias not found');
    }

    if (alias.userId !== userId) {
      throw new ForbiddenException('Email alias does not belong to you');
    }

    // If verified, trigger re-attribution to unmapped
    if (alias.isVerified) {
      try {
        const jobId = await this.reattributionService.triggerUnattributionOnRemoval(
          alias.email,
          alias.userId,
        );
        this.logger.log(`Triggered un-attribution job ${jobId} for removed email ${alias.email}`);
      } catch (error) {
        // Log error but don't fail the removal
        this.logger.error(`Failed to trigger un-attribution for ${alias.email}: ${error}`);
      }
    }

    // Delete the alias
    await this.prisma.emailAlias.delete({
      where: { id: aliasId },
    });

    return;
  }

  /**
   * Find an alias by email
   */
  async findByEmail(email: string) {
    return this.prisma.emailAlias.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Create a verified alias (for admin assignment or GitHub OAuth)
   */
  async createVerifiedAlias(
    email: string,
    userId: string,
    source: AliasSource,
    _assignedByAdminId?: string,
  ) {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already claimed
    const existingAlias = await this.prisma.emailAlias.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingAlias) {
      if (existingAlias.userId === userId) {
        return existingAlias; // Already belongs to this user
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

    const alias = await this.prisma.emailAlias.create({
      data: {
        userId,
        email: normalizedEmail,
        isVerified: true,
        verifiedAt: new Date(),
        source,
      },
    });

    // Trigger commit re-attribution for admin assignments
    if (source === AliasSource.ADMIN_ASSIGNED) {
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
    }

    return alias;
  }

  /**
   * Generate a secure verification token
   */
  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }
}

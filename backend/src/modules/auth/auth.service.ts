import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, AuthUser } from './types/auth-response.type';
import { JwtPayload, RefreshTokenPayload } from './types/jwt-payload.types';
import { hashPassword, verifyPassword } from './utils/password.util';
import { randomBytes, createHash } from 'crypto';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { AuditLoggerService } from './services/audit-logger.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditLoggerService: AuditLoggerService,
  ) {
    // Access token expires in 15 minutes (900 seconds)
    this.accessTokenExpiresIn = 900;
    // Refresh token expires in 7 days
    this.refreshTokenExpiresIn = 7 * 24 * 60 * 60;
  }

  /**
   * Register a new user with email/password
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await hashPassword(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
    });

    // Generate tokens and return response
    return this.generateAuthResponse(user);
  }

  /**
   * Login with email/password
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Return generic error message for security
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens and return response
    return this.generateAuthResponse(user);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(token: string): Promise<AuthResponse> {
    // Find the refresh token in database
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Check if token is revoked
    if (refreshToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Revoke the old refresh token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    return this.generateAuthResponse(refreshToken.user);
  }

  /**
   * Logout by revoking refresh token
   */
  async logout(token: string): Promise<void> {
    // Find and revoke the refresh token
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (refreshToken && !refreshToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * Generate auth response with access and refresh tokens
   * Includes organization context in JWT payload
   * @param organizationId - Optional organization ID to include in JWT
   */
  private async generateAuthResponse(
    user: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      createdAt: Date;
    },
    organizationId?: string,
  ): Promise<AuthResponse> {
    // Get user's organization membership for JWT context
    let orgContext: { organizationId?: string; role?: string } = {};

    if (organizationId) {
      // Use the specified organization
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
      });

      if (membership) {
        orgContext = {
          organizationId: membership.organizationId,
          role: membership.role,
        };
      }
    } else {
      // Get the user's first organization membership (default context)
      const membership = await this.prisma.organizationMember.findFirst({
        where: { userId: user.id },
        orderBy: { joinedAt: 'asc' },
      });

      if (membership) {
        orgContext = {
          organizationId: membership.organizationId,
          role: membership.role,
        };
      }
    }

    // Create JWT payload with organization context
    const jwtPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      organizationId: orgContext.organizationId,
      role: orgContext.role,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(jwtPayload, {
      expiresIn: this.accessTokenExpiresIn,
    });

    // Generate refresh token (random string stored in DB)
    const refreshTokenValue = randomBytes(32).toString('hex');
    const refreshTokenExpiry = new Date(Date.now() + this.refreshTokenExpiresIn * 1000);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Build user response object
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: user.createdAt,
      organizationId: orgContext.organizationId,
      role: orgContext.role,
    };

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: this.accessTokenExpiresIn,
      tokenType: 'Bearer',
      user: authUser,
    };
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Switch organization context for multi-org users
   * Generates new tokens with the specified organization context
   */
  async switchOrganization(userId: string, organizationId: string): Promise<AuthResponse> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify user is a member of the target organization
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    // Generate new tokens with the new organization context
    return this.generateAuthResponse(user, organizationId);
  }

  /**
   * Get all organizations for a user
   * Used for organization switching UI
   */
  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logoUrl: m.organization.logoUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Get current user information with organization memberships
   */
  async getCurrentUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: user.createdAt,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        organizationSlug: m.organization.slug,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  /**
   * Validate OAuth user and create/link account
   */
  async validateOAuthUser(
    provider: 'google' | 'github',
    profile: {
      id: string;
      email: string;
      name: string;
      avatarUrl?: string;
    },
  ): Promise<AuthResponse> {
    const providerIdField = provider === 'google' ? 'googleId' : 'githubId';

    // First, check if user exists with this OAuth provider ID
    let user = await this.prisma.user.findUnique({
      where: { [providerIdField]: profile.id } as any,
    });

    if (user) {
      // User exists with this OAuth provider, return auth response
      return this.generateAuthResponse(user);
    }

    // Check if user exists with the same email (for account linking)
    user = await this.prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
    });

    if (user) {
      // Link OAuth provider to existing account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          [providerIdField]: profile.id,
          // Update avatar if not set
          avatarUrl: user.avatarUrl || profile.avatarUrl,
        },
      });
      return this.generateAuthResponse(user);
    }

    // Create new user with OAuth provider
    user = await this.prisma.user.create({
      data: {
        email: profile.email.toLowerCase(),
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        [providerIdField]: profile.id,
        // No password for OAuth users
        passwordHash: null,
      },
    });

    return this.generateAuthResponse(user);
  }

  /**
   * Validate GitHub OAuth user with auto-linking of GitHub emails
   */
  async validateGitHubOAuthUser(profile: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    emails?: Array<{ value: string; primary: boolean; verified: boolean }>;
  }): Promise<AuthResponse> {
    // First, check if user exists with this GitHub ID
    let user = await this.prisma.user.findUnique({
      where: { githubId: profile.id },
    });

    if (user) {
      // User exists with this GitHub provider, auto-link any new emails
      await this.autoLinkGitHubEmails(user.id, profile.emails || []);
      return this.generateAuthResponse(user);
    }

    // Check if user exists with the same email (for account linking)
    user = await this.prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
    });

    if (user) {
      // Link GitHub provider to existing account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          githubId: profile.id,
          // Update avatar if not set
          avatarUrl: user.avatarUrl || profile.avatarUrl,
        },
      });
      // Auto-link GitHub emails
      await this.autoLinkGitHubEmails(user.id, profile.emails || []);
      return this.generateAuthResponse(user);
    }

    // Create new user with GitHub provider
    user = await this.prisma.user.create({
      data: {
        email: profile.email.toLowerCase(),
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        githubId: profile.id,
        // No password for OAuth users
        passwordHash: null,
      },
    });

    // Auto-link GitHub emails for new user
    await this.autoLinkGitHubEmails(user.id, profile.emails || []);

    return this.generateAuthResponse(user);
  }

  /**
   * Auto-link GitHub emails as verified email aliases
   */
  private async autoLinkGitHubEmails(
    userId: string,
    emails: Array<{ value: string; primary: boolean; verified: boolean }>,
  ): Promise<void> {
    for (const emailData of emails) {
      // Only link verified emails
      if (!emailData.verified) {
        continue;
      }

      const emailLower = emailData.value.toLowerCase();

      // Check if email is already claimed by another user
      const existingAlias = await this.prisma.emailAlias.findUnique({
        where: { email: emailLower },
      });

      if (existingAlias) {
        // Skip if already claimed (by this user or another)
        continue;
      }

      // Check if this is the user's primary email (skip as it's already their account email)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user && user.email.toLowerCase() === emailLower) {
        // Skip primary email
        continue;
      }

      // Create verified email alias from GitHub OAuth
      await this.prisma.emailAlias.create({
        data: {
          userId,
          email: emailLower,
          isVerified: true,
          verifiedAt: new Date(),
          source: 'GITHUB_OAUTH',
        },
      });
    }
  }

  /**
   * Forgot password — generate a reset token and send email
   * Supports both email and username (email alias) identifiers
   * Always returns success for security (prevents email enumeration)
   */
  async forgotPassword(identifier: string, ipAddress?: string): Promise<{ message: string }> {
    try {
      const user = await this.findUserByIdentifier(identifier);

      // Log the password reset request without revealing account existence
      this.auditLoggerService.logPasswordResetRequest(
        identifier,
        !!user, // Log whether user was found, but response doesn't reveal this
        ipAddress || 'unknown',
      );

      // Always return success even if user not found (prevent email enumeration)
      if (!user) {
        return {
          message: 'If an account with that email exists, a password reset link has been sent.',
        };
      }

      // Invalidate any existing reset tokens for this user
      await this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      // Generate a secure random token using TokenService
      const { rawToken, hashedToken } = this.tokenService.generateResetToken();

      // Token expires in 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      });

      // Build the password reset URL using FRONTEND_URL and raw token
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

      // Send password reset email to user's registered email address
      try {
        await this.emailService.sendPasswordResetEmail(user.email, resetUrl, user.name);
      } catch (error) {
        // Email failures are already logged in EmailService
        // We don't throw to prevent email enumeration
        this.logger.error(`Email sending failed for user ${user.id}`, error);
      }
      return {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    } catch (error) {
      // Generic error handling for unexpected errors
      // Log detailed error for debugging
      this.logger.error('Unexpected error in forgotPassword', error);

      // Return generic success message to prevent information leakage
      // Even on error, we don't reveal whether the account exists
      return {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }
  }

  /**
   * Find user by email or username
   * Attempts email lookup first, then username (email alias) lookup
   * @param identifier - Email address or username
   * @returns User or null
   */
  private async findUserByIdentifier(identifier: string): Promise<any | null> {
      // First, try to find by email (exact match, case-insensitive)
      const userByEmail = await this.prisma.user.findUnique({
        where: { email: identifier.toLowerCase() },
      });

      if (userByEmail) {
        return userByEmail;
      }

      // If not found by email, try to find by email alias (username)
      const emailAlias = await this.prisma.emailAlias.findFirst({
        where: {
          email: identifier.toLowerCase(),
          isVerified: true, // Only consider verified aliases
        },
        include: { user: true },
      });

      if (emailAlias) {
        // Return the user, which has the registered email address
        // The email will be sent to user.email (registered address)
        return emailAlias.user;
      }

      // Return null for non-existent username (enumeration prevention handled in caller)
      return null;
    }


  /**
   * Reset password using a valid reset token
   */
  async resetPassword(rawToken: string, newPassword: string, ipAddress?: string): Promise<{ message: string }> {
    try {
      // Hash the incoming token to compare with stored hash
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      const resetToken = await this.prisma.passwordResetToken.findUnique({
        where: { token: hashedToken },
        include: { user: true },
      });

      // Return HTTP 400 with descriptive error for invalid token
      if (!resetToken) {
        // Log failed token validation - token not found
        this.auditLoggerService.logTokenValidation(
          null,
          false,
          'Token not found in database',
          ipAddress || 'unknown',
        );
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Return HTTP 400 with descriptive error for used token
      // Check if token has already been used
      if (resetToken.usedAt) {
        // Log failed token validation - token already used
        this.auditLoggerService.logTokenValidation(
          resetToken.userId,
          false,
          'Token already used',
          ipAddress || 'unknown',
        );
        throw new BadRequestException('This reset token has already been used');
      }

      // Return HTTP 400 with descriptive error for expired token
      // Check if token has expired
      if (resetToken.expiresAt < new Date()) {
        // Log failed token validation - token expired
        this.auditLoggerService.logTokenValidation(
          resetToken.userId,
          false,
          'Token expired',
          ipAddress || 'unknown',
        );
        throw new BadRequestException('This reset token has expired');
      }

      // Log successful token validation
      this.auditLoggerService.logTokenValidation(
        resetToken.userId,
        true,
        null,
        ipAddress || 'unknown',
      );

      // Hash the new password
      const passwordHash = await hashPassword(newPassword);

      // Update password, mark token as used, and revoke refresh tokens atomically
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
        this.prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
        this.prisma.refreshToken.updateMany({
          where: {
            userId: resetToken.userId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        }),
      ]);

      // Log successful password reset

      this.auditLoggerService.logPasswordResetSuccess(
        resetToken.userId,
        ipAddress || 'unknown',
      );

      return {
        message: 'Password has been reset successfully. Please login with your new password.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Unexpected error in resetPassword', error);

      // Return generic error message to client
      throw new BadRequestException('An error occurred while resetting your password. Please try again.');
    }
  }

  /**
   * Clean up expired password reset tokens
   * Deletes tokens that are expired and older than 24 hours
   * Preserves used tokens for audit purposes
   */
  async cleanupExpiredTokens(): Promise<{ deletedCount: number }> {
    // Calculate the cutoff time: 24 hours ago
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Delete tokens that are:
    // 1. Expired (expiresAt < now)
    // 2. Older than 24 hours (expiresAt < cutoffTime)
    // 3. Not used (usedAt is null) - preserve used tokens for audit
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: cutoffTime,
        },
        usedAt: null,
      },
    });

    // Log the cleanup operation
    this.auditLoggerService.logTokenCleanup(result.count);

    this.logger.log(`Token cleanup completed: ${result.count} expired tokens deleted`);

    return { deletedCount: result.count };
  }

}

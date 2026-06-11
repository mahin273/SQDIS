import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma';
import { AuthService } from './auth.service';
import { AuditLoggerService, EmailService, TokenService } from './services';
import { hashPassword, verifyPassword } from './utils/password.util';

jest.mock('./utils/password.util', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: Record<string, jest.Mock>;
    organizationMember: Record<string, jest.Mock>;
    refreshToken: Record<string, jest.Mock>;
    passwordResetToken: Record<string, jest.Mock>;
    emailAlias: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };
  let tokenService: { generateResetToken: jest.Mock };
  let emailService: { sendPasswordResetEmail: jest.Mock };
  let auditLoggerService: {
    logPasswordResetRequest: jest.Mock;
    logTokenValidation: jest.Mock;
    logPasswordResetSuccess: jest.Mock;
    logTokenCleanup: jest.Mock;
  };

  const user = {
    id: 'user-1',
    email: 'dev@example.com',
    name: 'Dev User',
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organizationMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      emailAlias: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    jwtService = { sign: jest.fn(() => 'access-token') };
    configService = { get: jest.fn(() => 'https://app.example.com') };
    tokenService = {
      generateResetToken: jest.fn(() => ({
        rawToken: 'raw-reset-token',
        hashedToken: 'hashed-reset-token',
      })),
    };
    emailService = { sendPasswordResetEmail: jest.fn() };
    auditLoggerService = {
      logPasswordResetRequest: jest.fn(),
      logTokenValidation: jest.fn(),
      logPasswordResetSuccess: jest.fn(),
      logTokenCleanup: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: TokenService, useValue: tokenService },
        { provide: EmailService, useValue: emailService },
        { provide: AuditLoggerService, useValue: auditLoggerService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.mocked(hashPassword).mockResolvedValue('hashed-password');
    jest.mocked(verifyPassword).mockResolvedValue(true);
    prisma.organizationMember.findFirst.mockResolvedValue(null);
    prisma.refreshToken.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user with a lower-cased email, hashed password, and issued tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'OWNER',
    });

    const result = await service.register({
      email: 'DEV@EXAMPLE.COM',
      password: 'Str0ngPass!',
      name: 'Dev User',
    });

    expect(hashPassword).toHaveBeenCalledWith('Str0ngPass!');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'dev@example.com',
        passwordHash: 'hashed-password',
        name: 'Dev User',
      },
    });
    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        organizationId: 'org-1',
        role: 'OWNER',
      },
      { expiresIn: 900 },
    );
    expect(result).toMatchObject({
      accessToken: 'access-token',
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        organizationId: 'org-1',
        role: 'OWNER',
      },
    });
    expect(result.refreshToken).toHaveLength(64);
    const refreshTokenHash = createHash('sha256').update(result.refreshToken).digest('hex');
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        token: refreshTokenHash,
        expiresAt: expect.any(Date),
      }),
    });
    expect(refreshTokenHash).not.toBe(result.refreshToken);
  });

  it('rejects duplicate registration emails', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.register({
        email: 'dev@example.com',
        password: 'Str0ngPass!',
        name: 'Dev User',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('logs in with a valid password and rejects invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ ...user, passwordHash: 'stored-hash' });

    await expect(service.login({ email: 'DEV@EXAMPLE.COM', password: 'secret' })).resolves.toMatchObject({
      accessToken: 'access-token',
      user: { id: user.id },
    });
    expect(verifyPassword).toHaveBeenCalledWith('secret', 'stored-hash');

    jest.mocked(verifyPassword).mockResolvedValueOnce(false);
    prisma.user.findUnique.mockResolvedValueOnce({ ...user, passwordHash: 'stored-hash' });

    await expect(service.login({ email: 'dev@example.com', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates a refresh token and rejects expired or revoked tokens', async () => {
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'refresh-1',
      token: 'old-refresh',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });

    await expect(service.refreshToken('old-refresh')).resolves.toMatchObject({
      accessToken: 'access-token',
      user: { id: user.id },
    });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: {
        token: createHash('sha256').update('old-refresh').digest('hex'),
      },
      include: { user: true },
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-1' },
      data: { revokedAt: expect.any(Date) },
    });

    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'refresh-2',
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      user,
    });
    await expect(service.refreshToken('expired')).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'refresh-3',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user,
    });
    await expect(service.refreshToken('revoked')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('switches organization only when the user belongs to the requested organization', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.organizationMember.findUnique
      .mockResolvedValueOnce({
        organizationId: 'org-2',
        userId: user.id,
        role: 'ADMIN',
      })
      .mockResolvedValueOnce({
        organizationId: 'org-2',
        userId: user.id,
        role: 'ADMIN',
      });

    await expect(service.switchOrganization(user.id, 'org-2')).resolves.toMatchObject({
      accessToken: 'access-token',
      user: { organizationId: 'org-2', role: 'ADMIN' },
    });

    prisma.organizationMember.findUnique.mockResolvedValueOnce(null);

    await expect(service.switchOrganization(user.id, 'missing-org')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('maps current user memberships and returns null for missing users', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      ...user,
      memberships: [
        {
          organizationId: 'org-1',
          role: 'OWNER',
          joinedAt: new Date('2026-01-02T00:00:00.000Z'),
          organization: { name: 'Acme', slug: 'acme' },
        },
      ],
    });

    await expect(service.getCurrentUser(user.id)).resolves.toMatchObject({
      id: user.id,
      memberships: [
        {
          organizationId: 'org-1',
          organizationName: 'Acme',
          organizationSlug: 'acme',
          role: 'OWNER',
        },
      ],
    });

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getCurrentUser('missing')).resolves.toBeNull();
  });

  it('creates a password reset token and sends a reset email without revealing account existence', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user);
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.passwordResetToken.create.mockResolvedValue({});

    await expect(service.forgotPassword('DEV@EXAMPLE.COM', '127.0.0.1')).resolves.toEqual({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });

    expect(auditLoggerService.logPasswordResetRequest).toHaveBeenCalledWith(
      'DEV@EXAMPLE.COM',
      true,
      '127.0.0.1',
    );
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        token: 'hashed-reset-token',
        expiresAt: expect.any(Date),
      },
    });
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      user.email,
      'https://app.example.com/reset-password?token=raw-reset-token',
      user.name,
    );

    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.emailAlias.findFirst.mockResolvedValueOnce(null);

    await expect(service.forgotPassword('unknown@example.com')).resolves.toEqual({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  });

  it('resets password with a valid token and rejects invalid reset tokens', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);

    await expect(service.resetPassword('missing-token', 'new-password')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'reset-1',
      userId: user.id,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    prisma.user.update.mockResolvedValue(user);
    prisma.passwordResetToken.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.resetPassword('valid-token', 'new-password', '127.0.0.1')).resolves.toEqual({
      message: 'Password has been reset successfully. Please login with your new password.',
    });

    expect(hashPassword).toHaveBeenCalledWith('new-password');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { passwordHash: 'hashed-password' },
    });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'reset-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
    ]);
    expect(auditLoggerService.logPasswordResetSuccess).toHaveBeenCalledWith(user.id, '127.0.0.1');
  });

  it('cleans up expired password reset tokens and logs the count', async () => {
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 3 });

    await expect(service.cleanupExpiredTokens()).resolves.toEqual({ deletedCount: 3 });
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: expect.any(Date) },
        usedAt: null,
      },
    });
    expect(auditLoggerService.logTokenCleanup).toHaveBeenCalledWith(3);
  });
});

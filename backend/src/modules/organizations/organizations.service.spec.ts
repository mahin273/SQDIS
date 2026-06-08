import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma';
import { AuditLogService } from '../audit/services/audit-log.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: {
    organization: Record<string, jest.Mock>;
    organizationMember: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    invitation: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let auditLogService: { logRoleChange: jest.Mock };

  const organization = {
    id: 'org-1',
    name: 'Acme',
    slug: 'acme',
    logoUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  const memberUser = {
    id: 'user-2',
    email: 'member@example.com',
    name: 'Member User',
    avatarUrl: null,
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      invitation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    auditLogService = { logRoleChange: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates an organization with a normalized slug and owner membership', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    prisma.organization.create.mockResolvedValue(organization);

    await expect(service.create({ name: 'Acme', slug: 'ACME' }, 'owner-1')).resolves.toEqual(
      organization,
    );

    expect(prisma.organization.create).toHaveBeenCalledWith({
      data: {
        name: 'Acme',
        slug: 'acme',
        members: {
          create: {
            userId: 'owner-1',
            role: Role.OWNER,
          },
        },
      },
    });
  });

  it('rejects duplicate organization slugs', async () => {
    prisma.organization.findUnique.mockResolvedValue(organization);

    await expect(service.create({ name: 'Acme', slug: 'ACME' }, 'owner-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('finds organizations by id or slug and throws when missing', async () => {
    prisma.organization.findUnique.mockResolvedValueOnce(organization);
    await expect(service.findById('org-1')).resolves.toEqual(organization);

    prisma.organization.findUnique.mockResolvedValueOnce(organization);
    await expect(service.findBySlug('ACME')).resolves.toEqual(organization);
    expect(prisma.organization.findUnique).toHaveBeenLastCalledWith({ where: { slug: 'acme' } });

    prisma.organization.findUnique.mockResolvedValueOnce(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates organization fields after checking slug uniqueness', async () => {
    prisma.organization.findUnique
      .mockResolvedValueOnce(organization)
      .mockResolvedValueOnce(null);
    prisma.organization.update.mockResolvedValue({ ...organization, slug: 'new-acme' });

    await expect(
      service.update('org-1', {
        name: 'New Acme',
        slug: 'NEW-ACME',
        logoUrl: 'https://cdn.example.com/logo.png',
      }),
    ).resolves.toMatchObject({ slug: 'new-acme' });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: {
        name: 'New Acme',
        slug: 'new-acme',
        logoUrl: 'https://cdn.example.com/logo.png',
      },
    });
  });

  it('maps user organizations with member counts', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([
      {
        organization: {
          ...organization,
          _count: { members: 4 },
        },
      },
    ]);

    await expect(service.findAllForUser('user-1')).resolves.toEqual([
      {
        ...organization,
        memberCount: 4,
      },
    ]);
  });

  it('verifies required roles and rejects non-members or insufficient roles', async () => {
    prisma.organizationMember.findUnique.mockResolvedValueOnce({ role: Role.ADMIN });

    await expect(service.verifyUserRole('org-1', 'user-1', [Role.OWNER, Role.ADMIN])).resolves.toBeUndefined();

    prisma.organizationMember.findUnique.mockResolvedValueOnce(null);
    await expect(service.verifyUserRole('org-1', 'user-1', [Role.OWNER])).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.organizationMember.findUnique.mockResolvedValueOnce({ role: Role.DEVELOPER });
    await expect(service.verifyUserRole('org-1', 'user-1', [Role.OWNER])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns organization members only when the organization exists', async () => {
    prisma.organization.findUnique.mockResolvedValueOnce(null);
    await expect(service.getMembers('missing-org')).rejects.toBeInstanceOf(NotFoundException);

    prisma.organization.findUnique.mockResolvedValueOnce(organization);
    prisma.organizationMember.findMany.mockResolvedValueOnce([
      {
        id: 'member-1',
        userId: memberUser.id,
        role: Role.DEVELOPER,
        joinedAt: new Date('2026-01-03T00:00:00.000Z'),
        user: memberUser,
      },
    ]);

    await expect(service.getMembers('org-1')).resolves.toEqual([
      {
        id: 'member-1',
        userId: memberUser.id,
        role: Role.DEVELOPER,
        joinedAt: new Date('2026-01-03T00:00:00.000Z'),
        user: memberUser,
      },
    ]);
  });

  it('creates invitations with normalized email and rejects duplicate active invitations', async () => {
    prisma.organization.findUnique.mockResolvedValue(organization);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.invitation.findFirst.mockResolvedValueOnce(null);
    prisma.invitation.create.mockResolvedValue({
      id: 'inv-1',
      email: 'dev@example.com',
      token: 'invite-token',
      expiresAt: new Date('2026-01-10T00:00:00.000Z'),
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      acceptedAt: null,
      organizationId: 'org-1',
    });

    await expect(service.createInvitation('org-1', 'DEV@EXAMPLE.COM')).resolves.toMatchObject({
      id: 'inv-1',
      email: 'dev@example.com',
      organizationId: 'org-1',
    });
    expect(prisma.invitation.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        email: 'dev@example.com',
        token: expect.any(String),
        expiresAt: expect.any(Date),
      },
    });

    prisma.invitation.findFirst.mockResolvedValueOnce({ id: 'existing-invite' });
    await expect(service.createInvitation('org-1', 'dev@example.com')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('prevents inviting an existing organization member', async () => {
    prisma.organization.findUnique.mockResolvedValue(organization);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'member-1' });

    await expect(service.createInvitation('org-1', 'member@example.com')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('accepts a valid invitation and rejects invalid invitation states', async () => {
    prisma.invitation.findUnique.mockResolvedValueOnce(null);
    await expect(service.acceptInvitation('missing-token', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.invitation.findUnique.mockResolvedValueOnce({
      id: 'inv-used',
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      organizationId: 'org-1',
      organization,
    });
    await expect(service.acceptInvitation('used-token', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.invitation.findUnique.mockResolvedValueOnce({
      id: 'inv-expired',
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      organizationId: 'org-1',
      organization,
    });
    await expect(service.acceptInvitation('expired-token', 'user-1')).rejects.toBeInstanceOf(
      GoneException,
    );

    prisma.invitation.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      organizationId: 'org-1',
      organization,
    });
    prisma.user.findUnique.mockResolvedValueOnce(memberUser);
    prisma.organizationMember.findUnique.mockResolvedValueOnce(null);
    prisma.organizationMember.create.mockResolvedValueOnce({
      id: 'member-1',
      userId: memberUser.id,
      role: Role.DEVELOPER,
      joinedAt: new Date('2026-01-03T00:00:00.000Z'),
      user: memberUser,
    });
    prisma.invitation.update.mockResolvedValueOnce({});

    await expect(service.acceptInvitation('valid-token', memberUser.id)).resolves.toMatchObject({
      id: 'member-1',
      userId: memberUser.id,
      role: Role.DEVELOPER,
      user: memberUser,
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('updates member role while protecting self changes and the last owner', async () => {
    prisma.organization.findUnique.mockResolvedValue(organization);
    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      id: 'member-1',
      userId: 'target-user',
      role: Role.ADMIN,
    });
    prisma.organizationMember.update.mockResolvedValueOnce({
      id: 'member-1',
      userId: 'target-user',
      role: Role.TEAM_LEAD,
      joinedAt: new Date('2026-01-03T00:00:00.000Z'),
      user: memberUser,
    });

    await expect(
      service.updateMemberRole('org-1', 'target-user', Role.TEAM_LEAD, 'requesting-user'),
    ).resolves.toMatchObject({ role: Role.TEAM_LEAD });
    expect(auditLogService.logRoleChange).toHaveBeenCalledWith({
      userId: 'requesting-user',
      targetUserId: 'target-user',
      organizationId: 'org-1',
      oldRole: Role.ADMIN,
      newRole: Role.TEAM_LEAD,
    });

    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      id: 'member-2',
      userId: 'same-user',
      role: Role.ADMIN,
    });
    await expect(
      service.updateMemberRole('org-1', 'same-user', Role.DEVELOPER, 'same-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      id: 'owner-member',
      userId: 'owner-user',
      role: Role.OWNER,
    });
    prisma.organizationMember.count.mockResolvedValueOnce(1);
    await expect(
      service.updateMemberRole('org-1', 'owner-user', Role.ADMIN, 'requesting-user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes members while protecting self removal and the last owner', async () => {
    prisma.organization.findUnique.mockResolvedValue(organization);
    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      id: 'member-1',
      userId: 'target-user',
      role: Role.DEVELOPER,
    });
    prisma.organizationMember.delete.mockResolvedValueOnce({});

    await expect(service.removeMember('org-1', 'target-user', 'requesting-user')).resolves.toBeUndefined();
    expect(prisma.organizationMember.delete).toHaveBeenCalledWith({ where: { id: 'member-1' } });

    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      id: 'member-2',
      userId: 'same-user',
      role: Role.ADMIN,
    });
    await expect(service.removeMember('org-1', 'same-user', 'same-user')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      id: 'owner-member',
      userId: 'owner-user',
      role: Role.OWNER,
    });
    prisma.organizationMember.count.mockResolvedValueOnce(1);
    await expect(service.removeMember('org-1', 'owner-user', 'requesting-user')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resends and retrieves invitation details', async () => {
    prisma.invitation.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'dev@example.com',
    });
    prisma.invitation.update.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'dev@example.com',
      token: 'new-token',
      expiresAt: new Date('2026-01-10T00:00:00.000Z'),
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      acceptedAt: null,
      organizationId: 'org-1',
    });

    await expect(service.resendInvitation('org-1', 'DEV@EXAMPLE.COM')).resolves.toMatchObject({
      token: 'new-token',
    });

    prisma.invitation.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'dev@example.com',
      token: 'new-token',
      expiresAt: new Date('2026-01-10T00:00:00.000Z'),
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      acceptedAt: null,
      organizationId: 'org-1',
      organization,
    });

    await expect(service.getInvitationByToken('new-token')).resolves.toMatchObject({
      id: 'inv-1',
      organization,
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AuditEventsGateway } from './audit-events.gateway';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditEventsGateway Authorization & Revalidation', () => {
  let gateway: AuditEventsGateway;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let prisma: jest.Mocked<any>;

  beforeEach(async () => {
    jwtService = {
      verify: jest.fn(),
    };

    prisma = {
      organizationMember: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditEventsGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = module.get<AuditEventsGateway>(AuditEventsGateway);
  });

  const createMockSocket = (options: {
    token?: string;
    authOrgId?: string;
  }) => {
    return {
      id: 'socket-1',
      handshake: {
        auth: {
          token: options.token,
          organizationId: options.authOrgId,
        },
        query: {},
        headers: {},
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
    } as any;
  };

  it('rejects connection when no token is provided', async () => {
    const socket = createMockSocket({});
    await gateway.handleConnection(socket);

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'AUTH_REQUIRED' }));
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('rejects connection when database membership does not exist', async () => {
    const socket = createMockSocket({ token: 'valid-jwt', authOrgId: 'org-target' });
    jwtService.verify!.mockReturnValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      organizationId: 'org-target',
    } as any);

    prisma.organizationMember.findUnique.mockResolvedValue(null);

    await gateway.handleConnection(socket);

    expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 'user-1',
          organizationId: 'org-target',
        },
      },
    });
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'INSUFFICIENT_PERMISSIONS' }));
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('rejects connection when database member role is MEMBER even if JWT claims ADMIN', async () => {
    const socket = createMockSocket({ token: 'valid-jwt', authOrgId: 'org-target' });
    jwtService.verify!.mockReturnValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      organizationId: 'org-target',
    } as any);

    // Stale token says ADMIN, but database shows user was demoted to MEMBER
    prisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-target',
      role: 'MEMBER',
    });

    await gateway.handleConnection(socket);

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'INSUFFICIENT_PERMISSIONS' }));
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('allows connection and auto-joins room when database membership is verified ADMIN', async () => {
    const socket = createMockSocket({ token: 'valid-jwt', authOrgId: 'org-target' });
    jwtService.verify!.mockReturnValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      organizationId: 'org-target',
    } as any);

    prisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-target',
      role: 'ADMIN',
    });

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith('audit:org-target');
    expect(socket.emit).toHaveBeenCalledWith('connected', expect.objectContaining({ organizationId: 'org-target' }));
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('handleSubscribe re-verifies database membership before allowing subscription', async () => {
    const socket = createMockSocket({ token: 'valid-jwt', authOrgId: 'org-target' });
    jwtService.verify!.mockReturnValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      organizationId: 'org-target',
    } as any);

    prisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-target',
      role: 'ADMIN',
    });

    await gateway.handleConnection(socket);
    expect(socket.join).toHaveBeenCalledWith('audit:org-target');

    // Demote user in database
    prisma.organizationMember.findUnique.mockResolvedValue(null);

    await gateway.handleSubscribe(socket);

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'INSUFFICIENT_PERMISSIONS' }));
    expect(socket.disconnect).toHaveBeenCalled();
  });
});

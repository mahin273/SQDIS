import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { BullBoardAuthMiddleware } from './bull-board-auth.middleware';

describe('BullBoardAuthMiddleware', () => {
  let middleware: BullBoardAuthMiddleware;
  let configService: jest.Mocked<ConfigService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'BULL_BOARD_ENABLED') return 'true';
        if (key === 'BULL_BOARD_USER') return 'admin';
        if (key === 'BULL_BOARD_PASSWORD') return 'admin-secret-password';
        return defaultValue;
      }),
    } as any;

    jwtService = {
      verifyAsync: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullBoardAuthMiddleware,
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    middleware = module.get<BullBoardAuthMiddleware>(BullBoardAuthMiddleware);
  });

  const createMockReqRes = (headers: Record<string, string> = {}) => {
    const req = {
      headers,
      cookies: {},
      query: {},
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    } as any;

    const next = jest.fn();

    return { req, res, next };
  };

  it('blocks access with 403 when BULL_BOARD_ENABLED is false', async () => {
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'BULL_BOARD_ENABLED') return 'false';
      return defaultValue;
    });

    const { req, res, next } = createMockReqRes();
    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Bull Board queue dashboard is disabled',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with 401 and WWW-Authenticate header', async () => {
    const { req, res, next } = createMockReqRes();
    await middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="Bull Board Admin Area"');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid Basic authentication credentials with 401', async () => {
    const credentials = Buffer.from('admin:wrong-password').toString('base64');
    const { req, res, next } = createMockReqRes({
      authorization: `Basic ${credentials}`,
    });

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access with valid Basic authentication credentials', async () => {
    const credentials = Buffer.from('admin:admin-secret-password').toString('base64');
    const { req, res, next } = createMockReqRes({
      authorization: `Basic ${credentials}`,
    });

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows access with valid JWT token having ADMIN role', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      id: 'admin-user',
      role: Role.ADMIN,
    });

    const { req, res, next } = createMockReqRes({
      authorization: 'Bearer valid-admin-jwt',
    });

    await middleware.use(req, res, next);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-admin-jwt');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows access with valid JWT token having OWNER role', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      id: 'owner-user',
      role: Role.OWNER,
    });

    const { req, res, next } = createMockReqRes({
      authorization: 'Bearer valid-owner-jwt',
    });

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects access with 403 when JWT token belongs to non-admin role', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      id: 'dev-user',
      role: Role.DEVELOPER,
    });

    const { req, res, next } = createMockReqRes({
      authorization: 'Bearer valid-dev-jwt',
    });

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Admin or Owner privileges required to access Bull Board dashboard',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 when JWT token verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

    const { req, res, next } = createMockReqRes({
      authorization: 'Bearer expired-jwt',
    });

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

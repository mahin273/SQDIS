import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller('test-throttling')
class TestThrottlingController {
  @Post('auth-limited')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 2 } })
  authLimited() {
    return { ok: true };
  }

  @Post('unlimited')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ default: true, auth: true })
  unlimited() {
    return { ok: true };
  }
}

describe('ThrottlerGuard Enforcement', () => {
  let guard: ThrottlerGuard;
  let controller: TestThrottlingController;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 60000,
            limit: 100,
          },
          {
            name: 'auth',
            ttl: 60000,
            limit: 2,
          },
        ]),
      ],
      controllers: [TestThrottlingController],
      providers: [
        ThrottlerGuard,
        {
          provide: APP_GUARD,
          useExisting: ThrottlerGuard,
        },
      ],
    }).compile();

    await moduleRef.init();

    guard = moduleRef.get<ThrottlerGuard>(ThrottlerGuard);
    controller = moduleRef.get<TestThrottlingController>(TestThrottlingController);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  const mockContext = (handler: Function, ip = '192.168.1.100') => {
    const req = {
      headers: {},
      ip,
      ips: [],
      method: 'POST',
      url: '/test-throttling/auth-limited',
    };
    const res = {
      header: jest.fn(),
    };
    return {
      getHandler: () => handler,
      getClass: () => TestThrottlingController,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;
  };

  it('allows requests within the configured rate limit', async () => {
    const ctx = mockContext(controller.authLimited, '10.0.0.1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws ThrottlerException when rate limit is exceeded', async () => {
    const ctx = mockContext(controller.authLimited, '10.0.0.2');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('bypasses throttling when @SkipThrottle is applied', async () => {
    const ctx = mockContext(TestThrottlingController.prototype.unlimited, '10.0.0.3');
    for (let i = 0; i < 10; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
  });
});

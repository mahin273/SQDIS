import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailThrottlerGuard } from './guards/email-throttler.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    getCurrentUser: jest.fn(),
    getUserOrganizations: jest.fn(),
    switchOrganization: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideGuard(EmailThrottlerGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(GitHubAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(GoogleAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

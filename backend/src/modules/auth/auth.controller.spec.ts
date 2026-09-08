import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GitHubService } from '../github/github.service';
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
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
  };
  const githubServiceMock = {
    handleOAuthCallback: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: GitHubService, useValue: githubServiceMock },
      ],
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

  it('delegates updateProfile to authService', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' } as any;
    const dto = { name: 'New Name' };
    authServiceMock.updateProfile.mockResolvedValueOnce({ id: 'user-1', name: 'New Name' });

    const result = await controller.updateProfile(mockUser, dto);
    expect(authServiceMock.updateProfile).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'user-1', name: 'New Name' });
  });

  it('delegates changePassword to authService', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' } as any;
    const dto = { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' };
    const mockReq = { headers: {}, ip: '127.0.0.1' };
    authServiceMock.changePassword.mockResolvedValueOnce({ message: 'Password changed successfully' });

    const result = await controller.changePassword(mockUser, dto, mockReq);
    expect(authServiceMock.changePassword).toHaveBeenCalledWith('user-1', dto, '127.0.0.1');
    expect(result).toEqual({ message: 'Password changed successfully' });
  });
});

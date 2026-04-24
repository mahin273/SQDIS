//eslint-disable @typescript-eslint/no-explicit-any
import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponse, AuthUser } from './types/auth-response.type';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { EmailThrottlerGuard } from './guards/email-throttler.guard';
import { GetUser } from './decorators/get-user.decorator';
import type { RequestUser } from './decorators/get-user.decorator';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Extracts the client IP address from the request.
   * Handles proxied requests by checking X-Forwarded-For header.
   */
  private extractIpAddress(req: any): string {
    // Check X-Forwarded-For header (for proxied requests)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header (alternative proxy header)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to request.ip
    return req.ip || 'unknown';
  }

  @Public()
  @Post('register')
  @Throttle({ auth: { ttl: 60000, limit: 60 } }) // 5 requests per minute for auth endpoints
  @ApiOperation({ summary: 'Register a new user with email/password' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 429, description: 'Too many requests, retry after specified time' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 60 } }) // 5 requests per minute for auth endpoints
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests, retry after specified time' })
  async login(@Body() loginDto: LoginDto, @Req() req: any): Promise<AuthResponse> {
    const ipAddress = this.extractIpAddress(req);
    const userAgent = req.headers['user-agent'];
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 60 } }) // 5 requests per minute for auth endpoints
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many requests, retry after specified time' })
  async refresh(@Body() refreshDto: RefreshDto): Promise<AuthResponse> {
    return this.authService.refreshToken(refreshDto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Body() refreshDto: RefreshDto, @Req() req: any): Promise<{ message: string }> {
    const ipAddress = this.extractIpAddress(req);
    const userAgent = req.headers['user-agent'];
    await this.authService.logout(refreshDto.refreshToken, ipAddress, userAgent);
    return { message: 'Logout successful' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EmailThrottlerGuard)
  @Throttle({ passwordReset: { ttl: 3600000, limit: 3 } }) // 3 requests per hour per identifier
  @ApiOperation({ summary: 'Request a password reset email using email or username' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent (if account exists)',
  })
  @ApiResponse({ status: 429, description: 'Too many requests, please try again later' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ipAddress: string,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.identifier, ipAddress);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: any,
  ): Promise<{ message: string }> {
    const ipAddress = this.extractIpAddress(req);
    return this.authService.resetPassword(dto.token, dto.newPassword, ipAddress);
  }

  /**
   * Get current authenticated user information
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@GetUser() user: RequestUser): Promise<AuthUser> {
    const currentUser = await this.authService.getCurrentUser(user.id);
    if (!currentUser) {
      // This shouldn't happen if JWT is valid, but handle gracefully
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date(),
      };
    }
    return currentUser;
  }

  /**
   * Initiate Google OAuth flow
   */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth 2.0 login flow' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth consent screen' })
  async googleAuth(): Promise<void> {
    // Guard handles redirect to Google
  }

  /**
   * Handle Google OAuth callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Handle Google OAuth 2.0 callback' })
  @ApiResponse({ status: 302, description: 'OAuth successful, redirects to frontend with tokens' })
  @ApiResponse({ status: 401, description: 'OAuth authentication failed' })
  async googleAuthCallback(@Req() req: any, @Res() res: Response): Promise<void> {
    const authResponse = req.user as AuthResponse;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userParam = encodeURIComponent(JSON.stringify(authResponse.user));
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${authResponse.accessToken}&refreshToken=${authResponse.refreshToken}&user=${userParam}`;
    res.redirect(redirectUrl);
  }

  /**
   * Initiate GitHub OAuth flow
   */
  @Public()
  @Get('github')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth 2.0 login flow' })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub OAuth consent screen' })
  async githubAuth(): Promise<void> {
    // Guard handles redirect to GitHub
  }

  /**
   * Handle GitHub OAuth callback
   */
  @Public()
  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'Handle GitHub OAuth 2.0 callback' })
  @ApiResponse({
    status: 302,
    description: 'OAuth successful, redirects to frontend with tokens',
  })
  @ApiResponse({ status: 401, description: 'OAuth authentication failed' })
  async githubAuthCallback(@Req() req: any, @Res() res: Response): Promise<void> {
    const authResponse = req.user as AuthResponse;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userParam = encodeURIComponent(JSON.stringify(authResponse.user));
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${authResponse.accessToken}&refreshToken=${authResponse.refreshToken}&user=${userParam}`;
    res.redirect(redirectUrl);
  }

  /**
   * Get all organizations for the current user
   * Used for organization switching UI
   */
  @UseGuards(JwtAuthGuard)
  @Get('organizations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all organizations for the current user' })
  @ApiResponse({ status: 200, description: 'List of user organizations' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOrganizations(@GetUser('id') userId: string) {
    return this.authService.getUserOrganizations(userId);
  }

  /**
   * Switch organization context for multi-org users
   * Generates new tokens with the specified organization context
   */
  @UseGuards(JwtAuthGuard)
  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch to a different organization context' })
  @ApiResponse({
    status: 200,
    description: 'Organization switched successfully, returns new tokens',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'User does not have access to this organization' })
  async switchOrganization(
    @GetUser('id') userId: string,
    @Body() dto: SwitchOrganizationDto,
  ): Promise<AuthResponse> {
    return this.authService.switchOrganization(userId, dto.organizationId);
  }
}

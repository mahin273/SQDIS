import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../types/jwt-payload.types';

/**
 * JWT Strategy for Passport authentication
 * Validates JWT tokens and extracts user information

 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret-change-in-production'),
    });
  }

  /**
   * Validate JWT payload and return user
   * Called automatically by Passport after token verification
   */
  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return user object that will be attached to request
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: payload.organizationId,
      role: payload.role,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile, StrategyOptions } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * Google OAuth Profile structure
 */
export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Google OAuth 2.0 Strategy for Passport authentication
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const options: StrategyOptions = {
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '',
      scope: ['email', 'profile'],
    };
    super(options);
  }

  /**
   * Validate Google OAuth callback and extract user profile
   * Called automatically by Passport after Google authentication
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, emails, displayName, photos } = profile;

    // Extract primary email from Google profile
    const email = emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email found in Google profile'), undefined);
    }

    // Build Google profile object
    const googleProfile: GoogleProfile = {
      id,
      email,
      name: displayName || email.split('@')[0],
      avatarUrl: photos?.[0]?.value,
    };

    try {
      // Validate and create/link user via AuthService
      const user = await this.authService.validateOAuthUser('google', googleProfile);
      done(null, user);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}

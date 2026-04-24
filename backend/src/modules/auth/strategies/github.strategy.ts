/**eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * GitHub OAuth Profile structure
 */
export interface GitHubProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emails?: Array<{ value: string; primary: boolean; verified: boolean }>;
}

/**
 * GitHub OAuth 2.0 Strategy for Passport authentication
 */
@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL') || '',
      scope: ['user:email', 'read:user'],
    });
  }

  /**
   * Validate GitHub OAuth callback and extract user profile
   * Called automatically by Passport after GitHub authentication
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: Error | null, user?: any) => void,
  ): Promise<void> {
    const { id, emails, displayName, username, photos } = profile;

    // Extract primary email from GitHub profile
    // GitHub may return multiple emails, prefer primary verified email
    let email: string | undefined;
    const allEmails: Array<{ value: string; primary: boolean; verified: boolean }> = [];

    if (emails && emails.length > 0) {
      // Find primary email first
      const primaryEmail = emails.find((e: any) => e.primary && e.verified);
      if (primaryEmail) {
        email = primaryEmail.value;
      } else {
        // Fallback to first verified email
        const verifiedEmail = emails.find((e: any) => e.verified);
        email = verifiedEmail?.value || emails[0]?.value;
      }

      // Collect all emails for auto-linking
      emails.forEach((e: any) => {
        if (e.value) {
          allEmails.push({
            value: e.value,
            primary: e.primary || false,
            verified: e.verified || false,
          });
        }
      });
    }

    if (!email) {
      return done(new Error('No email found in GitHub profile'), undefined);
    }

    // Build GitHub profile object
    const githubProfile: GitHubProfile = {
      id,
      email,
      name: displayName || username || email.split('@')[0],
      avatarUrl: photos?.[0]?.value,
      emails: allEmails,
    };

    try {
      // Validate and create/link user via AuthService
      // Also auto-link GitHub emails
      const authResponse = await this.authService.validateGitHubOAuthUser(githubProfile);
      done(null, authResponse);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}

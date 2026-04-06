import { ApiProperty } from '@nestjs/swagger';

/**
 * Organization membership information for user
 */

export class UserMemberShip {
  @ApiProperty({ description: 'Organization ID' })
  organizationId: string;

  @ApiProperty({ description: 'Organization name' })
  organizationName: string;

  @ApiProperty({ description: 'Organization slug' })
  organizationSlug: string;

  @ApiProperty({ description: 'User role in this organization' })
  role: string;

  @ApiProperty({ description: 'When user joined this organization' })
  joinedAt: Date;
}

/**
 * User information returned in auth responses
 * Includes organization context for multi-tenancy
 */
export class AuthUser {
  @ApiProperty({ description: 'User unique identifider' })
  id: string;

  @ApiProperty({ description: 'User email address' })
  email: string;

  @ApiProperty({ description: 'User display name' })
  name: string;

  @ApiProperty({ description: 'User avater URL', required: false })
  avaterUrl?: string;

  @ApiProperty({ description: 'Account creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Current organization ID', required: false })
  organizationId?: string;

  @ApiProperty({
    description: 'User role in current organization',
    required: false,
  })
  role?: string;

  @ApiProperty({
    description: 'User organization membership',
    required: false,
    type: [UserMemberShip],
  })
  membership?: UserMemberShip[];
}

/**
 * Auth response structure
 * Returned after successfull login, registration, or token refresh
 */
export class AuthResponse {
  @ApiProperty({ description: 'JWT access token for API authentication' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access tokens' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration time in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'Token type (always "Bearer")' })
  tokenType: string;

  @ApiProperty({
    description: 'Authenticated user information',
    type: AuthUser,
  })
  user: AuthUser;
}

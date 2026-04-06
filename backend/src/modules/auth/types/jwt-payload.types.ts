/**
 * Jwt payload structure for access tokens
 * Contains user identification and org context
 */

export interface JwtPayload {
  sub: string; //user's unique identifier
  email: string; //user's email
  name: string;
  organizationId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}
/**
 * Refresh token payload structure
 * Contains minimal information for token refresh
 */
export interface RefreshTokenPayload {
  /** User's unique identifier */
  sub: string;

  /** Token type identifier */
  type: 'refresh';

  /** Token issued at timestamp */
  iat?: number;

  /** Token expiration timestamp */
  exp?: number;
}

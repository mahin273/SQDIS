import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from 'crypto';
/**
 * Service responsibl for cryptographically secure token generation and hashing
 * for password reset functionality
 */
@Injectable()
export class TokenService {
/**
 * Generate a cryptographically secure reset token
 * @returns object containing raw token (for email) and hash (for storage)
 */
generateResetToken():{rawToken: string;hashedToken:string}{
  const rawToken = randomBytes(32).toString('hex');
  const hashedToken = this.hashToken(rawToken);
  return {rawToken,hashedToken};
}

/**
 * Hash a token using SHA-256
 * @param rawToken - the raw token to hash
 * @returns The SHA-256 hash as hex string
 */
hashToken(rawToken:string):string{
  return createHash('sha256').update(rawToken).digest('hex');
}

  /**
   * Verify a token matches a hash
   * @param rawToken - The raw token to verify
   * @param hashedToken - The stored hash to compare against
   * @returns True if token matches hash
   */
verifyToken(rawToken: string, hashedToken: string):boolean{
  const computeHash = this.hashToken(rawToken);
  return computeHash === hashedToken;
}

}

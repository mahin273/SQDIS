/* eslint-disable */
import * as bcrypt from 'bcrypt';

/**
 * password utility function for hashing and verification
 */

export const BCRYPT_COST_FACTOR = 12;

/**
 * hash a plain text password using bcrypt
 * @param password - Plain text password to hash
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

/**
 * Verify a plain text password afainst a hash
 * @param password - plain text password to verify
 * @param hash - bcrypt hash to compare against
 * @returns True if password matches hash, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean>{
  return bcrypt.compare(password,hash)
}

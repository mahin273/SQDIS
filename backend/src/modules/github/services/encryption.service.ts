import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Encryption service for secure PAT storage using AES-256-GCM
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits for GCM
  private readonly authTagLength = 16; // 128 bits
  private readonly saltLength = 32;

  /**
   * Get encryption key from environment or generate a secure default
   * In production, this should always come from environment variables
   */
  private getEncryptionKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set');
    }
    // Use scrypt to derive a proper 256-bit key from the secret
    const salt = 'sqdis-encryption-salt'; // Fixed salt for deterministic key derivation
    return scryptSync(secret, salt, this.keyLength);
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * Returns: base64 encoded string containing IV + AuthTag + Ciphertext
   */
  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(this.ivLength);

    const cipher = createCipheriv(this.algorithm, key, iv, {
      authTagLength: this.authTagLength,
    });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine IV + AuthTag + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   * Expects: base64 encoded string containing IV + AuthTag + Ciphertext
   */
  decrypt(encryptedData: string): string {
    const key = this.getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract IV, AuthTag, and Ciphertext
    const iv = combined.subarray(0, this.ivLength);
    const authTag = combined.subarray(this.ivLength, this.ivLength + this.authTagLength);
    const ciphertext = combined.subarray(this.ivLength + this.authTagLength);

    const decipher = createDecipheriv(this.algorithm, key, iv, {
      authTagLength: this.authTagLength,
    });

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Generate a secure random encryption key
   * Useful for initial setup
   */
  generateKey(): string {
    return randomBytes(this.keyLength).toString('base64');
  }
}

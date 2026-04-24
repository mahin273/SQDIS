import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Interface representing an audit entry for hashing purposes
 */
export interface AuditEntry {
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * HashService provides cryptographic hashing functionality for tamper-proof audit logging.
 *
 * This service implements SHA-256 hashing for audit entries and maintains a hash chain
 * to ensure the integrity of the audit log. Each entry's hash is linked to the previous
 * entry's hash, creating an immutable chain that can detect any tampering.
 *
 */
@Injectable()
export class HashService {
  /**
   * Generates a SHA-256 hash for an audit entry.
   *
   * The hash is calculated from a normalized representation of the entry that includes:
   * - userId
   * - organizationId
   * - action
   * - resourceType
   * - resourceId
   * - timestamp (ISO 8601 format)
   * - metadata (JSON stringified)
   *
   * @param entry - The audit entry to hash
   * @returns A SHA-256 hash as a hexadecimal string
   *
   */
  async generateEntryHash(entry: AuditEntry): Promise<string> {
    const normalizedEntry = this.normalizeEntry(entry);
    return this.sha256(normalizedEntry);
  }

  /**
   * Verifies that an audit entry's hash matches the expected hash.
   *
   * This method recalculates the hash from the entry contents and compares it
   * with the expected hash. Any mismatch indicates potential tampering.
   *
   * @param entry - The audit entry to verify
   * @param expectedHash - The hash that should match the entry
   * @returns true if the hash matches, false if it doesn't (indicating tampering)
   *
   */
  async verifyEntryHash(entry: AuditEntry, expectedHash: string): Promise<boolean> {
    const calculatedHash = await this.generateEntryHash(entry);
    return calculatedHash === expectedHash;
  }

  /**
   * Generates a chain hash by combining the current entry hash with the previous entry hash.
   *
   * This creates a cryptographic link between consecutive audit entries, forming a chain
   * where each entry depends on the previous one. This makes it impossible to modify or
   * delete entries without breaking the chain.
   *
   * @param currentHash - The hash of the current entry
   * @param previousHash - The hash of the previous entry in the chain
   * @returns A SHA-256 hash of the combined hashes
   *
   */
  async generateChainHash(currentHash: string, previousHash: string): Promise<string> {
    const chainData = `${currentHash}${previousHash}`;
    return this.sha256(chainData);
  }

  /**
   * Normalizes an audit entry into a consistent string representation for hashing.
   *
   * This ensures that the same entry always produces the same hash, regardless of
   * property order or formatting differences. The normalization includes:
   * - Converting timestamp to ISO 8601 format
   * - Sorting object keys in metadata
   * - Using consistent JSON stringification
   *
   * @param entry - The audit entry to normalize
   * @returns A normalized string representation of the entry
   *
   * @private
   */
  private normalizeEntry(entry: AuditEntry): string {
    // Create a normalized object with consistent property order
    const normalizedData = {
      userId: entry.userId,
      organizationId: entry.organizationId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      timestamp: entry.timestamp.toISOString(),
      metadata: entry.metadata ? this.sortObjectKeys(entry.metadata) : null,
    };

    // Convert to JSON string with consistent formatting
    return JSON.stringify(normalizedData);
  }

  /**
   * Recursively sorts object keys to ensure consistent JSON stringification.
   *
   * @param obj - The object to sort
   * @returns A new object with sorted keys
   *
   * @private
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }

    const sortedObj: Record<string, any> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }

    return sortedObj;
  }

  /**
   * Generates a SHA-256 hash of the input data.
   *
   * @param data - The data to hash
   * @returns A SHA-256 hash as a hexadecimal string
   *
   * @private
   */
  private sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}

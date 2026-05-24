import { Injectable } from '@nestjs/common';

/**
 * Service for email validation
 */
@Injectable()
export class EmailValidationService {
  // RFC 5322 compliant email regex pattern
  private readonly emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Common disposable email domains to reject
  private readonly disposableDomains = new Set([
    'tempmail.com',
    'throwaway.email',
    'guerrillamail.com',
    'mailinator.com',
    '10minutemail.com',
    'temp-mail.org',
    'fakeinbox.com',
    'trashmail.com',
  ]);

  /**
   * Validate email format
   * Returns true if the email is valid, false otherwise
   */
  isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check basic format
    if (!this.emailRegex.test(trimmedEmail)) {
      return false;
    }

    // Check length constraints
    if (trimmedEmail.length > 254) {
      return false;
    }

    // Check local part length (before @)
    const [localPart, domain] = trimmedEmail.split('@');
    if (!localPart || localPart.length > 64) {
      return false;
    }

    // Check domain exists
    if (!domain || domain.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Check if email domain is a known disposable email provider
   */
  isDisposableEmail(email: string): boolean {
    if (!email) {
      return false;
    }

    const domain = email.toLowerCase().split('@')[1];
    return this.disposableDomains.has(domain);
  }

  /**
   * Normalize email address (lowercase, trim whitespace)
   */
  normalizeEmail(email: string): string {
    if (!email) {
      return '';
    }
    return email.trim().toLowerCase();
  }

  /**
   * Extract domain from email address
   */
  extractDomain(email: string): string | null {
    if (!email || !this.isValidEmail(email)) {
      return null;
    }
    return email.toLowerCase().split('@')[1];
  }

  /**
   * Check if two emails have the same domain
   */
  haveSameDomain(email1: string, email2: string): boolean {
    const domain1 = this.extractDomain(email1);
    const domain2 = this.extractDomain(email2);

    if (!domain1 || !domain2) {
      return false;
    }

    return domain1 === domain2;
  }

  /**
   * Check if email matches a pattern (for suggesting unmapped emails)
   */
  matchesNamePattern(email: string, name: string): boolean {
    if (!email || !name) {
      return false;
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedName = name.toLowerCase();

    // Split name into parts
    const nameParts = normalizedName.split(/\s+/).filter((part) => part.length > 2);

    // Get local part of email
    const localPart = normalizedEmail.split('@')[0];

    // Check if any name part appears in the email local part
    return nameParts.some((part) => localPart.includes(part));
  }
}

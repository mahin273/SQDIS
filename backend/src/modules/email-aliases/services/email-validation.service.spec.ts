import { EmailValidationService } from './email-validation.service';

describe('EmailValidationService', () => {
  let service: EmailValidationService;

  beforeEach(() => {
    service = new EmailValidationService();
  });

  describe('isValidEmail', () => {
    it.each(['dev@example.com', 'user.name+tag@company.co.uk'])(
      'accepts valid email addresses: %s',
      (email) => {
        expect(service.isValidEmail(email)).toBe(true);
      },
    );

    it.each(['', 'not-an-email', '@missing-local.com', 'user@', 'user@.com'])(
      'rejects invalid email addresses: %s',
      (email) => {
        expect(service.isValidEmail(email)).toBe(false);
      },
    );
  });

  describe('isDisposableEmail', () => {
    it('flags known disposable email domains', () => {
      expect(service.isDisposableEmail('user@mailinator.com')).toBe(true);
      expect(service.isDisposableEmail('user@example.com')).toBe(false);
    });
  });

  describe('normalizeEmail', () => {
    it('lowercases and trims email addresses', () => {
      expect(service.normalizeEmail('  DEV@Example.COM  ')).toBe('dev@example.com');
      expect(service.normalizeEmail('')).toBe('');
    });
  });

  describe('extractDomain', () => {
    it('returns the domain for valid emails and null otherwise', () => {
      expect(service.extractDomain('dev@example.com')).toBe('example.com');
      expect(service.extractDomain('invalid-email')).toBeNull();
    });
  });

  describe('haveSameDomain', () => {
    it('compares domains from two valid email addresses', () => {
      expect(service.haveSameDomain('alice@acme.com', 'bob@acme.com')).toBe(true);
      expect(service.haveSameDomain('alice@acme.com', 'bob@other.com')).toBe(false);
      expect(service.haveSameDomain('invalid', 'bob@acme.com')).toBe(false);
    });
  });

  describe('matchesNamePattern', () => {
    it('matches when a name part appears in the email local part', () => {
      expect(service.matchesNamePattern('john.doe@example.com', 'John Doe')).toBe(true);
      expect(service.matchesNamePattern('jane@example.com', 'John Doe')).toBe(false);
    });
  });
});

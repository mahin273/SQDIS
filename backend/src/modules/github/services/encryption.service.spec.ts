import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const originalEnv = process.env;
  let service: EncryptionService;

  beforeEach(() => {
    process.env = { ...originalEnv, ENCRYPTION_KEY: 'test-secret-key-for-unit-tests' };
    service = new EncryptionService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts plaintext round-trip', () => {
    const plaintext = 'github_pat_12345';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext due to a random IV', () => {
    const encrypted1 = service.encrypt('same-value');
    const encrypted2 = service.encrypt('same-value');

    expect(encrypted1).not.toBe(encrypted2);
    expect(service.decrypt(encrypted1)).toBe('same-value');
    expect(service.decrypt(encrypted2)).toBe('same-value');
  });

  it('throws when no encryption key is configured', () => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;
    service = new EncryptionService();

    expect(() => service.encrypt('test')).toThrow('ENCRYPTION_KEY or JWT_SECRET must be set');
  });

  it('generates a base64-encoded 256-bit key', () => {
    const key = service.generateKey();

    expect(Buffer.from(key, 'base64')).toHaveLength(32);
  });
});

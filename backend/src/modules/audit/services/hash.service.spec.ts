import { createHash } from 'crypto';
import { AuditEntry, HashService } from './hash.service';

describe('HashService', () => {
  let service: HashService;

  const entry: AuditEntry = {
    userId: 'user-1',
    organizationId: 'org-1',
    action: 'CREATE',
    resourceType: 'project',
    resourceId: 'proj-1',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    metadata: { b: 2, a: 1 },
  };

  beforeEach(() => {
    service = new HashService();
  });

  it('generates deterministic SHA-256 entry hashes', async () => {
    const hash1 = await service.generateEntryHash(entry);
    const hash2 = await service.generateEntryHash(entry);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizes metadata key order before hashing', async () => {
    const hash1 = await service.generateEntryHash(entry);
    const hash2 = await service.generateEntryHash({
      ...entry,
      metadata: { a: 1, b: 2 },
    });

    expect(hash1).toBe(hash2);
  });

  it('verifies matching and tampered entry hashes', async () => {
    const hash = await service.generateEntryHash(entry);

    await expect(service.verifyEntryHash(entry, hash)).resolves.toBe(true);
    await expect(
      service.verifyEntryHash({ ...entry, action: 'DELETE' }, hash),
    ).resolves.toBe(false);
  });

  it('generates chain hashes by combining current and previous hashes', async () => {
    const currentHash = await service.generateEntryHash(entry);
    const previousHash = 'previous-entry-hash';
    const chainHash = await service.generateChainHash(currentHash, previousHash);
    const expected = createHash('sha256').update(`${currentHash}${previousHash}`).digest('hex');

    expect(chainHash).toBe(expected);
  });
});

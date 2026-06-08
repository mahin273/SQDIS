import { BCRYPT_COST_FACTOR, hashPassword, verifyPassword } from './password.util';

describe('password utilities', () => {
  it('hashes and verifies passwords with bcrypt', async () => {
    const hash = await hashPassword('Str0ngPass!');

    expect(hash).not.toBe('Str0ngPass!');
    expect(await verifyPassword('Str0ngPass!', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('uses the configured bcrypt cost factor', async () => {
    const hash = await hashPassword('test-password');
    const rounds = parseInt(hash.split('$')[2], 10);

    expect(rounds).toBe(BCRYPT_COST_FACTOR);
  });
});

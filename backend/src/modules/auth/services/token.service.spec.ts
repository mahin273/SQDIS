import { randomBytes } from 'crypto';
import { TokenService } from './token.service';

jest.mock('crypto', () => ({
  ...jest.requireActual<typeof import('crypto')>('crypto'),
  randomBytes: jest.fn(),
}));

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    service = new TokenService();
    jest.mocked(randomBytes).mockReturnValue(Buffer.alloc(32, 0xab) as ReturnType<typeof randomBytes>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('generates a raw token and corresponding SHA-256 hash', () => {
    const { rawToken, hashedToken } = service.generateResetToken();

    expect(rawToken).toHaveLength(64);
    expect(hashedToken).toBe(service.hashToken(rawToken));
    expect(hashedToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it('verifies matching and non-matching tokens', () => {
    const rawToken = 'reset-token-value';
    const hashedToken = service.hashToken(rawToken);

    expect(service.verifyToken(rawToken, hashedToken)).toBe(true);
    expect(service.verifyToken('tampered-token', hashedToken)).toBe(false);
  });
});

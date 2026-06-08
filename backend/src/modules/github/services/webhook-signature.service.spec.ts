import { WebhookSignatureService } from './webhook-signature.service';

describe('WebhookSignatureService', () => {
  let service: WebhookSignatureService;

  beforeEach(() => {
    service = new WebhookSignatureService();
  });

  it('computes and verifies a valid sha256 GitHub signature', () => {
    const payload = JSON.stringify({ repository: { id: 123 } });
    const secret = 'webhook-secret';
    const signature = `sha256=${service.computeSignature(payload, secret)}`;

    expect(service.verifySignature(payload, signature, secret)).toBe(true);
  });

  it.each([
    { payload: '', signature: 'sha256=abc', secret: 'secret' },
    { payload: '{"ok":true}', signature: '', secret: 'secret' },
    { payload: '{"ok":true}', signature: 'sha1=abc', secret: 'secret' },
    { payload: '{"ok":true}', signature: 'sha256=abc', secret: '' },
  ])('rejects missing or malformed signature inputs %#', ({ payload, signature, secret }) => {
    expect(service.verifySignature(payload, signature, secret)).toBe(false);
  });

  it('rejects signatures that do not match the payload', () => {
    const signature = `sha256=${service.computeSignature('original', 'secret')}`;

    expect(service.verifySignature('tampered', signature, 'secret')).toBe(false);
  });
});

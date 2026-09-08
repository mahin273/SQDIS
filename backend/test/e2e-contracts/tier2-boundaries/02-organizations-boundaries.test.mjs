import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix } from '../helpers/fixtures.mjs';
import { ApiClient } from '../helpers/api-client.mjs';
import { assertError } from '../helpers/assertions.mjs';

describe('Tier 2: Boundary & Corner Cases - Module 02: Organizations & Members', () => {
  let ctx;
  let client;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;
  });

  it('2.2.1: POST /organizations - Reject missing or empty name/slug', async () => {
    const res = await client.post('/organizations', {
      name: '',
      slug: '',
    });
    assertError(res, 400, null, 'Empty name/slug');
  });

  it('2.2.2: POST /organizations - Reject duplicate slug with 409 Conflict', async () => {
    const slug = `slug-${uniqueSuffix().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const first = await client.post('/organizations', {
      name: 'Initial Org',
      slug,
    });
    assert.strictEqual(first.status, 201);

    const dup = await client.post('/organizations', {
      name: 'Duplicate Slug Org',
      slug,
    });
    assertError(dup, 409, null, 'Duplicate org slug');
  });

  it('2.2.3: GET /organizations/:id - Reject non-existent organization with 403 or 404', async () => {
    const nonExistentId = '11111111-2222-4333-8444-555555555555';
    const res = await client.get(`/organizations/${nonExistentId}`);
    assert.ok([403, 404].includes(res.status), `Expected 403 or 404, got ${res.status}`);
  });

  it('2.2.4: POST /organizations/:id/invite - Reject invalid email format', async () => {
    const res = await client.post(`/organizations/${ctx.org.id}/invite`, {
      email: 'not-an-email',
    });
    assertError(res, 400, null, 'Invalid invitation email');
  });

  it('2.2.5: GET /organizations/members - Reject request without authentication', async () => {
    const unauthClient = new ApiClient();
    const res = await unauthClient.get('/organizations/members');
    assertError(res, 401, null, 'Unauthenticated members request');
  });

  it('2.2.6: DELETE /organizations/:id/members/:userId - Reject user removing themselves with 403 Forbidden', async () => {
    const res = await client.delete(`/organizations/${ctx.org.id}/members/${ctx.user.id}`);
    assert.strictEqual(res.status, 403, 'Self-removal should be rejected with 403');
  });
});

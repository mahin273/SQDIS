import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix, createTestUser } from '../helpers/fixtures.mjs';
import { ApiClient } from '../helpers/api-client.mjs';
import { assertError } from '../helpers/assertions.mjs';

describe('Tier 2: Boundary & Corner Cases - Module 04: Teams & Assignments', () => {
  let ctx;
  let client;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;
  });

  it('2.4.1: POST /teams - Reject empty team name with 400 Bad Request', async () => {
    const res = await client.post('/teams', {
      name: '',
      description: 'Empty name',
    });
    assertError(res, 400, null, 'Empty team name');
  });

  it('2.4.2: POST /teams - Reject duplicate team name in same organization with 409 Conflict', async () => {
    const name = `Duplicate Team ${uniqueSuffix()}`;
    const first = await client.post('/teams', { name });
    assert.strictEqual(first.status, 201);

    const dup = await client.post('/teams', { name });
    assertError(dup, 409, null, 'Duplicate team name');
  });

  it('2.4.3: GET /teams/:id - Return 404 for non-existent team UUID', async () => {
    const res = await client.get('/teams/12345678-1234-4234-8234-123456789012');
    assert.strictEqual(res.status, 404, 'Non-existent team should return 404');
  });

  it('2.4.4: POST /teams - Reject request from user without organization context', async () => {
    const freshUser = await createTestUser();
    const noOrgClient = new ApiClient().setToken(freshUser.accessToken);

    const res = await noOrgClient.post('/teams', {
      name: `Orphan Team ${uniqueSuffix()}`,
    });
    assert.ok([400, 401, 403].includes(res.status), `Expected error status, got ${res.status}`);
  });

  it('2.4.5: PATCH /teams/:id - Reject updating non-existent team with 404 Not Found', async () => {
    const res = await client.patch('/teams/12345678-1234-4234-8234-123456789012', {
      name: 'Non-existent Team Name',
    });
    assert.strictEqual(res.status, 404, 'Updating non-existent team should return 404');
  });
});

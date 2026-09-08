import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ApiClient } from '../helpers/api-client.mjs';
import { uniqueSuffix, createTestUser } from '../helpers/fixtures.mjs';
import { assertError } from '../helpers/assertions.mjs';

describe('Tier 2: Boundary & Corner Cases - Module 01: Auth & Multi-Tenancy', () => {
  const client = new ApiClient();

  it('2.1.1: POST /auth/register - Reject invalid email syntax', async () => {
    const res = await client.post('/auth/register', {
      email: 'not-an-email',
      password: 'ValidPassword123!',
      name: 'Tester',
    });
    assertError(res, 400, null, 'Register invalid email');
  });

  it('2.1.2: POST /auth/register - Reject weak password (< 8 characters or no uppercase/number)', async () => {
    const res = await client.post('/auth/register', {
      email: `valid_${uniqueSuffix()}@example.com`,
      password: 'short',
      name: 'Tester',
    });
    assertError(res, 400, null, 'Register short password');
  });

  it('2.1.3: POST /auth/register - Reject duplicate email registration with 409 Conflict', async () => {
    const existing = await createTestUser(client);
    const dupRes = await client.post('/auth/register', {
      email: existing.email,
      password: 'Password123!',
      name: 'Duplicate',
    });
    assertError(dupRes, 409, null, 'Duplicate email collision');
  });

  it('2.1.4: POST /auth/login - Reject invalid credentials with 401 Unauthorized', async () => {
    const res = await client.post('/auth/login', {
      email: `nonexistent_${uniqueSuffix()}@example.com`,
      password: 'WrongPassword123!',
    });
    assertError(res, 401, null, 'Invalid login');
  });

  it('2.1.5: GET /auth/me - Reject unauthenticated access (missing / invalid token)', async () => {
    const unauthClient = new ApiClient();
    const resNoToken = await unauthClient.get('/auth/me');
    assertError(resNoToken, 401, null, 'Missing token');

    unauthClient.setToken('invalid-garbage-jwt-token');
    const resInvalidToken = await unauthClient.get('/auth/me');
    assertError(resInvalidToken, 401, null, 'Garbage token');
  });

  it('2.1.6: POST /auth/refresh - Reject expired or invalid refresh token', async () => {
    const res = await client.post('/auth/refresh', {
      refreshToken: '00000000-invalid-refresh-token',
    });
    assertError(res, 401, null, 'Invalid refresh token');
  });

  it('2.1.7: POST /auth/switch-organization - Reject malformed non-UUID format with 400 Bad Request', async () => {
    const user = await createTestUser(client);
    const authClient = client.clone().setToken(user.accessToken);

    const res = await authClient.post('/auth/switch-organization', {
      organizationId: 'not-a-uuid',
    });
    assertError(res, 400, 'UUID', 'Malformed UUID');
  });

  it('2.1.8: POST /auth/switch-organization - Reject switching to unauthorized organization context with 403 Forbidden', async () => {
    const user = await createTestUser(client);
    const authClient = client.clone().setToken(user.accessToken);

    const unauthorizedOrgId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const res = await authClient.post('/auth/switch-organization', {
      organizationId: unauthorizedOrgId,
    });
    assert.ok([403, 404].includes(res.status), `Expected 403 or 404, got ${res.status}`);
  });
});

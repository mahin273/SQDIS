import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { ApiClient } from '../helpers/api-client.mjs';
import { uniqueSuffix } from '../helpers/fixtures.mjs';
import { assertSuccess, assertProperties } from '../helpers/assertions.mjs';

describe('Tier 1: Feature Coverage - Module 01: Auth & Multi-Tenancy', () => {
  const client = new ApiClient();
  let userEmail;
  let userPassword = 'InitialPassword123!';
  let newPassword = 'UpdatedPassword456!';
  let initialAccessToken;
  let refreshToken;
  let userId;
  let orgId;

  before(async () => {
    const suffix = uniqueSuffix();
    userEmail = `auth_test_${suffix}@example.com`;
  });

  it('1.1: POST /auth/register - Successfully register new user', async () => {
    const res = await client.post('/auth/register', {
      email: userEmail,
      password: userPassword,
      name: 'Auth Test User',
    });

    assertSuccess(res, 201, 'User registration');
    assertProperties(res.data, ['accessToken', 'refreshToken', 'user'], 'Registration response');
    assert.strictEqual(res.data.user.email, userEmail);
    assert.strictEqual(res.data.user.name, 'Auth Test User');
    assert.ok(res.data.accessToken, 'Access token should be returned');
    assert.ok(res.data.refreshToken, 'Refresh token should be returned');

    initialAccessToken = res.data.accessToken;
    refreshToken = res.data.refreshToken;
    userId = res.data.user.id;
    client.setToken(initialAccessToken);
  });

  it('1.2: POST /auth/login - Successfully login with valid credentials', async () => {
    const res = await client.post('/auth/login', {
      email: userEmail,
      password: userPassword,
    });

    assertSuccess(res, 200, 'User login');
    assertProperties(res.data, ['accessToken', 'refreshToken', 'user'], 'Login response');
    assert.strictEqual(res.data.user.email, userEmail);
    assert.ok(res.data.accessToken);
    client.setToken(res.data.accessToken);
    refreshToken = res.data.refreshToken;
  });

  it('1.3: GET /auth/me - Retrieve current authenticated user profile', async () => {
    const res = await client.get('/auth/me');

    assertSuccess(res, 200, 'Get current user');
    assert.strictEqual(res.data.id, userId);
    assert.strictEqual(res.data.email, userEmail);
  });

  it('1.4: POST /auth/refresh - Refresh access token using valid refresh token', async () => {
    const res = await client.post('/auth/refresh', {
      refreshToken,
    });

    assertSuccess(res, 200, 'Token refresh');
    assert.ok(res.data.accessToken, 'Should return refreshed access token');
    client.setToken(res.data.accessToken);
  });

  it('1.5: PATCH /auth/profile - Update user profile attributes', async () => {
    const updatedName = 'Updated Auth Name';
    const res = await client.patch('/auth/profile', {
      name: updatedName,
    });

    assertSuccess(res, 200, 'Update profile');
    assert.strictEqual(res.data.name, updatedName);

    const meRes = await client.get('/auth/me');
    assert.strictEqual(meRes.data.name, updatedName);
  });

  it('1.6: POST /auth/switch-organization - Multi-tenancy context switching', async () => {
    // Create an organization first to switch into
    const suffix = uniqueSuffix();
    const orgRes = await client.post('/organizations', {
      name: `Tenant Org ${suffix}`,
      slug: `tenant-org-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    });
    assertSuccess(orgRes, 201, 'Create org for tenant switch');
    orgId = orgRes.data.id;

    // Switch organization
    const switchRes = await client.post('/auth/switch-organization', {
      organizationId: orgId,
    });
    assertSuccess(switchRes, 200, 'Switch organization context');
    assert.ok(switchRes.data.accessToken, 'Switched token returned');
    assert.strictEqual(switchRes.data.user.organizationId, orgId);

    // Verify switched token contains organizationId claim in client
    client.setToken(switchRes.data.accessToken);
    client.setOrganizationId(orgId);
  });

  it('1.7: POST /auth/change-password - Change user password and verify subsequent login', async () => {
    const res = await client.post('/auth/change-password', {
      currentPassword: userPassword,
      newPassword: newPassword,
    });
    assertSuccess(res, 200, 'Change password');

    // Verify login with new password
    const loginRes = await client.post('/auth/login', {
      email: userEmail,
      password: newPassword,
    });
    assertSuccess(loginRes, 200, 'Login with new password');
    assert.ok(loginRes.data.accessToken);
  });
});

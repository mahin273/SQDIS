/**
 * Test Fixtures and Context Builders for SQDIS E2E Tests
 */
import { ApiClient } from './api-client.mjs';

let counter = 0;
export function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}_${counter}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Registers a unique user and returns the auth response
 */
export async function createTestUser(client = new ApiClient(), overrides = {}) {
  const suffix = uniqueSuffix();
  const email = overrides.email || `e2e_user_${suffix}@example.com`;
  const password = overrides.password || 'Password123!';
  const name = overrides.name || `E2E Tester ${suffix}`;

  const res = await client.post('/auth/register', { email, password, name });
  if (res.status !== 201) {
    throw new Error(`Failed to create test user: ${res.status} ${JSON.stringify(res.data)}`);
  }

  return {
    email,
    password,
    name,
    user: res.data.user,
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
  };
}

/**
 * Sets up a fully authenticated client with a fresh user, fresh org, and org-scoped JWT
 */
export async function setupAuthenticatedContext(baseClient = new ApiClient()) {
  const client = baseClient.clone();
  const userContext = await createTestUser(client);
  client.setToken(userContext.accessToken);

  const suffix = uniqueSuffix();
  const orgSlug = `test-org-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const orgName = `Test Org ${suffix}`;

  const orgRes = await client.post('/organizations', {
    name: orgName,
    slug: orgSlug,
  });

  if (orgRes.status !== 201) {
    throw new Error(`Failed to create test organization: ${orgRes.status} ${JSON.stringify(orgRes.data)}`);
  }

  const org = orgRes.data;
  client.setOrganizationId(org.id);

  // Switch organization context to receive an org-scoped JWT token with Role.OWNER
  const switchRes = await client.post('/auth/switch-organization', {
    organizationId: org.id,
  });

  if (switchRes.status === 200 && switchRes.data?.accessToken) {
    client.setToken(switchRes.data.accessToken);
  }

  return {
    client,
    user: userContext.user,
    org,
    token: client.token,
    credentials: {
      email: userContext.email,
      password: userContext.password,
    },
  };
}

/**
 * Discovers any pre-existing seeded organization and repositories (e.g. Mahin / SQDIS)
 */
export async function getExistingPlatformContext(client) {
  // If we can login or if we have admin credentials, otherwise look up through client
  const res = await client.get('/organizations');
  if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
    const org = res.data[0];
    const orgClient = client.clone().setOrganizationId(org.id);
    const projectsRes = await orgClient.get('/projects');
    const teamsRes = await orgClient.get('/teams');
    return {
      org,
      projects: Array.isArray(projectsRes.data) ? projectsRes.data : [],
      teams: Array.isArray(teamsRes.data) ? teamsRes.data : [],
    };
  }
  return null;
}

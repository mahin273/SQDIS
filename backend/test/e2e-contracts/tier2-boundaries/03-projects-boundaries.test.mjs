import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix } from '../helpers/fixtures.mjs';
import { ApiClient } from '../helpers/api-client.mjs';
import { assertError } from '../helpers/assertions.mjs';

describe('Tier 2: Boundary & Corner Cases - Module 03: Projects Management', () => {
  let ctx;
  let client;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;
  });

  it('2.3.1: POST /projects - Reject empty project name with 400 Bad Request', async () => {
    const res = await client.post('/projects', {
      name: '',
      description: 'Empty name test',
    });
    assertError(res, 400, null, 'Empty project name');
  });

  it('2.3.2: POST /projects - Reject duplicate project name in same organization with 409 Conflict', async () => {
    const name = `Duplicate Proj ${uniqueSuffix()}`;
    const first = await client.post('/projects', { name });
    assert.strictEqual(first.status, 201);

    const dup = await client.post('/projects', { name });
    assertError(dup, 409, null, 'Duplicate project name');
  });

  it('2.3.3: GET /projects/:id - Reject invalid non-UUID identifier with 400 Bad Request', async () => {
    const res = await client.get('/projects/not-a-valid-uuid');
    assertError(res, 400, null, 'Invalid project UUID');
  });

  it('2.3.4: GET /projects/:id - Return 404 for non-existent project UUID', async () => {
    const res = await client.get('/projects/99999999-9999-4999-8999-999999999999');
    assert.strictEqual(res.status, 404, 'Non-existent project should return 404');
  });

  it('2.3.5: POST /projects - Reject creation without organization context with 400 or 403', async () => {
    const noOrgClient = client.clone();
    noOrgClient.setOrganizationId(null);

    const res = await noOrgClient.post('/projects', {
      name: `No Org Proj ${uniqueSuffix()}`,
    }, {
      headers: { 'X-Organization-Id': '' },
    });
    assert.ok([400, 401, 403].includes(res.status), `Expected 400/401/403, got ${res.status}`);
  });
});

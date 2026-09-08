import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix } from '../helpers/fixtures.mjs';
import { assertSuccess, assertProperties } from '../helpers/assertions.mjs';

describe('Tier 1: Feature Coverage - Module 03: Projects Management', () => {
  let ctx;
  let client;
  let createdProjectId;
  let initialProjectName;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;
    initialProjectName = `Project ${uniqueSuffix()}`;
  });

  it('1.3.1: POST /projects - Create a new project within active organization', async () => {
    const res = await client.post('/projects', {
      name: initialProjectName,
      description: 'E2E Testing Project Description',
    });

    assertSuccess(res, 201, 'Create project');
    assertProperties(res.data, ['id', 'name', 'organizationId'], 'Project payload');
    assert.strictEqual(res.data.name, initialProjectName);
    assert.strictEqual(res.data.organizationId, ctx.org.id);
    createdProjectId = res.data.id;
  });

  it('1.3.2: GET /projects - List all projects for organization', async () => {
    const res = await client.get('/projects');

    assertSuccess(res, 200, 'List projects');
    assert.ok(Array.isArray(res.data), 'Expected array of projects');
    const match = res.data.find(p => p.id === createdProjectId);
    assert.ok(match, 'Created project must be in returned list');
    assert.strictEqual(match.name, initialProjectName);
  });

  it('1.3.3: GET /projects/:id - Retrieve project by ID', async () => {
    const res = await client.get(`/projects/${createdProjectId}`);

    assertSuccess(res, 200, 'Get project by ID');
    assert.strictEqual(res.data.id, createdProjectId);
    assert.strictEqual(res.data.name, initialProjectName);
  });

  it('1.3.4: PATCH /projects/:id - Update project name and description', async () => {
    const updatedName = `Renamed ${uniqueSuffix()}`;
    const res = await client.patch(`/projects/${createdProjectId}`, {
      name: updatedName,
      description: 'Updated description for E2E verification',
    });

    assertSuccess(res, 200, 'Update project');
    assert.strictEqual(res.data.name, updatedName);
  });

  it('1.3.5: DELETE /projects/:id - Delete project and verify removal', async () => {
    // Create a temporary project to delete
    const tempRes = await client.post('/projects', {
      name: `Temp Project ${uniqueSuffix()}`,
      description: 'Will be deleted',
    });
    assertSuccess(tempRes, 201, 'Create temp project');
    const tempId = tempRes.data.id;

    const delRes = await client.delete(`/projects/${tempId}`);
    assert.ok([200, 204].includes(delRes.status), `Expected 200 or 204, got ${delRes.status}`);

    const verifyRes = await client.get(`/projects/${tempId}`);
    assert.strictEqual(verifyRes.status, 404, 'Deleted project should return 404');
  });
});

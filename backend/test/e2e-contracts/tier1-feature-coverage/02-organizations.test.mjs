import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix } from '../helpers/fixtures.mjs';
import { assertSuccess, assertProperties } from '../helpers/assertions.mjs';

describe('Tier 1: Feature Coverage - Module 02: Organizations & Members', () => {
  let ctx;
  let client;
  let testOrg;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;
    testOrg = ctx.org;
  });

  it('1.2.1: POST /organizations - Create new organization', async () => {
    const suffix = uniqueSuffix();
    const res = await client.post('/organizations', {
      name: `Org ${suffix}`,
      slug: `org-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    });

    assertSuccess(res, 201, 'Create organization');
    assertProperties(res.data, ['id', 'name', 'slug'], 'Org payload');
    assert.ok(res.data.id);
  });

  it('1.2.2: GET /organizations - List all organizations for authenticated user', async () => {
    const res = await client.get('/organizations');

    assertSuccess(res, 200, 'List organizations');
    assert.ok(Array.isArray(res.data), 'Expected array of organizations');
    assert.ok(res.data.length > 0, 'User should have at least one organization');
    const match = res.data.find(o => o.id === testOrg.id);
    assert.ok(match, 'Current org should be listed in user orgs');
  });

  it('1.2.3: GET /organizations/:id - Get organization details by ID', async () => {
    const res = await client.get(`/organizations/${testOrg.id}`);

    assertSuccess(res, 200, 'Get org by ID');
    assert.strictEqual(res.data.id, testOrg.id);
    assert.strictEqual(res.data.slug, testOrg.slug);
  });

  it('1.2.4: PATCH /organizations/:id - Update organization settings', async () => {
    const updatedName = `Renamed Org ${uniqueSuffix()}`;
    const res = await client.patch(`/organizations/${testOrg.id}`, {
      name: updatedName,
    });

    assertSuccess(res, 200, 'Update org');
    assert.strictEqual(res.data.name, updatedName);
  });

  it('1.2.5: GET /organizations/members - List members of current organization context', async () => {
    const res = await client.get('/organizations/members');

    assertSuccess(res, 200, 'List org members');
    assert.ok(Array.isArray(res.data), 'Expected array of members');
    assert.ok(res.data.length >= 1, 'Org should have at least the owner');
    assert.strictEqual(res.data[0].userId, ctx.user.id);
  });

  it('1.2.6: POST /organizations/:id/invite - Invite a new member by email', async () => {
    const inviteeEmail = `invitee_${uniqueSuffix()}@example.com`;
    const res = await client.post(`/organizations/${testOrg.id}/invite`, {
      email: inviteeEmail,
    });

    assertSuccess(res, 201, 'Invite member');
    assertProperties(res.data, ['id', 'email', 'token'], 'Invitation response');
    assert.strictEqual(res.data.email, inviteeEmail);
  });

  it('1.2.7: GET /organizations/:id/invitations - List pending invitations', async () => {
    const res = await client.get(`/organizations/${testOrg.id}/invitations`);

    assertSuccess(res, 200, 'List invitations');
    assert.ok(Array.isArray(res.data), 'Expected array of invitations');
    assert.ok(res.data.length >= 1, 'Should contain at least one invitation');
  });
});

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix } from '../helpers/fixtures.mjs';
import { assertError } from '../helpers/assertions.mjs';

describe('Tier 2: Boundary & Corner Cases - Module 05: Sprints & Burndown', () => {
  let ctx;
  let client;
  let teamId;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;

    const teamRes = await client.post('/teams', {
      name: `Sprint Boundary Team ${uniqueSuffix()}`,
    });
    assert.strictEqual(teamRes.status, 201);
    teamId = teamRes.data.id;
  });

  it('2.5.1: POST /sprints - Reject invalid chronological date ordering (endDate before startDate)', async () => {
    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(now.getTime()).toISOString(); // Inverted dates

    const res = await client.post('/sprints', {
      teamId,
      name: `Invalid Dates Sprint ${uniqueSuffix()}`,
      startDate,
      endDate,
    });
    assertError(res, 400, null, 'Inverted dates');
  });

  it('2.5.2: POST /sprints - Reject sprint creation for non-existent team UUID', async () => {
    const now = new Date();
    const res = await client.post('/sprints', {
      teamId: '00000000-0000-4000-8000-000000000000',
      name: `Non-existent Team Sprint ${uniqueSuffix()}`,
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.ok([400, 404].includes(res.status), `Expected 400 or 404, got ${res.status}`);
  });

  it('2.5.3: GET /sprints/:id - Return 403 or 404 for non-existent sprint UUID', async () => {
    const res = await client.get('/sprints/11111111-1111-4111-8111-111111111111');
    assert.ok([403, 404].includes(res.status), `Expected 403 or 404, got ${res.status}`);
  });

  it('2.5.4: POST /sprints - Reject empty sprint name with 400 Bad Request', async () => {
    const now = new Date();
    const res = await client.post('/sprints', {
      teamId,
      name: '',
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assertError(res, 400, null, 'Empty sprint name');
  });

  it('2.5.5: PATCH /sprints/:id - Reject updating non-existent sprint with 403 or 404', async () => {
    const res = await client.patch('/sprints/11111111-1111-4111-8111-111111111111', {
      name: 'Non-existent Sprint Update',
    });
    assert.ok([403, 404].includes(res.status), `Expected 403 or 404, got ${res.status}`);
  });
});

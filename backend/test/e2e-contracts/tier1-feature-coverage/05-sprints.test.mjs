import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix } from '../helpers/fixtures.mjs';
import { assertSuccess, assertProperties } from '../helpers/assertions.mjs';

describe('Tier 1: Feature Coverage - Module 05: Sprints & Burndown', () => {
  let ctx;
  let client;
  let teamId;
  let sprintId;
  let initialSprintName;
  let startDate;
  let endDate;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;

    const teamRes = await client.post('/teams', {
      name: `Sprint Team ${uniqueSuffix()}`,
    });
    assertSuccess(teamRes, 201, 'Setup team for sprints');
    teamId = teamRes.data.id;

    initialSprintName = `Sprint 1 - ${uniqueSuffix()}`;
    const now = new Date();
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  });

  it('1.5.1: POST /sprints - Create a new sprint with dates and team association', async () => {
    const res = await client.post('/sprints', {
      teamId,
      name: initialSprintName,
      startDate,
      endDate,
    });

    assertSuccess(res, 201, 'Create sprint');
    assertProperties(res.data, ['id', 'name', 'teamId'], 'Sprint response');
    assert.strictEqual(res.data.name, initialSprintName);
    assert.strictEqual(res.data.teamId, teamId);
    sprintId = res.data.id;
  });

  it('1.5.2: GET /sprints - List sprints filtered by team', async () => {
    const res = await client.get('/sprints', {
      params: { teamId },
    });

    assertSuccess(res, 200, 'List sprints');
    assert.ok(
      Array.isArray(res.data) || (res.data && Array.isArray(res.data.data)),
      'Expected sprints array'
    );
  });

  it('1.5.3: GET /sprints/:id - Retrieve sprint by ID', async () => {
    const res = await client.get(`/sprints/${sprintId}`);

    assertSuccess(res, 200, 'Get sprint by ID');
    assert.strictEqual(res.data.id, sprintId);
    assert.strictEqual(res.data.name, initialSprintName);
  });

  it('1.5.4: PATCH /sprints/:id - Update sprint details', async () => {
    const updatedName = `Updated Sprint ${uniqueSuffix()}`;
    const res = await client.patch(`/sprints/${sprintId}`, {
      name: updatedName,
    });

    assertSuccess(res, 200, 'Update sprint');
    assert.strictEqual(res.data.name, updatedName);
  });

  it('1.5.5: GET /sprints/:id/burndown - Retrieve sprint burndown metrics', async () => {
    const res = await client.get(`/sprints/${sprintId}/burndown`);

    assertSuccess(res, 200, 'Sprint burndown');
    assert.ok(res.data && typeof res.data === 'object', 'Expected burndown object');
  });

  it('1.5.6: GET /sprints/:id/health - Retrieve sprint health analytics', async () => {
    const res = await client.get(`/sprints/${sprintId}/health`);

    assertSuccess(res, 200, 'Sprint health');
    assert.ok(res.data && typeof res.data === 'object', 'Expected health object');
  });
});

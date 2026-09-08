import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { setupAuthenticatedContext, uniqueSuffix } from '../helpers/fixtures.mjs';
import { assertSuccess, assertProperties } from '../helpers/assertions.mjs';

describe('Tier 1: Feature Coverage - Module 04: Teams & Assignments', () => {
  let ctx;
  let client;
  let teamId;
  let initialTeamName;

  before(async () => {
    ctx = await setupAuthenticatedContext();
    client = ctx.client;
    initialTeamName = `Team ${uniqueSuffix()}`;
  });

  it('1.4.1: POST /teams - Create new engineering team', async () => {
    const res = await client.post('/teams', {
      name: initialTeamName,
      description: 'Core platform engineering team',
    });

    assertSuccess(res, 201, 'Create team');
    assertProperties(res.data, ['id', 'name', 'organizationId'], 'Team response');
    assert.strictEqual(res.data.name, initialTeamName);
    assert.strictEqual(res.data.organizationId, ctx.org.id);
    teamId = res.data.id;
  });

  it('1.4.2: GET /teams - List all teams in organization context', async () => {
    const res = await client.get('/teams');

    assertSuccess(res, 200, 'List teams');
    assert.ok(Array.isArray(res.data), 'Expected array of teams');
    const match = res.data.find(t => t.id === teamId);
    assert.ok(match, 'Created team should appear in teams list');
  });

  it('1.4.3: GET /teams/:id - Retrieve team details by ID', async () => {
    const res = await client.get(`/teams/${teamId}`);

    assertSuccess(res, 200, 'Get team by ID');
    assert.strictEqual(res.data.id, teamId);
    assert.strictEqual(res.data.name, initialTeamName);
  });

  it('1.4.4: PATCH /teams/:id - Update team details', async () => {
    const updatedName = `Renamed Team ${uniqueSuffix()}`;
    const res = await client.patch(`/teams/${teamId}`, {
      name: updatedName,
      description: 'Updated engineering team mission',
    });

    assertSuccess(res, 200, 'Update team');
    assert.strictEqual(res.data.name, updatedName);
  });

  it('1.4.5: GET /teams/leaderboard - Retrieve team leaderboard', async () => {
    const res = await client.get('/teams/leaderboard');

    assertSuccess(res, 200, 'Team leaderboard');
    assert.ok(
      Array.isArray(res.data) || (res.data && Array.isArray(res.data.teams)),
      'Expected leaderboard array or { teams: [] }'
    );
  });

  it('1.4.6: GET /teams/:id/metrics - Retrieve team quality and activity metrics', async () => {
    const res = await client.get(`/teams/${teamId}/metrics`);

    assertSuccess(res, 200, 'Team metrics');
    assert.ok(res.data && typeof res.data === 'object', 'Expected metrics object');
  });
});

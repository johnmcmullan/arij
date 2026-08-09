const TestEnv = require('../helpers/test-env');
const { sampleTickets } = require('../helpers/fixtures');
const path = require('path');
const fs = require('fs').promises;

describe('Federated - Conflict Resolution', () => {
  let env;

  beforeEach(async () => {
    env = new TestEnv();
    await env.init();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  // None of the scenarios below are implemented yet — each one previously
  // ended in `expect(true).toBe(true)`, which reported green in CI without
  // asserting anything. test.todo() reports them honestly as not-yet-written
  // instead of a false pass. See tests/TESTING.md for the "broad, not deep"
  // rationale; these are the gaps that plan still owes.
  test.todo('detects concurrent edits to same ticket (merge conflict detection)');
  test.todo('git merge resolves non-conflicting edits (auto-merge scenario)');
  test.todo('manual resolution for conflicting field updates (both devs change assignee)');
  test.todo('last-write-wins for simple status changes (LWW strategy)');

  // Still unwritten, per the original TODO list:
  test.todo('concurrent comment additions');
  test.todo('concurrent worklog entries');
  test.todo('ticket deletion conflicts');
  test.todo('sprint reassignment conflicts');
});

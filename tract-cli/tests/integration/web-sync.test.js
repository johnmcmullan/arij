// None of the scenarios below are implemented yet — each one previously
// ended in `expect(true).toBe(true)`, which reported green in CI without
// asserting anything. test.todo() reports them honestly as not-yet-written
// instead of a false pass.
describe('Integration - Web UI + Sync', () => {
  test.todo('drag-and-drop triggers sync (needs headless browser or mock)');
  test.todo('ticket edit in web UI syncs to Jira (mock Jira API)');
  test.todo('web UI reflects external changes (mock SSE/websocket update)');

  // Still unwritten, per the original TODO list:
  test.todo('real-time collaboration');
  test.todo('optimistic UI updates');
  test.todo('rollback on sync failure');
});

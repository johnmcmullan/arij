// None of the scenarios below are implemented yet — each one previously
// ended in `expect(true).toBe(true)`, which reported green in CI without
// asserting anything. test.todo() reports them honestly as not-yet-written
// instead of a false pass.
describe('Integration - CLI + Sync Server', () => {
  test.todo('tract create triggers sync (mock sync server, verify POST request sent)');
  test.todo('tract log syncs with Jira (mock Jira API, verify worklog POST)');
  test.todo('sync server updates local repo (mock webhook/poll, verify local update)');

  // Still unwritten, per the original TODO list:
  test.todo('failed sync retry logic');
  test.todo('offline queue persistence');
  test.todo('sync status reporting');
});

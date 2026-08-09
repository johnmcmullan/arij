// None of the scenarios below are implemented yet — each one previously
// ended in `expect(true).toBe(true)`, which reported green in CI without
// asserting anything. test.todo() reports them honestly as not-yet-written
// instead of a false pass. Note: tests/unit/cli/board.test.js already covers
// the CLI-side board rendering with real assertions — these are specifically
// about the web UI's kanban route, which is a separate, still-unbuilt path.
describe('Web UI - Kanban Board', () => {
  test.todo('renders tickets grouped by status (mock Express app, request kanban route, parse rendered HTML)');
  test.todo('drag-and-drop updates ticket status (mock drag event, verify file update and git commit)');
  test.todo('ticket details modal displays full content');

  // Still unwritten, per the original TODO list:
  test.todo('empty columns display correctly');
  test.todo('priority sorting within columns');
  test.todo('assignee filtering');
  test.todo('search functionality');
});

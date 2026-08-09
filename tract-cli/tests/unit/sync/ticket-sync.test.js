// None of the scenarios below are implemented yet — each one previously
// ended in `expect(true).toBe(true)`, which reported green in CI without
// asserting anything. test.todo() reports them honestly as not-yet-written
// instead of a false pass.
describe('Sync Server - Ticket Sync', () => {
  test.todo('detects new tickets (mock sync server detection)');
  test.todo('detects ticket updates');
  test.todo('handles sync conflicts (simulate concurrent edits)');

  // Still unwritten, per the original TODO list:
  test.todo('bidirectional sync');
  test.todo('status changes');
  test.todo('assignment changes');
  test.todo('priority updates');
  test.todo('comment sync');
});

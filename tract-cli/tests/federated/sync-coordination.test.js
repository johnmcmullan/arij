// None of the scenarios below are implemented yet — each one previously ended
// in `expect(true).toBe(true)`, which reported green in CI without asserting
// anything. test.todo() reports them honestly as not-yet-written instead of
// a false pass. See tests/TESTING.md for the "broad, not deep" rationale;
// these are the gaps that plan still owes.
describe('Federated - Sync Server Coordination', () => {
  test.todo('multiple repos sync through central server');
  test.todo('sync server resolves ticket ID conflicts (offline double-create)');
  test.todo('sync maintains consistency during network partition');
  test.todo('offline work syncs when connection restored');

  // Still unwritten, per the original TODO list:
  test.todo('last-write-wins strategy');
  test.todo('operational transformation');
  test.todo('sync conflict UI');
  test.todo('manual merge flows');
});

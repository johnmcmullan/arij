// Every test in this file previously spun up a real mock HTTP server, then
// asserted only `expect(mockServer.listening).toBe(true)` or similar — the
// actual scenario (retries, backoff, offline queueing, lock files) was
// always a commented-out call to a `tractSync()` function that does not
// exist anywhere in this codebase. That function belongs to a JS
// "sync server" architecture (clients POST to a central server at
// `syncUrl: http://localhost:PORT`) that was never built — the real product
// syncs Jira <-> git via the Rust daemon in the tract-sync repo instead (see
// jira_to_git.rs), which has its own test coverage there.
//
// These tests reported green in CI while verifying nothing about sync
// resilience. Converted to honest todos so a real gap doesn't read as
// covered. If this JS-side sync server is genuinely still planned, these are
// a reasonable spec to build against; if not, this file should be deleted
// once that's confirmed.
describe('Integration - Sync Resilience', () => {
  describe('Network timeout handling', () => {
    test.todo('retries sync on network timeout');
    test.todo('fails after maximum retry attempts');
    test.todo('uses exponential backoff for retries');
    test.todo('respects custom timeout configuration');
  });

  describe('Partial sync recovery', () => {
    test.todo('handles interrupted sync gracefully');
    test.todo('resumes from last successful ticket on retry');
    test.todo('validates partial sync state integrity');
  });

  describe('Server unavailability handling', () => {
    test.todo('handles connection refused error');
    test.todo('handles DNS resolution failure');
    test.todo('handles server returning 5xx errors (retries transient errors)');
    test.todo('does not retry on 4xx client errors');
  });

  describe('Offline mode and queue persistence', () => {
    test.todo('queues operations when offline');
    test.todo('syncs queued operations when connection restored');
    test.todo('persists queue across process restarts');
    test.todo('handles queue corruption gracefully');
  });

  describe('Concurrent sync handling', () => {
    test.todo('prevents concurrent sync from same client (lock file)');
    test.todo('cleans up stale lock files');
  });

  describe('Sync progress and reporting', () => {
    test.todo('reports sync progress for large batches');
    test.todo('provides detailed error information on failure');
  });
});

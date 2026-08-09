# Tract Testing Guide

## Philosophy: Broad, Not Deep

Tests are designed as **placeholders** with broad coverage across all major components. Each test validates the happy path and includes TODO comments for future enrichment with:
- Edge cases
- Error handling
- Complex scenarios
- Performance testing

This approach allows rapid initial coverage while planning for incremental improvement.

**Convention:** an unimplemented scenario should be `test.todo('description')`, not a
test body that ends in `expect(true).toBe(true)`. The latter reports green in CI
without checking anything — it reads as covered when it isn't. `test.todo` reports
honestly as pending. (2026-08: every file that had drifted into the `expect(true)`
pattern was converted — see `federated/`, `integration/{cli-sync,web-sync,sync-resilience}.test.js`,
`unit/{sync/ticket-sync,web/kanban}.test.js`.)

**Also watch for:** a test can be non-trivial and still not test the app. Several
files in `unit/security/` and `unit/validation/` assert only against
`helpers/test-env.js`'s own hand-rolled validator, which has no counterpart in the
real `tract` app — see the banner comment at the top of each such file for what it
actually covers and where the real coverage (if any) lives instead.

## Test Structure

```
tests/
├── unit/              # Component-level tests
│   ├── cli/          # tract-cli commands (create, onboard, log, etc.)
│   ├── sync/         # tract-sync server (ticket sync, worklogs)
│   └── web/          # Web UI routes and rendering
├── integration/       # Cross-component tests
│   ├── cli-sync/     # CLI operations trigger sync
│   ├── web-sync/     # Web UI changes sync
│   └── git-ops/      # Git commit/history integration
├── federated/         # Multi-repo, multi-developer scenarios
│   ├── multi-dev/    # Collaborative workflows
│   ├── sync-coordination/  # Central sync server coordination
│   └── conflict-resolution/ # Merge conflicts, LWW strategies
└── helpers/           # Test utilities
    ├── test-env.js   # TestEnv class for creating isolated repos
    └── fixtures.js   # Sample tickets, worklogs, projects
```

## Running Tests

```bash
# All tests
npm test

# Specific suite
npm test -- tests/unit/cli
npm test -- tests/federated
npm test -- tests/integration

# Watch mode (re-run on file changes)
npm test:watch

# Coverage report
npm test:coverage
```

## Federated Testing

The `tests/federated/` directory is specifically designed to test multi-developer, distributed scenarios:

### Multi-Developer Workflows
- Multiple developers clone the same repo
- Concurrent ticket creation/updates
- Pull/push/merge mechanics
- Team collaboration patterns

### Sync Coordination
- Multiple repos syncing through a central server
- Conflict detection and resolution
- Network partition scenarios
- Offline work + reconnect sync

### Conflict Resolution
- Concurrent edits to same ticket
- Git merge strategies (auto-merge vs manual)
- Last-write-wins for simple updates
- Manual resolution flows

## Test Environment Helper

The `TestEnv` class (`helpers/test-env.js`) provides utilities for creating isolated test scenarios:

```javascript
const TestEnv = require('./helpers/test-env');

const env = new TestEnv();
await env.init();

// Create a repo for developer 1
const dev1 = await env.createRepo('dev1', { project: 'TEAM' });

// Create a ticket
await env.createTicket('dev1', {
  key: 'TEAM-1',
  title: 'Fix login bug',
  type: 'bug',
  status: 'todo'
});

// Clone for developer 2
const dev2 = await env.cloneRepo('dev1', 'dev2');

// Cleanup
await env.cleanup();
```

### TestEnv API

- `init()` - Create temporary test directory
- `createRepo(name, options)` - Initialize a new tract repo
- `createTicket(repoName, ticket)` - Add a ticket with git commit
- `cloneRepo(sourceName, targetName)` - Clone repo (simulate another developer)
- `getRepo(name)` - Get repo by name
- `cleanup()` - Remove all test repos

## Writing New Tests

### Unit Tests

Focus on individual components in isolation:

```javascript
describe('tract create', () => {
  test('creates a new ticket file', async () => {
    // Setup isolated environment
    // Execute single operation
    // Assert expected outcome
  });
  
  // TODO: Add edge cases
  // - Invalid input
  // - Missing dependencies
  // - Error handling
});
```

### Integration Tests

Test interactions between components:

```javascript
describe('CLI + Sync Server', () => {
  test('tract create triggers sync', async () => {
    // Setup CLI + mock sync server
    // Execute CLI command
    // Assert sync server received update
  });
});
```

### Federated Tests

Test distributed, multi-developer scenarios:

```javascript
describe('Multi-Developer Workflow', () => {
  test('concurrent edits by two developers', async () => {
    // Create two repos (dev1, dev2)
    // Both make changes
    // Test merge/conflict behavior
  });
});
```

## Mocking Strategy

For external dependencies:
- **Sync Server:** Mock HTTP endpoints with nock or custom mock server
- **Jira API:** Mock with interceptors, avoid live API calls
- **Git operations:** Use simpleGit with real temp repos (TestEnv handles cleanup)

## Coverage Goals

Current coverage is **intentionally sparse** (placeholders). Future enrichment targets:

- **Unit tests:** 80%+ coverage of core functions
- **Integration tests:** All major workflows covered
- **Federated tests:** Common collaboration scenarios validated
- **Edge cases:** Error paths, invalid input, race conditions

## CI/CD Integration

Wired up in `.github/workflows/test.yml` at the repo root — runs `npm test`
inside `tract-cli/` on push/PR to master/main across Node 18.x and 20.x.
This suite used to live in a separate `tract-tests` repo and require app
source across a sibling checkout (`require('../../../../tract/...')`),
which is why CI never actually passed there — every run failed on
`Cannot find module`. Moved in-repo in 2026-08 specifically to fix that.

## Future Enhancements

- **E2E tests:** Headless browser testing for Web UI (Playwright/Puppeteer)
- **Performance tests:** Benchmark large repos (1000+ tickets)
- **Stress tests:** High-concurrency sync scenarios
- **Fuzz testing:** Random input to CLI commands
- **Contract tests:** Sync server API compliance

---

**Remember:** Tests are living documentation. As you enrich them, update this guide with new patterns and conventions.

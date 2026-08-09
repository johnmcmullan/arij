# Tract Test Suite

Broad test coverage designed for incremental enrichment.

## Structure

```
tests/
├── unit/              # Component-level tests
│   ├── cli/          # tract-cli commands
│   ├── sync/         # tract-sync server
│   └── web/          # Web UI components
├── integration/       # Cross-component tests
│   ├── cli-sync/     # CLI + sync server
│   ├── web-sync/     # Web UI + sync
│   └── git-ops/      # Git operations
├── federated/         # Multi-repo, multi-developer scenarios
│   ├── sync/         # Sync across repos
│   ├── conflicts/    # Conflict resolution
│   └── multi-dev/    # Collaborative workflows
└── helpers/           # Test utilities
    ├── fixtures/     # Sample data
    └── setup/        # Test environment setup
```

## Philosophy

**Broad, not deep** - Each test covers basic happy path scenarios.
Tests are placeholders for later enrichment with edge cases, error handling, and complex scenarios.

## Running Tests

```bash
# All tests
npm test

# Specific suite
npm test -- tests/unit/cli
npm test -- tests/federated

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## Federated Testing

The `tests/federated/` directory contains scenarios for:
- Multiple developers with separate repos
- Sync server coordination
- Conflict detection and resolution
- Distributed workflows

Each test can spawn multiple temporary repos to simulate real-world collaboration.

# Component Schema

## Industry Standard Component Definition

Based on common practices (Jira, Azure DevOps, GitHub Projects):

### Minimum Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Component identifier (YAML key) | `auth-service` |
| `description` | string | What this component does | `Authentication and authorization service` |
| `owner` | string | Person/team responsible | `john.mcmullan` |
| `path` | string | Main code location (single path) | `src/auth/` |
| `paths` | array | Multiple locations (use instead of `path`) | `[src/auth/, test/auth/]` |

**Note:** Use either `path` (single) OR `paths` (multiple), not both.

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `url` | string | Git repo URL (if multi-repo) | `git@github.com:company/auth.git` |
| `language` | string | Primary language | `python`, `typescript`, `rust` |
| `team` | string | Owning team | `platform-team`, `backend-squad` |
| `status` | string | Lifecycle status | `active`, `deprecated`, `experimental` |
| `docs` | string | Documentation URL | `https://docs.company.com/auth` |
| `children` | object | Sub-components (hierarchical) | See below |

## Complete Example

`.tract/components.yaml`:

```yaml
components:
  # Backend services (multiple paths)
  auth-service:
    description: Authentication and authorization service
    owner: john.mcmullan
    paths:
      - services/auth/          # Main code
      - test/integration/auth/  # Integration tests
      - docs/auth/              # Documentation
    language: typescript
    team: platform-team
    status: active
    docs: https://docs.company.com/auth
    
  # Simple component (single path)
  api-gateway:
    description: API gateway and request routing
    owner: sarah.jones
    path: services/gateway/
    language: go
    team: platform-team
    status: active
    
  # Multiple paths with named sections
  payment-processor:
    description: Payment processing and billing
    owner: mike.smith
    paths:
      - src/payments/           # Core logic
      - test/unit/payments/     # Unit tests
      - test/e2e/payments/      # End-to-end tests
      - config/payments/        # Configuration
    language: python
    team: fintech-squad
    status: active
    
  # Frontend with tests
  web-app:
    description: Main web application (React SPA)
    owner: dave.wilson
    paths:
      - apps/web/src/           # Source code
      - apps/web/test/          # Tests
      - apps/web/e2e/           # E2E tests (Cypress)
    language: typescript
    team: frontend-squad
    status: active
    
  mobile-app:
    description: Mobile application (React Native)
    owner: lisa.brown
    paths:
      - apps/mobile/            # Main code
      - apps/mobile/__tests__/  # Jest tests
    language: typescript
    team: mobile-squad
    status: active
    
  # Infrastructure (single path is fine)
  database:
    description: PostgreSQL database schemas and migrations
    owner: john.mcmullan
    path: db/
    language: sql
    team: platform-team
    status: active
    
  # Legacy (deprecated)
  old-auth:
    description: Legacy authentication system (being replaced)
    owner: john.mcmullan
    path: legacy/auth/
    language: java
    team: platform-team
    status: deprecated
```

## Hierarchical Components

For complex systems with sub-components:

```yaml
components:
  trading:
    description: Trading platform core
    owner: dave.wilson
    path: src/trading/
    team: trading-squad
    children:
      oms:
        description: Order management system
        owner: dave.wilson
        path: src/trading/oms/
        language: c++
      fix-engine:
        description: FIX protocol engine
        owner: mike.smith
        path: src/trading/fix/
        language: c++
      market-data:
        description: Market data feed handler
        owner: lisa.brown
        path: src/trading/md/
        language: rust
```

Tickets reference as: `component: trading.fix-engine`

## Multi-Repo Setup

When components live in different repos:

```yaml
components:
  auth-service:
    description: Authentication service
    owner: john.mcmullan
    url: git@github.com:company/auth-service.git
    path: /
    
  frontend:
    description: Web frontend
    owner: sarah.jones
    url: git@github.com:company/frontend.git
    path: /
    
  mobile:
    description: Mobile app
    owner: dave.wilson
    url: git@github.com:company/mobile-app.git
    path: /
```

## Path vs Paths

**Use `path` (singular) when:**
- Component code is in one directory
- Simple structure
- Example: `path: src/auth/`

**Use `paths` (plural) when:**
- Component spans multiple directories
- Tests in separate location
- Docs, config, etc. in different places
- Example: `paths: [src/auth/, test/auth/, docs/auth/]`

**Examples:**

```yaml
# Simple: single path
simple-lib:
  description: Utility library
  owner: john
  path: lib/utils/

# Complex: multiple paths
complex-service:
  description: Multi-tier service
  owner: sarah
  paths:
    - src/service/          # Main code
    - test/unit/service/    # Unit tests
    - test/integration/     # Integration tests
    - migrations/           # DB migrations
    - docs/service/         # Documentation
```

## Best Practices

1. **Always include description** - Future you will forget what "XYZ service" does
2. **Assign clear owners** - One person/team responsible
3. **Use relative paths** - Makes repo portable
4. **Use `paths` for tests** - Keep test locations explicit
5. **Document status** - Mark deprecated/experimental components
6. **Link to docs** - Architecture docs, API specs, etc.
7. **Hierarchical when needed** - Don't nest too deep (2-3 levels max)

## Validation

Component references in tickets should be validated:

```bash
# Check if component exists
cat .tract/components.yaml | grep -q "component-name:" || echo "Unknown component"

# List all components
cat .tract/components.yaml | grep "^  [a-z]" | cut -d: -f1 | tr -d ' '
```

## Industry Comparison

### Jira Components
- Name ✓
- Description ✓
- Lead ✓
- (No path - Jira doesn't track code)

### Azure DevOps Areas
- Name ✓
- Path (logical hierarchy) ✓
- (No description or owner by default)

### GitHub Projects
- Custom fields can include anything
- Typically: name, description, owner, status

**Tract approach:** Best of all worlds
- Name (identifier)
- Description (what)
- Owner (who)
- Path (where in code)
- Optional: everything else

## Migration from Jira

When importing from Jira:

1. `tract map-components` fetches Jira component metadata
2. LLM matches component names to code directories
3. Creates `.tract/components.yaml` with:
   - Name (from Jira)
   - Description (from Jira)
   - Owner/lead (from Jira)
   - Path (from LLM code scan + user confirmation)

## Adding Components via LLM

See: `.tract/skills/tract-components/` for LLM-assisted component management.

---

**Summary:** Components are logical-to-physical mappings with clear ownership. Always include: name, description, owner, path. Everything else is optional but encouraged.

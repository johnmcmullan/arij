# Tract Components Skill

## Purpose

Help users add and manage components - the logical-to-physical mappings that organize a codebase.

**Components define:**
- What parts of the system exist (logical names)
- Where they live in the code (physical paths)
- Who owns them (responsibility)
- How they relate (hierarchy)

## When to Use This Skill

**Activate when:**
- User wants to add a component
- User asks: "What components exist?"
- User asks: "Who owns component X?"
- Setting up a new Tract project (post-onboarding)
- Organizing a codebase with multiple modules/services

**Do NOT activate when:**
- Creating tickets (use tract-schema skill)
- Time tracking (use tract-timetracking skill)

## Core Workflow

### Step 1: Check for Components File

```bash
ls .tract/components.yaml
```

**If exists:** Components already configured, user wants to add/edit
**If missing:** First-time setup, create the file

### Step 2: Gather Component Information

Ask the user for **minimum required fields:**

1. **Name** - Component identifier (kebab-case, e.g., `auth-service`)
2. **Description** - What does it do? (1-2 sentences)
3. **Owner** - Who's responsible? (username or team)
4. **Path** - Where in the codebase? (relative path from repo root)

**Optional fields** (ask if relevant):
- URL - Git repo URL (if multi-repo setup)
- Language - Primary programming language
- Team - Owning team name
- Status - `active`, `deprecated`, `experimental`
- Docs - Documentation URL

### Step 3: Create or Update components.yaml

**For simple component (single path):**

```yaml
components:
  component-name:
    description: What it does
    owner: username
    path: src/component/
    language: typescript
    team: platform-team
    status: active
```

**For component with multiple paths:**

```yaml
components:
  component-name:
    description: What it does
    owner: username
    paths:
      - src/component/      # Main code
      - test/component/     # Tests
      - docs/component/     # Documentation
    language: typescript
    team: platform-team
    status: active
```

**For additional components:**

Append to existing file, maintaining structure.

### Step 4: Commit to Git

```bash
git add .tract/components.yaml
git commit -m "Add component: component-name"
```

### Step 5: Verify

Show user:
```bash
cat .tract/components.yaml
```

Confirm component added successfully.

## LLM-Assisted Component Discovery

**User:** "Can you help me set up components for this project?"

**You (LLM):**

1. **Scan the codebase:**
   ```bash
   ls -d src/*/ services/*/ apps/*/ 2>/dev/null
   ```

2. **Suggest components based on directory structure:**
   ```
   I found these directories that might be components:
   - src/auth/ (looks like authentication service)
   - src/api/ (looks like API layer)
   - src/database/ (database layer)
   - apps/web/ (web application)
   
   Should I create components for these?
   ```

3. **For each component, ask:**
   - Description: "What does src/auth/ do?"
   - Owner: "Who owns authentication?"
   - Language: (auto-detect from files in dir)

4. **Create components.yaml with all**

## Example: Adding First Component

**User:** "Add a component for the authentication service"

**LLM:**
```
I'll help you add the authentication service component.

A few questions:
1. Where is the auth service code located? (e.g., src/auth, services/auth)
2. Brief description? (e.g., "Handles user authentication and sessions")
3. Who owns it? (username or team name)
4. What language is it written in? (optional)
```

**User answers:**
```
1. src/auth/
2. User authentication and authorization service
3. john.mcmullan
4. TypeScript
```

**LLM asks follow-up:**
```
Do you have tests in a separate directory? (y/n)
```

**User:** "Yes, test/auth/"

**LLM creates:**

`.tract/components.yaml`:
```yaml
components:
  auth-service:
    description: User authentication and authorization service
    owner: john.mcmullan
    paths:
      - src/auth/           # Main code
      - test/auth/          # Tests
    language: typescript
    status: active
```

```bash
git add .tract/components.yaml
git commit -m "Add component: auth-service"
```

**LLM confirms:**
```
✅ Added component: auth-service

Component details:
- Description: User authentication and authorization service
- Owner: john.mcmullan
- Path: src/auth/
- Language: typescript

You can now assign tickets to this component:
  tract create APP --title "Fix auth bug" --component auth-service
```

## Example: Multiple Components at Once

**User:** "Set up all the main components for this project"

**LLM:**

1. **Scan directories:**
   ```bash
   find . -type d -name 'src' -o -name 'services' -o -name 'apps' | head -20
   ```

2. **Propose structure:**
   ```
   I found these main areas:
   
   Services:
   - services/auth/
   - services/api/
   - services/payments/
   
   Frontend:
   - apps/web/
   - apps/mobile/
   
   Should I create components for all of these?
   ```

3. **User confirms**

4. **For each, ask owner (or use git blame/CODEOWNERS):**
   ```bash
   # Check CODEOWNERS if exists
   cat CODEOWNERS | grep "services/auth"
   
   # Or use git blame on main files
   git log --pretty=format:'%an' services/auth/ | sort | uniq -c | sort -rn | head -1
   ```

5. **Auto-detect language:**
   ```bash
   # Count file extensions in directory
   find services/auth -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -1
   ```

6. **Ask about test paths:**
   ```
   For each component, do you have separate test directories?
   - services/auth/ → tests in test/auth/? (y/n)
   ```

7. **Generate components.yaml with all components**

**Use `paths` (array) when:**
- Tests in separate directory
- Multiple code locations
- Docs/config in different places

**Use `path` (single) when:**
- Simple, single directory
- All files colocated

## Hierarchical Components

**User:** "The trading system has multiple sub-components"

**LLM:**
```
I'll set up a hierarchical structure.

What sub-components does trading have?
```

**User:** "Order management, FIX engine, market data"

**LLM creates:**

```yaml
components:
  trading:
    description: Trading platform core
    owner: team-trading
    path: src/trading/
    children:
      oms:
        description: Order management system
        owner: dave.wilson
        path: src/trading/oms/
        language: c++
      fix-engine:
        description: FIX protocol connectivity
        owner: mike.smith
        path: src/trading/fix/
        language: c++
      market-data:
        description: Market data feed handler
        owner: lisa.brown
        path: src/trading/md/
        language: rust
```

**LLM explains:**
```
✅ Created hierarchical components under 'trading'

Tickets can reference:
- component: trading (whole platform)
- component: trading.oms (order management specifically)
- component: trading.fix-engine (FIX engine specifically)

This helps organize tickets by functional area.
```

## Updating Components

**User:** "Change the owner of auth-service to sarah.jones"

**LLM:**

1. **Read current components.yaml**
2. **Update owner field**
3. **Commit**

```bash
# Edit file
sed -i 's/owner: john.mcmullan/owner: sarah.jones/' .tract/components.yaml

# Commit
git commit -am "Update auth-service owner: john.mcmullan → sarah.jones"
```

**Show change:**
```
✅ Updated auth-service owner

Old: john.mcmullan
New: sarah.jones
```

## Listing Components

**User:** "What components do we have?"

**LLM:**
```bash
cat .tract/components.yaml
```

**Format output nicely:**
```
Components:

auth-service
  Description: User authentication and authorization
  Owner: john.mcmullan
  Path: src/auth/
  
api-gateway
  Description: API gateway and routing
  Owner: sarah.jones
  Path: src/gateway/
  
payment-processor
  Description: Payment processing and billing
  Owner: mike.smith
  Path: src/payments/
  
Total: 3 components
```

## Finding Component Owner

**User:** "Who owns the payment system?"

**LLM:**
```bash
cat .tract/components.yaml | grep -A5 "payment"
```

**Answer:**
```
The payment-processor component is owned by mike.smith

Details:
- Path: src/payments/
- Language: python
- Team: fintech-squad
```

## Deprecated Components

**User:** "Mark old-auth as deprecated"

**LLM:**

```yaml
components:
  old-auth:
    description: Legacy authentication (being replaced by auth-service)
    owner: john.mcmullan
    path: legacy/auth/
    status: deprecated  # Add this
```

```bash
git commit -am "Mark old-auth as deprecated"
```

**Explain:**
```
✅ Marked old-auth as deprecated

When creating new tickets, users should use 'auth-service' instead.
Old tickets assigned to 'old-auth' remain for historical tracking.
```

## Component-Based Ticket Assignment

**After components are set up:**

**User:** "Create a ticket for fixing auth timeout"

**LLM:**
```bash
tract create APP --title "Fix auth session timeout" \
  --component auth-service \
  --assignee john.mcmullan
```

**Explain:**
```
✅ Created APP-1234: Fix auth session timeout

Assigned to:
- Component: auth-service (owned by john.mcmullan)
- Assignee: john.mcmullan (component owner)

Component path: src/auth/ - that's where the code lives.
```

## Auto-Assigning Based on Component

**User:** "Create a ticket for the payment system"

**LLM:**

1. **Look up component owner:**
   ```bash
   cat .tract/components.yaml | grep -A3 "payment-processor" | grep owner
   # owner: mike.smith
   ```

2. **Auto-assign ticket:**
   ```bash
   tract create APP --title "Fix payment bug" \
     --component payment-processor \
     --assignee mike.smith
   ```

3. **Explain:**
   ```
   ✅ Created APP-1235: Fix payment bug
   
   Auto-assigned to mike.smith (payment-processor owner)
   Component path: src/payments/
   ```

## Best Practices

1. **Always include description** - Future reference
2. **Keep paths relative** - Repo portability
3. **Assign clear owners** - Accountability
4. **Mark deprecated components** - Avoid confusion
5. **Use hierarchy sparingly** - 2-3 levels max
6. **Update when ownership changes** - Keep current

## Reference Documents

For complete component schema, load: `references/component-schema.md`

---

**Remember:** Components organize chaos. Good component definitions make ticket assignment and code navigation effortless. Spend time getting them right upfront.

# Label Conventions (Recommended)

## The Golden Rule: lowercase-hyphenated

**Format:** `lowercase-hyphenated-labels`

**Why this works:**
- ✅ Shell-safe (no escaping needed)
- ✅ URL-safe (works in links)
- ✅ Git-friendly (no special characters)
- ✅ Grep-friendly (consistent format)
- ✅ Human-readable (clear word boundaries)
- ✅ Language-agnostic (works everywhere)

## Examples

**Good:**
```
tbricks
fix-protocol
performance-tuning
high-priority
order-management
trading-session
bug-fix
```

**Not this:**
```
TBricks              → tbricks
Fix Protocol         → fix-protocol
performance_tuning   → performance-tuning
High Priority        → high-priority
OrderManagement      → order-management
Trading Session      → trading-session
bug fix              → bug-fix
```

## Configuration

```yaml
# .tract/config.yaml
labels:
  case: lowercase
  separator: hyphen  # Convert spaces/underscores to hyphens
  mappings:
    # Product names
    TBricks: tbricks
    Tbricks: tbricks
    
    # Multi-word labels
    "Fix Protocol": fix-protocol
    "High Priority": high-priority
    performance_tuning: performance-tuning
    OrderManagement: order-management
```

## Normalization Rules

### 1. Lowercase Everything
```
TBricks → tbricks
FIX → fix
Performance → performance
```

### 2. Replace Separators with Hyphens
```
fix_protocol → fix-protocol
Fix Protocol → fix-protocol
performance.tuning → performance-tuning
order management → order-management
```

### 3. Remove Special Characters
```
high-priority!!! → high-priority
@urgent → urgent
bug#123 → bug-123
```

### 4. Collapse Multiple Hyphens
```
high---priority → high-priority
fix--protocol → fix-protocol
```

### 5. Trim Hyphens from Edges
```
-urgent- → urgent
--fix-protocol-- → fix-protocol
```

## Common Patterns

### Product Names
```
Tbricks → tbricks
Oracle → oracle
PostgreSQL → postgresql
```

### Protocols/Standards
```
FIX Protocol → fix-protocol
REST API → rest-api
WebSocket → websocket
```

### Priorities
```
High Priority → high-priority
P1 → p1
Critical → critical
```

### Components
```
Order Management → order-management
Trading Session → trading-session
Auth Service → auth-service
```

### Issue Types
```
Bug Fix → bug-fix
New Feature → new-feature
Tech Debt → tech-debt
```

### Status Tags
```
In Progress → in-progress
Code Review → code-review
Ready to Deploy → ready-to-deploy
```

## Implementation

The normalize-labels hook handles this automatically:

```javascript
function normalizeLabel(label) {
  return label
    .toLowerCase()                    // 1. Lowercase
    .replace(/[_\s\.]+/g, '-')       // 2. Replace separators
    .replace(/[^a-z0-9-]/g, '')      // 3. Remove special chars
    .replace(/-+/g, '-')             // 4. Collapse hyphens
    .replace(/^-+|-+$/g, '');        // 5. Trim edges
}

// Examples:
normalizeLabel("TBricks")           // → "tbricks"
normalizeLabel("Fix Protocol")      // → "fix-protocol"
normalizeLabel("high___priority")   // → "high-priority"
normalizeLabel("@urgent!!!")        // → "urgent"
```

## Why Hyphens (Not Underscores or Spaces)

**Hyphens win:**
```bash
# Grep works naturally
grep "fix-protocol" issues/*.md

# URLs work
https://tracker.com/labels/fix-protocol

# File names work
labels/fix-protocol.md

# Shell doesn't need escaping
for label in fix-protocol high-priority; do
  echo $label
done
```

**Underscores are OK, but:**
```bash
# Harder to read
performance_tuning  # vs  performance-tuning

# Some systems treat as word boundary
double-click "fix_protocol" selects "fix" or "protocol"
double-click "fix-protocol" selects whole thing
```

**Spaces are terrible:**
```bash
# Shell escaping needed
grep "fix protocol" issues/*.md  # Breaks
grep "fix\ protocol" issues/*.md # Annoying

# URLs need encoding
https://tracker.com/labels/fix%20protocol  # Ugly
```

## Benefits in Practice

### Querying
```bash
# Find all fix-protocol tickets
grep -l "fix-protocol" issues/*.md

# Find all high-priority items
grep "priority: high" issues/*.md | grep "fix-protocol"
```

### URLs
```
# Clean URLs in web UI
/board?label=fix-protocol
/tickets?filter=high-priority
```

### Git
```bash
# No escaping in commit messages
git commit -m "Add fix-protocol improvements"

# Clean in git log
git log --grep="fix-protocol"
```

### LLM Queries
```
User: "Show me fix-protocol tickets"
LLM: grep -l "fix-protocol" issues/*.md
# Clean, simple, works
```

## Migration

**From messy Jira labels:**
```yaml
# Before import
Jira labels: [TBricks, Fix Protocol, high_priority, ORDER MANAGEMENT]

# After import + normalize-labels hook
Tract labels: [fix-protocol, high-priority, order-management, tbricks]
```

**Consistent, clean, predictable.**

## Exceptions

**Preserve acronyms when they're better known:**
```yaml
mappings:
  # Keep FIX as acronym in compound labels
  "FIX Protocol": fix-protocol  # Not "f-i-x-protocol"
  
  # But standalone acronyms lowercase
  FIX: fix
  API: api
  OMS: oms
```

**Ticket IDs as labels (if you do this):**
```yaml
# Keep the format
APP-123 → app-123
FRONT-456 → front-456
```

## Bottom Line

**Convention: lowercase-hyphenated**

**Why:** Shell-safe, URL-safe, grep-friendly, readable, universal.

**Config:**
```yaml
labels:
  case: lowercase
  separator: hyphen
  mappings:
    TBricks: tbricks
    "Fix Protocol": fix-protocol
```

**Result:** Labels that just work everywhere. No escaping, no ambiguity, no hassle.

---

**One format. Works everywhere. Saves a lot of hassle.** ✅

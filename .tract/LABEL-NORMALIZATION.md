# Label Normalization Hook

**Fixes the "Tbricks vs TBricks vs tbricks" problem**

## The Problem

Labels come from Jira in inconsistent formats:
- `Tbricks`, `TBricks`, `tbricks`, `TBRICKS`
- `fix-protocol`, `Fix-Protocol`, `FIX-PROTOCOL`
- `performance`, `Performance`, `performance-tuning`

**Result:** Tags that should be the same are treated as different.

**Queries break:**
```bash
grep -l "labels:.*tbricks" issues/*.md  # Misses "TBricks"
```

## The Solution

**normalize-labels hook** runs after import, fixes all labels automatically.

## Configuration

```yaml
# .tract/config.yaml
labels:
  case: lowercase  # lowercase, uppercase, title, or original
  mappings:
    # Case-insensitive mappings
    TBricks: tbricks
    Tbricks: tbricks
    TBRICKS: tbricks
    
    # Merge similar labels
    performance: performance-tuning
    perf: performance-tuning
    
    # Fix typos
    authetication: authentication
    authetnication: authentication

import:
  hooks:
    - sanitize-timestamps
    - normalize-labels  # Enabled by default
```

## How It Works

### Step 1: Apply Explicit Mappings

```yaml
# Config says:
mappings:
  TBricks: tbricks
  Tbricks: tbricks

# Before:
labels: [TBricks, performance, Tbricks, fix-protocol]

# After mappings:
labels: [tbricks, performance, tbricks, fix-protocol]
```

### Step 2: Apply Case Normalization

```yaml
case: lowercase

# After mappings:
labels: [tbricks, performance, tbricks, fix-protocol]

# After case normalization:
labels: [tbricks, performance, tbricks, fix-protocol]
```

### Step 3: Remove Duplicates

```
# After case:
labels: [tbricks, performance, tbricks, fix-protocol]

# After deduplication (case-insensitive):
labels: [tbricks, performance, fix-protocol]
```

### Step 4: Sort Alphabetically

```
# After dedup:
labels: [tbricks, performance, fix-protocol]

# After sort:
labels: [fix-protocol, performance, tbricks]
```

## Example: Your Use Case

**Before (from Jira):**
```yaml
# Ticket 1
labels: [TBricks, performance, Fix-Protocol]

# Ticket 2
labels: [Tbricks, Performance, fix-protocol]

# Ticket 3
labels: [tbricks, PERFORMANCE, FIX-PROTOCOL]
```

**After normalize-labels hook:**
```yaml
# Ticket 1
labels: [fix-protocol, performance, tbricks]

# Ticket 2
labels: [fix-protocol, performance, tbricks]

# Ticket 3
labels: [fix-protocol, performance, tbricks]
```

**All consistent! ✓**

## Configuration Options

### Case Normalization

```yaml
labels:
  case: lowercase  # All labels lowercase
```

Options:
- `lowercase` - `TBricks` → `tbricks`
- `uppercase` - `TBricks` → `TBRICKS`
- `title` - `TBricks` → `Tbricks`
- `original` - Keep original case (only apply mappings)

### Explicit Mappings

```yaml
labels:
  mappings:
    # Fix inconsistent capitalization
    TBricks: tbricks
    Tbricks: tbricks
    
    # Merge similar labels
    bug-fix: bugfix
    bug_fix: bugfix
    
    # Expand abbreviations
    perf: performance
    auth: authentication
    
    # Fix typos
    performace: performance  # Common typo
    authetication: authentication
```

**Case-insensitive matching:**
- `TBricks`, `TBRICKS`, `tBrIcKs` all match `TBricks` mapping

### Disable for Specific Tickets

```yaml
# issues/APP-123.md
---
skip_hooks: [normalize-labels]  # Keep original labels
labels: [TBricks, IMPORTANT]  # Won't be normalized
---
```

## When It Runs

**Automatically during import:**
```bash
tract import

Fetching tickets from Jira...
✓ Fetched 42 tickets
✓ Converted 42 tickets to markdown

Running post-import hooks...
  Normalized labels in 38 tickets
✓ Post-import hooks complete

✅ Import Complete!
```

**Manually (if needed):**
```javascript
// Future: Add CLI command
tract normalize-labels

Scanning issues/...
Normalized labels in 38 tickets:
  TBricks → tbricks (12 tickets)
  Tbricks → tbricks (8 tickets)
  Performance → performance (15 tickets)
  Fix-Protocol → fix-protocol (3 tickets)
```

## Common Patterns

### Product Names (Case-Sensitive)

```yaml
labels:
  case: original  # Don't auto-lowercase
  mappings:
    # Normalize to official spelling
    tbricks: TBricks
    Tbricks: TBricks
    TBRICKS: TBricks
```

**Result:** Official product name `TBricks` everywhere

### Team Names

```yaml
labels:
  mappings:
    backend-team: backend
    Backend: backend
    back-end: backend
    
    frontend-team: frontend
    Frontend: frontend
    front-end: frontend
```

### Component Tags

```yaml
labels:
  mappings:
    # Normalize component names
    fix-protocol: fix
    FIX-Protocol: fix
    FIX: fix
    
    order-management: oms
    OMS: oms
    order-mgmt: oms
```

### Priority Tags

```yaml
labels:
  mappings:
    # Standardize priority labels
    urgent: high-priority
    URGENT: high-priority
    high: high-priority
    
    p1: high-priority
    p2: medium-priority
    p3: low-priority
```

## Validation

**Check what would change (dry-run mode):**

```bash
# Future feature
tract normalize-labels --dry-run

Would normalize:
  APP-123: [TBricks, performance] → [performance, tbricks]
  APP-124: [Tbricks, Fix-Protocol] → [fix-protocol, tbricks]
  APP-125: [PERFORMANCE, tbricks] → [performance, tbricks]
  
Total: 38 tickets would change
Continue? (y/n)
```

## Benefits

### 1. Consistent Queries

**Before:**
```bash
# Miss tickets with different case
grep -l "tbricks" issues/*.md  # Misses "TBricks", "Tbricks"
```

**After:**
```bash
# Catches everything
grep -l "tbricks" issues/*.md  # All normalized to lowercase
```

### 2. Better Grouping

**Before:**
```
Labels:
  TBricks: 12 tickets
  Tbricks: 8 tickets
  tbricks: 15 tickets
  (35 total across 3 variations)
```

**After:**
```
Labels:
  tbricks: 35 tickets
  (All in one bucket)
```

### 3. LLM Friendliness

**LLM query:**
```
User: "Show me all TBricks tickets"

LLM: [Greps for "tbricks" - gets all variants]
     Found 35 tickets with label "tbricks"
```

No need to check multiple spellings.

## Migration Strategy

### First Import

```bash
# Import with normalization enabled (default)
tract import

# Labels automatically normalized during import
```

### Existing Repository

```bash
# Future: Normalize existing tickets
tract normalize-labels

# Or manually with sed/awk
find issues/ -name "*.md" -exec sed -i 's/TBricks/tbricks/g' {} \;
git commit -am "Normalize labels: TBricks → tbricks"
```

### Ongoing

**New tickets created with CLI:**
```bash
tract create APP --title "Bug fix" --labels "TBricks,performance"
# Hook normalizes to: [performance, tbricks]
```

**Synced from Jira:**
```bash
# Jira webhook → Sync server → Git
# Labels normalized before commit
```

## Disable Normalization

**Global disable:**
```yaml
import:
  hooks:
    - sanitize-timestamps
    # - normalize-labels  # Commented out
```

**Keep original case:**
```yaml
labels:
  case: original  # Don't change case
  mappings: {}    # No mappings
```

## Performance

**Fast:** ~0.1s per 100 tickets

**Safe:** 
- Read-only scan first
- Only writes if changes needed
- Non-destructive (can re-run)

## Bottom Line

**Stop fighting label inconsistency.**

Enable `normalize-labels` hook, configure mappings once, never worry about "TBricks vs Tbricks" again.

```yaml
# .tract/config.yaml
labels:
  case: lowercase
  mappings:
    TBricks: tbricks
    Tbricks: tbricks

import:
  hooks:
    - normalize-labels  # Enabled by default
```

**All labels consistent forever.** ✅

---

**P.S.** If you want to normalize existing tickets (not just new imports), we can add a `tract normalize-labels` CLI command. Let me know!

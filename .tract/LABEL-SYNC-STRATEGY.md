# Label Sync Strategy

**Question:** What happens when normalized labels sync back to Jira?

## The Problem

**Import from Jira:**
```yaml
# Jira ticket
labels: [TBricks, Performance, fix-protocol]

# After normalize-labels hook
labels: [fix-protocol, performance, tbricks]
```

**Sync back to Jira:**
```yaml
# What should Jira see?
Option A: [fix-protocol, performance, tbricks]  # Normalized
Option B: [TBricks, Performance, fix-protocol]  # Original
Option C: Don't sync labels at all             # Local only
```

## Option A: Sync Normalized Labels (Standardize Jira Too)

**Flow:**
```
Tract: labels: [performance, tbricks]
  ↓
Sync to Jira
  ↓
Jira: labels: [performance, tbricks]  # Now lowercase
```

**Pros:**
- Consistency spreads (Jira gets standardized too)
- One source of truth (Tract's normalized format)
- Eventually all tools see normalized labels

**Cons:**
- Jira users see label changes (might be confusing)
- Jira admins might object
- Could break Jira JQL queries/dashboards that expect original case

**Use case:** You control Jira, want to standardize everywhere

## ~~Option B: Reverse Mapping~~ (REMOVED - Too Complex)

**We're not doing this.**

**Architect's verdict:** "Hard cheese for people in Jira!"

**Why reverse mapping is bad:**
- Complex config (maintain two mappings)
- Divergence risk (mappings get out of sync)
- Unnecessary (Jira users can adapt to lowercase)

**Better:** Forward mapping only (Jira → Tract normalizes, Tract → Jira sends as-is)

## Option C: Don't Sync Labels (Local Metadata)

**Config:**
```yaml
sync:
  fields:
    - title
    - status
    - assignee
    - priority
    # labels: false  # Don't sync labels
```

**Flow:**
```
Jira labels → Imported once → Normalized in Tract
Tract labels → Never synced back
```

**Pros:**
- Simplest (no sync logic needed)
- No confusion (Jira unchanged)
- Labels are local developer metadata

**Cons:**
- Labels in Jira can diverge from Tract
- Jira users don't see label changes made in Tract

**Use case:** Labels are developer tags, not PM metadata

## Recommendation by Use Case

### Migration (One-Time Import) ← Most Common

**No sync back to Jira:**
- Use Option C (don't sync labels)
- Fix Jira labels in Jira DB (if needed)
- Import once, normalize in Tract, move on

**Config:**
```yaml
# After migration, no sync
sync:
  enabled: false
```

**Jira label cleanup (if needed):**
- Jira admin runs SQL to standardize labels
- **Not Tract's job** - fix at source

### Ongoing Sync (Parallel Jira + Tract) ← Rare

**If you must keep Jira:**
- Use Option C (labels local to Tract)
- Don't sync labels back
- Jira users see Jira labels, Tract users see normalized labels

**If you want to standardize Jira:**
- Fix labels in Jira DB first
- Then import to Tract
- Or use Option A (sync normalized back)

### Recommended Default: Option C (Labels Local)

**Labels as local metadata:**
- Import labels from Jira (normalize them)
- Use them in Tract for queries/organization
- Don't sync back to Jira

**Why:**
- Simplest
- No risk of breaking Jira queries
- Labels are developer tools (like .vimrc), not PM data
- Can always enable sync later if needed

## Implementation

### Option A: Sync Normalized (Current Behavior)

**Already works - no changes needed.**

Sync server sends normalized labels to Jira.

### Option B: Reverse Mappings

**Add to sync server:**

```javascript
// tract-sync/lib/field-mapper.js
function mapLabelsToJira(tractLabels, config) {
  const reverseMappings = config.labels?.reverse_mappings || {};
  
  return tractLabels.map(label => {
    // Check reverse mapping
    if (reverseMappings[label]) {
      return reverseMappings[label];
    }
    
    // No mapping, keep as-is
    return label;
  });
}
```

**Config:**
```yaml
labels:
  mappings:
    TBricks: tbricks
  reverse_mappings:
    tbricks: TBricks
```

### Option C: Don't Sync Labels

**Add to sync config:**

```yaml
# .tract/config.yaml
sync:
  enabled: true
  fields:
    # Explicitly list fields to sync
    include:
      - title
      - status
      - assignee
      - priority
      - sprint
      - fix_version
    # Exclude labels
    exclude:
      - labels
```

**Or simpler:**
```yaml
sync:
  sync_labels: false  # Default: false
```

## Current Behavior (As Implemented)

**Import:** Labels normalized via hook ✓  
**Sync back:** Not implemented yet (sync server TODO)

**So currently:** Labels imported and normalized, no sync back.

**This is effectively Option C by default.**

## Proposed Default

**For now (Monday demo):**
- Import labels, normalize them
- Don't sync labels back to Jira
- Add to docs: "Labels are local metadata"

**Future (if needed):**
- Add `sync.sync_labels: true/false` config option
- Add reverse mappings if users request
- Keep default: false (labels local)

## Example Configs

### Developer (Migration)

```yaml
# One-time import, no sync
labels:
  case: lowercase
  mappings:
    TBricks: tbricks
    Tbricks: tbricks

sync:
  enabled: false  # No Jira sync
```

### Team (Ongoing Sync, Labels Local)

```yaml
# Parallel Jira + Tract
labels:
  case: lowercase
  mappings:
    TBricks: tbricks

sync:
  enabled: true
  sync_labels: false  # Labels stay in Tract
```

### Team (Ongoing Sync, Standardize Jira)

```yaml
# Normalize labels everywhere
labels:
  case: lowercase
  mappings:
    TBricks: tbricks

sync:
  enabled: true
  sync_labels: true  # Send normalized labels to Jira
```

### Team (Ongoing Sync, Preserve Jira)

```yaml
# Normalize in Tract, preserve in Jira
labels:
  case: lowercase
  mappings:
    TBricks: tbricks
  reverse_mappings:
    tbricks: TBricks  # Map back for Jira

sync:
  enabled: true
  sync_labels: true
```

## Documentation

**Add to LABEL-NORMALIZATION.md:**

```markdown
## Syncing Labels Back to Jira

**Default:** Labels are NOT synced back to Jira.

**Why:** Labels are local developer metadata (like tags).

**To enable label sync:**

```yaml
sync:
  sync_labels: true
```

**Warning:** Jira will see normalized labels (lowercase).
If Jira users expect original case, use reverse_mappings.
```

## Bottom Line

**Current behavior:** Labels imported, normalized, not synced back. **Perfect!**

**Recommendation:** Keep it that way.

**Jira label cleanup:** If Jira labels are messy, fix them in Jira (DB admin SQL). Not Tract's job.

**Tract label normalization:** For post-import cleanup and maintaining consistency in Tract.

**Sync architecture:** Most developers don't sync individually. Central CI/CD or team lead syncs.

---

**For Monday:** 
- Document labels as local metadata
- Document central sync architecture (CI/CD)
- Don't build complex reverse-mapping logic (YAGNI)

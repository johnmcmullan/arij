# Label Sync Decision (Final)

**Question:** Should we normalize labels on every sync? Or accept drift?

## The Problem

**Architect's insight:**
> "You run something once and it fails, you fix it. You run something all the time, it gets really good. You run something on a period and it breaks in new and unusual ways each time."

**Periodic jobs are banned.** So we have three choices:

1. **Run once** - Bulk import only
2. **Run always** - Every sync
3. **Never** - Don't sync labels at all

## The Clean Solution: Don't Sync Labels

**Labels are LOCAL metadata.** We already decided this.

**Flow:**
```
Bulk Import (once):
  Jira → Tract
  Import labels: [TBricks, Performance]
  Normalize: [performance, tbricks]
  Done ✓

Ongoing Sync (always):
  Jira ticket updated (title, status, assignee)
  Sync to Tract: Update title, status, assignee
  Labels: SKIP (local metadata, don't import)
  
Developer adds label in Tract:
  tract create APP --labels "tbricks,performance"
  Already normalized ✓
```

**Result:**
- Labels imported once, normalized once
- Labels never imported from Jira again
- New labels added in Tract (already normalized)
- No drift, no periodic job needed

## Configuration

```yaml
# .tract/config.yaml

sync:
  fields:
    include:
      - title
      - status
      - assignee
      - priority
      - sprint
      - fix_version
      # labels: excluded (local only)
```

**Or simpler:**
```yaml
sync:
  sync_labels: false  # Default: labels local to Tract
```

## What If We Must Sync Labels?

**If you really need to import labels from Jira during sync:**

### Option A: Always Normalize (Run Hook Every Sync)

```yaml
sync:
  sync_labels: true
  hooks:
    - normalize-labels  # Run on EVERY sync
```

**Flow:**
```
Jira: User adds label "TBricks"
  ↓
Sync: Import label to Tract
  ↓
Hook: Normalize "TBricks" → "tbricks"
  ↓
Commit
```

**Pros:**
- Always consistent
- Runs all the time (gets battle-tested)

**Cons:**
- Hook runs on every sync (performance)
- Only normalizes the ONE ticket that changed

**Problem:** Other tickets might have old unnormalized labels from before we added the hook.

### Option B: Normalize ALL Tickets on Every Sync

**What architect asked:**
> "Unless you can think of a way to run these sanitations against the entire project again when we get one new ticket..."

**Implementation:**
```javascript
// On every sync
async handleSync(updatedTicket) {
  // Update the one ticket that changed
  await updateTicket(updatedTicket);
  
  // Normalize ALL tickets (not just the one)
  await normalizeLabels('issues/');
  
  // Commit
  await commitChanges('Sync: updated ticket + normalized all labels');
}
```

**Pros:**
- Always consistent (all tickets normalized)
- Runs all the time (battle-tested)

**Cons:**
- SLOW (processes all tickets on every sync)
- Git noise (every sync rewrites all files)
- Terrible idea

### Option C: Don't Normalize (Accept Drift)

```yaml
sync:
  sync_labels: true
  hooks: []  # No normalization
```

**Flow:**
```
Jira: Label "TBricks"
  ↓
Sync: Import as-is
  ↓
Tract: Label "TBricks" (unnormalized)
```

**Accept:** Some tickets normalized, some not.

## Recommendation: Don't Sync Labels

**Best solution:**
1. **Import labels once** (bulk import, normalize)
2. **Don't sync labels** (they're local metadata)
3. **New labels added in Tract** (via CLI, already normalized)

**Config:**
```yaml
import:
  hooks:
    - normalize-labels  # Run once on bulk import

sync:
  sync_labels: false   # Don't import labels from Jira
```

**Why this works:**
- Labels imported once ✓
- Normalized once ✓
- Never synced again ✓
- No drift (labels local) ✓
- No periodic job needed ✓

## Alternative: Forward Mapping Only (If You Must Sync Labels)

**Architect's approach:** "We could get the labels right in Tract for new tickets, but not the other way around. Hard cheese for people in Jira!"

**Forward mapping (Jira → Tract):**
```javascript
// tract-sync/lib/field-mapper.js

function mapJiraToTract(jiraIssue, config) {
  // ...
  
  // Normalize labels coming FROM Jira
  if (config.sync?.sync_labels) {
    const labels = jiraIssue.fields.labels || [];
    tractTicket.labels = normalizeLabels(labels, config);
  }
  
  return tractTicket;
}

function normalizeLabels(labels, config) {
  const mappings = config.labels?.mappings || {};
  const labelCase = config.labels?.case || 'lowercase';
  
  return labels
    .map(label => mappings[label] || label)  // Apply forward mapping
    .map(label => labelCase === 'lowercase' ? label.toLowerCase() : label)
    .filter((label, index, arr) => 
      arr.findIndex(l => l.toLowerCase() === label.toLowerCase()) === index
    )
    .sort();
}
```

**Reverse mapping (Tract → Jira):** **DON'T DO IT**

```javascript
function mapTractToJira(tractTicket, config) {
  // Send normalized labels to Jira as-is
  return {
    labels: tractTicket.labels  // [performance, tbricks]
    // NOT: [Performance, TBricks] - no reverse mapping
  };
}
```

**Result:**
- Jira imports "TBricks" → Tract gets "tbricks" ✓
- Tract creates "tbricks" → Jira gets "tbricks" (lowercase)
- Jira users see: "tbricks" (normalized)

**Hard cheese for Jira users!** They'll adapt.

**Why this is better than reverse mapping:**
- Simpler (one-way only)
- Consistent (Tract is source of truth for format)
- No complex bidirectional config
- Gradually standardizes Jira too

**Config:**
```yaml
labels:
  case: lowercase
  mappings:
    TBricks: tbricks     # Forward only
    Tbricks: tbricks     # No reverse needed
    Performance: performance
```

**Benefits:**
- New Jira labels → Normalized in Tract ✓
- New Tract labels → Lowercase in Jira ✓
- Eventually Jira gets normalized too ✓
- No reverse_mappings complexity ✓

## The Real Answer

**Don't sync labels.**

**Why:**
1. Labels are developer metadata (like tags)
2. Jira and Tract can have different label schemes
3. Avoids the entire consistency problem
4. Simpler mental model

**If someone complains:**
- Jira admins can fix labels in Jira DB
- Tract has normalized labels locally
- Two different systems, two different schemas

**This is OK.**

## Bottom Line

**Architect is right:** No periodic jobs.

**Options:**
1. **Recommended:** Don't sync labels (local metadata)
2. **If must sync:** Normalize at sync point (in mapper, not hook)
3. **Never:** Periodic re-normalization (breaks unpredictably)

**Accept:** If you sync labels, only the SYNCED ticket is normalized. Old tickets stay as-is. That's life.

**Or:** Don't sync labels. Problem solved.

---

**For Monday:** Labels local, don't sync. Clean, simple, no periodic jobs.

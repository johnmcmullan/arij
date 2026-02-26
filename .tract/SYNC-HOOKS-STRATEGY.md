# Sync Hooks Strategy

**Question:** Do post-import hooks run every time we get something from Jira?

**Current behavior:** Hooks only run on `tract import` command (bulk import).

**Not implemented:** Hooks on webhook sync (ongoing individual updates).

## The Scenarios

### Scenario 1: Bulk Import (One-Time or Manual)

```bash
tract import
# Fetches 42 tickets from Jira
# Converts to markdown
# Runs post-import hooks:
#   - sanitize-timestamps (fix all timestamps)
#   - normalize-labels (fix all labels)
# Commits to git
```

**When:** Initial import, or manual re-import  
**Frequency:** Rare (once, or occasionally)  
**Hooks make sense:** YES - batch operation, normalize everything

---

### Scenario 2: Webhook Sync (Ongoing Individual Updates)

```
Jira webhook fires:
  → "Ticket APP-123 updated"
  → Sync server receives webhook
  → Updates issues/APP-123.md
  → Commits to git
  
Should hooks run here?
```

**When:** Ongoing (every Jira ticket update)  
**Frequency:** Frequent (many times per day)  
**Current behavior:** Hooks DON'T run  
**Question:** Should they?

---

## Options

### Option A: Run Hooks on Every Sync (Always Normalize)

**Config:**
```yaml
import:
  hooks: [sanitize-timestamps, normalize-labels]

sync:
  run_hooks: true  # Run import hooks on sync too
```

**Flow:**
```
Jira: User adds label "TBricks" to APP-123
  ↓
Webhook: Sync server gets update
  ↓
Tract: Update APP-123.md with label "TBricks"
  ↓
Hooks: normalize-labels runs
  ↓
Tract: Label becomes "tbricks"
  ↓
Git: Commit with normalized label
```

**Pros:**
- Consistent (always normalized)
- Fixes new label chaos from Jira
- Simple (same hooks everywhere)

**Cons:**
- Performance (hooks run frequently)
- Git noise (every sync = rewrite + commit)
- Might normalize user's intentional changes

---

### Option B: Don't Run Hooks on Sync (Import Only)

**Config:**
```yaml
import:
  hooks: [sanitize-timestamps, normalize-labels]

sync:
  run_hooks: false  # Default: hooks only on import
```

**Flow:**
```
Jira: User adds label "TBricks" to APP-123
  ↓
Webhook: Sync server gets update
  ↓
Tract: Update APP-123.md with label "TBricks"  # As-is from Jira
  ↓
Git: Commit (no hooks run)
```

**Pros:**
- Fast (no hook overhead)
- Clean git history (one commit per sync)
- Labels stay as Jira sent them

**Cons:**
- Inconsistent (some tickets normalized, some not)
- Label chaos can creep back in
- Manual cleanup needed later

---

### Option C: Selective Hooks (Smart Execution)

**Config:**
```yaml
import:
  hooks:
    - sanitize-timestamps  # Always run
    - normalize-labels     # Only on import

sync:
  hooks:
    - sanitize-timestamps  # Run on sync (cheap)
    # normalize-labels: skip (already normalized)
```

**Flow:**
```
Jira: Update ticket timestamp
  ↓
Sync: Update APP-123.md
  ↓
Hooks: sanitize-timestamps runs (fix git time)
  ↓
Git: Commit

Jira: Add label "TBricks"
  ↓
Sync: Update APP-123.md (label "TBricks" as-is)
  ↓
Hooks: normalize-labels SKIPPED (not in sync hooks)
  ↓
Git: Commit with "TBricks"
```

**Pros:**
- Fast (only necessary hooks)
- Consistent timestamps (always match git)
- Labels normalized on import, left alone on sync

**Cons:**
- New labels from Jira not normalized
- More complex config

---

### Option D: Conditional Hooks (Run Only If Needed)

**Smart hook logic:**

```javascript
async normalizeLabels(issuesDir, mode = 'import') {
  // Skip if sync mode and labels already normalized
  if (mode === 'sync') {
    const hasUnnormalized = await this.checkForUnnormalizedLabels(issuesDir);
    if (!hasUnnormalized) {
      console.log('  Labels already normalized, skipping');
      return;
    }
  }
  
  // Run normalization
  // ...
}
```

**Pros:**
- Efficient (only runs when needed)
- Always correct (normalizes if chaos detected)
- Automatic (no manual cleanup)

**Cons:**
- Complex (hooks need to be smart)
- Performance (still need to check every time)

---

## Recommendation

### For Now (Monday): Option B (No Sync Hooks)

**Why:**
- Simplest
- Avoids performance concerns
- Import hooks already normalize everything
- Ongoing sync = individual updates (probably from users in Tract, not Jira)

**Config:**
```yaml
import:
  hooks:
    - sanitize-timestamps
    - normalize-labels

# Sync hooks: not implemented yet
```

**Behavior:**
- Bulk import → Hooks run → Everything normalized
- Webhook sync → No hooks → Updates as-is from Jira

**Assumption:** Most updates come from Tract (devs), not Jira (PMs).

---

### Future (Week 2): Option C (Selective Sync Hooks)

**Add sync hook config:**

```yaml
import:
  hooks:
    - sanitize-timestamps
    - normalize-labels

sync:
  hooks:
    - sanitize-timestamps  # Only this one
```

**Why:**
- Timestamps should always match git (cheap, always run)
- Labels already normalized (skip unless explicitly enabled)

**Implementation:**
```javascript
// tract-sync/webhook-handler.js

async handleJiraWebhook(event) {
  // Update ticket file
  await this.updateTicket(event);
  
  // Run sync hooks (if configured)
  if (this.config.sync?.hooks) {
    await this.runHooks(this.config.sync.hooks, issuesDir);
  }
  
  // Commit
  await this.commitChanges();
}
```

---

## Edge Cases

### Case 1: Jira User Adds Unnormalized Label

**Scenario:**
```
Jira PM: Adds label "TBricks" to APP-123
  ↓
Webhook: Sync to Tract
  ↓
Tract: Label "TBricks" (unnormalized)
```

**With Option B (no sync hooks):**
- Label stays "TBricks"
- Inconsistent with normalized tickets
- Manual cleanup needed later

**With Option C (selective hooks):**
- Label stays "TBricks" (normalize-labels not in sync hooks)
- Same problem

**With Option A (always run hooks):**
- Label becomes "tbricks" automatically
- Consistent

**Solution:** Re-import periodically to normalize everything.

```bash
# Monthly cleanup (CI/CD job)
tract import --update-existing
# Re-runs hooks on all tickets
```

---

### Case 2: Git Timestamp vs Jira Timestamp

**Scenario:**
```
Jira: Ticket updated at 10:00 AM
  ↓
Webhook: Sync at 10:01 AM (1 min delay)
  ↓
Git: Commit at 10:01 AM
  ↓
Ticket frontmatter: updated: 10:00 AM (from Jira)
Git commit time: 10:01 AM (actual)
```

**With sanitize-timestamps hook:**
```
Git commit: 10:01 AM
Ticket updated: 10:01 AM (fixed to match git)
```

**Without hook:**
```
Git commit: 10:01 AM
Ticket updated: 10:00 AM (Jira time)
Mismatch!
```

**Recommendation:** Always run sanitize-timestamps on sync.

---

## Implementation Plan

### Phase 1 (Current - Monday)

**Import hooks only:**
```yaml
import:
  hooks:
    - sanitize-timestamps
    - normalize-labels
```

**Sync:** No hooks

**Cleanup:** Periodic re-import if needed

---

### Phase 2 (Week 2)

**Add sync hook config:**
```yaml
sync:
  hooks:
    - sanitize-timestamps  # Always run (cheap, important)
```

**Selective:** normalize-labels only on import

---

### Phase 3 (Month 2)

**Smart hooks:**
- Detect if normalization needed
- Run only when necessary
- Log what was fixed

**Advanced config:**
```yaml
sync:
  hooks:
    - sanitize-timestamps: always
    - normalize-labels: auto  # Run if unnormalized detected
```

---

## Current Behavior (As Implemented)

**Import:**
```bash
tract import
# ✓ sanitize-timestamps runs
# ✓ normalize-labels runs
```

**Sync (webhook):**
```
# Sync server not implemented yet
# When implemented: No hooks by default
```

---

## Proposed Defaults

### Import (Bulk)
```yaml
import:
  hooks:
    - sanitize-timestamps  # Fix timestamps to git
    - normalize-labels     # Fix label chaos
```

### Sync (Individual Updates)
```yaml
sync:
  hooks:
    - sanitize-timestamps  # Always match git time
    # normalize-labels: skip (already normalized from import)
```

### ~~Periodic Cleanup~~ (BAD IDEA - REMOVED)

**Don't do this:**
```bash
# Monthly cron job (NO!)
tract import --update-existing
```

**Why periodic jobs are bad:**
- Run once: Works, you fix issues, move on ✓
- Run always: Gets battle-tested, very reliable ✓
- Run periodically: Fails in new ways each time, nobody notices ✗

**Cron doesn't solve this. It creates silent failures.**

---

## Bottom Line

**Current:** Hooks only run on `tract import` (bulk)

**Sync webhooks:** Not implemented yet. When implemented, recommend:
- Default: Only sanitize-timestamps (cheap, important)
- Optional: normalize-labels (if paranoid about Jira chaos)
- Periodic: Re-import with hooks for full cleanup

**For Monday:** Current behavior is fine. Hooks on import, not on sync.

**Future:** Add selective sync hooks when sync server is ready.

---

**Key insight:** Import = normalize everything. Sync = keep fast, normalize only critical things (timestamps).

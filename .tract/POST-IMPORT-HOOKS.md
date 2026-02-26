# Post-Import Hooks

Extensible hook system for running operations after ticket import.

## Configuration

```yaml
# .tract/config.yaml
import:
  hooks:
    - sanitize-timestamps  # Fix timestamps based on git history
    # Add more hooks here
```

## Built-In Hooks

### `sanitize-timestamps`

**Purpose:** Fix ticket timestamps to match git history

**Problem:** 
- Jira import sets `created` and `updated` from Jira
- But git modified time is the source of truth for when file changed
- Mismatched timestamps confuse git-based queries

**Solution:**
- Read git log for each ticket file
- Update `updated` timestamp to match last git commit
- Update `created` if it's after git time (impossible scenario)

**Example:**
```yaml
# Before (from Jira)
created: 2025-01-15T10:00:00Z
updated: 2026-02-10T14:30:00Z

# After (git says last modified Feb 14)
created: 2025-01-15T10:00:00Z  # Unchanged (makes sense)
updated: 2026-02-14T12:15:00Z  # Fixed to git commit time
```

**When it runs:**
- After all tickets are converted to markdown
- Before final import complete message

**Safe:**
- Only updates timestamps if file is already in git
- Skips files not yet committed
- Non-destructive (can be re-run)

## Custom Hooks

To add a new hook:

### 1. Add to config
```yaml
import:
  hooks:
    - sanitize-timestamps
    - your-custom-hook  # Add here
```

### 2. Implement in ticket-importer.js

```javascript
async runHook(hookName, issuesDir) {
  switch (hookName) {
    case 'sanitize-timestamps':
      await this.sanitizeTimestamps(issuesDir);
      break;
    
    case 'your-custom-hook':
      await this.yourCustomHook(issuesDir);
      break;
    
    default:
      console.log(chalk.yellow(`  Unknown hook: ${hookName}`));
  }
}

async yourCustomHook(issuesDir) {
  // Your implementation
  const files = fs.readdirSync(issuesDir).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const filePath = path.join(issuesDir, file);
    // Do something with the file
  }
}
```

## Hook Ideas

### `normalize-labels`
Standardize label names (lowercase, remove spaces, etc.)

### `extract-epic-links`
Convert Jira epic links to Tract parent/epic field

### `add-default-assignee`
Set assignee to current user if unassigned

### `categorize-by-title`
Auto-add labels based on title keywords

### `generate-changelog`
Create CHANGELOG.md summarizing import

### `validate-format`
Check all tickets match expected schema

## Hook Execution Order

Hooks run in the order specified in config:

```yaml
import:
  hooks:
    - sanitize-timestamps   # Runs first
    - normalize-labels       # Runs second
    - validate-format        # Runs last
```

## Error Handling

**Hook fails → Warning logged, import continues**

```
✓ Converted 42 tickets to markdown
⚠ Hook 'custom-hook' failed: Field 'xyz' not found
✓ Post-import hooks complete

✅ Import Complete!
```

Non-fatal errors - import succeeds even if hook fails.

## Disabling Hooks

**Disable all hooks:**
```yaml
import:
  hooks: []
```

**Disable specific hook:**
```yaml
import:
  hooks:
    # - sanitize-timestamps  # Commented out
    - normalize-labels
```

**Command-line override:**
```bash
tract import --no-hooks
```

(Not implemented yet, but easy to add)

## Use Cases

### After Jira Import

**Scenario:** Imported 500 tickets from Jira, timestamps are wonky

**Solution:**
```bash
# Hooks run automatically during import
tract import

# Or re-run manually
cd issues/
git log --format='%H %aI' --name-only -- *.md | # Get commit times
  while read hash time; do
    read file
    # Update timestamp in frontmatter
  done
```

### Before Git Commit

**Scenario:** Want to validate all tickets before committing

**Hook:** `validate-format` - checks schema compliance

```javascript
async validateFormat(issuesDir) {
  const files = fs.readdirSync(issuesDir).filter(f => f.endsWith('.md'));
  const errors = [];
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(issuesDir, file), 'utf8');
    const parts = content.split('---\n');
    
    if (parts.length < 3) {
      errors.push(`${file}: Missing frontmatter`);
      continue;
    }
    
    const frontmatter = yaml.load(parts[1]);
    
    // Check required fields
    if (!frontmatter.id) errors.push(`${file}: Missing 'id'`);
    if (!frontmatter.title) errors.push(`${file}: Missing 'title'`);
    if (!frontmatter.status) errors.push(`${file}: Missing 'status'`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed:\n  ${errors.join('\n  ')}`);
  }
}
```

## Philosophy

**Hooks = Post-processing steps that improve data quality**

**NOT:**
- Critical to import (should be optional)
- Complex transformations (keep simple)
- External API calls (keep fast)

**YES:**
- Data normalization
- Timestamp fixes
- Format validation
- Metadata enrichment

**Guideline:** Each hook should be independent and idempotent (safe to re-run).

---

**Bottom line:** Extensible hook system for cleaning up imported data. Start with `sanitize-timestamps`, add more as needed.

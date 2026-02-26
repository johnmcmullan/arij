# Sprint Field Sync Issue

## Problem

**We're not importing sprint data from Jira.**

Looking at `ticket-importer.js`, we import:
- ✅ assignee, reporter
- ✅ components, labels
- ✅ fix_version, affected_version
- ✅ priority, status, type
- ✅ links, parent
- ✅ worklogs, estimates
- ❌ **sprint** - MISSING

## Why Sprint is Tricky

In Jira, **sprint is a custom field**, not a standard field.

**Field name varies by Jira instance:**
- `customfield_10020` (common default)
- `customfield_10100`
- `customfield_xxxxx` (varies)

**Sprint field format in Jira API:**
```json
{
  "fields": {
    "customfield_10020": [
      {
        "id": 123,
        "name": "Sprint 7",
        "state": "active",
        "boardId": 1,
        "goal": "Ship auth refactor"
      }
    ]
  }
}
```

Or sometimes just:
```json
{
  "fields": {
    "sprint": "Sprint 7"
  }
}
```

## Solution Options

### Option 1: Auto-Detect Sprint Field (Recommended)

During onboarding, detect which custom field is the sprint:

```javascript
// During onboarding/import
async function detectSprintField(jiraClient, projectKey) {
  // Get a sample issue
  const issues = await jiraClient.searchIssues(
    `project = ${projectKey}`, 
    1
  );
  
  if (issues.length === 0) return null;
  
  const fields = issues[0].fields;
  
  // Look for fields with "sprint" in the name or value
  for (const [key, value] of Object.entries(fields)) {
    if (key.toLowerCase().includes('sprint') || 
        (value && JSON.stringify(value).toLowerCase().includes('sprint'))) {
      return key;
    }
  }
  
  return null;
}
```

Store in config:
```yaml
# .tract/config.yaml
jira:
  url: https://jira.company.com
  project: APP
  sprint_field: customfield_10020  # Auto-detected
```

### Option 2: Ask During Onboarding

```bash
tract onboard --jira https://jira.company.com

→ Jira project key? APP
→ Detect sprint field? (y/n) y

Checking Jira configuration...
✓ Found sprint field: customfield_10020
  
Save this for sprint sync? (y/n) y
```

### Option 3: Manual Configuration

```yaml
# .tract/config.yaml
jira:
  sprint_field: customfield_10020  # User looks this up
```

## Implementation

### Update ticket-importer.js

```javascript
convertToMarkdown(issue) {
  const fields = issue.fields;
  const frontmatter = { /* ... */ };
  
  // Add sprint handling
  if (this.config.jira?.sprint_field) {
    const sprintField = fields[this.config.jira.sprint_field];
    
    if (sprintField) {
      // Sprint can be array or single value
      const sprints = Array.isArray(sprintField) ? sprintField : [sprintField];
      
      // Get active or most recent sprint
      const activeSprint = sprints.find(s => s.state === 'active') || 
                           sprints[sprints.length - 1];
      
      if (activeSprint) {
        // Extract sprint ID or name
        if (typeof activeSprint === 'object') {
          // Convert "Sprint 7" → "2026-W07" or use sprint ID
          frontmatter.sprint = this.normalizeSprintName(activeSprint.name);
        } else if (typeof activeSprint === 'string') {
          frontmatter.sprint = this.normalizeSprintName(activeSprint);
        }
      }
    }
  }
  
  // ... rest of conversion
}

normalizeSprintName(jiraSprint) {
  // Option 1: Extract sprint number and create ID
  const match = jiraSprint.match(/Sprint\s+(\d+)/i);
  if (match) {
    const sprintNum = match[1];
    // Could calculate week from sprint number if known
    return `sprint-${sprintNum}`;
  }
  
  // Option 2: Sanitize the name
  return jiraSprint.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
```

### Update onboard.js

```javascript
async function onboard(options) {
  // ... existing code
  
  // After fetching project metadata
  if (!isLocal) {
    // Detect sprint field
    const sprintField = await detectSprintField(jira, projectKey);
    
    if (sprintField) {
      console.log(chalk.green(`✓ Detected sprint field: ${sprintField}`));
      config.jira.sprint_field = sprintField;
    } else {
      console.log(chalk.yellow('⚠ Sprint field not detected (skipping sprint sync)'));
    }
  }
  
  // ... write config
}
```

## Sprint ID Mapping Strategy

**Jira sprint:** "Sprint 7"  
**Tract sprint ID:** Multiple options

### Option A: Extract Number
```
"Sprint 7" → "sprint-7"
"Q1 Sprint 3" → "sprint-3"
```

### Option B: Calculate Week
If you know sprint dates:
```
Sprint 7 (Feb 10-21) → "2026-W07"
```

### Option C: Use Jira Sprint ID
```
Sprint object { id: 123, name: "Sprint 7" } → "jira-sprint-123"
```

### Option D: Keep Original (Sanitized)
```
"Sprint 7" → "sprint-7"
"Auth Focus Sprint" → "auth-focus-sprint"
```

**Recommendation:** Option A (extract number) or D (sanitize name)

## Bidirectional Sync

### Jira → Tract (Import)
```
Jira ticket sprint field: "Sprint 7"
Tract ticket frontmatter: sprint: sprint-7
```

### Tract → Jira (Sync)
```
Tract ticket: sprint: sprint-7
Map back to Jira sprint: "Sprint 7" (or ID 123)
Requires sprint mapping in config
```

**Mapping:**
```yaml
# .tract/sprints/sprint-7.yaml
name: Sprint 7
jira_name: "Sprint 7"  # Or jira_id: 123
start: 2026-02-10
end: 2026-02-21
```

## Quick Fix (Monday)

**Minimal implementation:**

1. Add sprint field detection during onboarding
2. Store sprint_field in config
3. Import sprint value during ticket import
4. Normalize sprint name (sanitize string)

**Code changes:**
- Update `ticket-importer.js` - Add sprint field extraction
- Update `onboard.js` - Detect sprint field
- Update config schema - Add `jira.sprint_field`

**Test:**
```bash
tract onboard --jira https://jira.test.com --project APP
# Should detect and save sprint_field

tract import
# Should import tickets with sprint values
```

## Long-Term

- Sprint name mapping (Jira ↔ Tract)
- Sprint metadata sync (optional)
- Support multiple sprint formats
- Handle sprint transitions (ticket moves between sprints)

---

**Bottom line:** We're not getting sprint currently. Need to detect custom field and extract value during import.

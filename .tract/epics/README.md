# Epic Definitions

Epic definition files are **optional** and **local to each developer**.

## Philosophy

**Ticket field:** `epic: TB-010` (just the ID, syncs across repos)  
**Definition file:** `.tract/epics/TB-010.yaml` (optional, local, personal)

Each developer can maintain their own epic definitions with their preferred level of detail. Epic definitions are planning artifacts, not canonical data.

## Format

```yaml
id: TB-010
name: Short descriptive name
goal: What this epic aims to achieve
status: in-progress | planning | done
owner: person-responsible
start: 2026-01-15
target: 2026-03-30
notes: |
  Free-form notes, objectives, deliverables, etc.
```

## Querying

**Find all tickets in an epic:**
```bash
grep -r '^epic: TB-010$' tickets/
```

**Get epic details (if defined):**
```bash
cat .tract/epics/TB-010.yaml
```

## Do NOT Maintain Child Lists

Epic tickets should NOT contain a list of child tickets. Query children via grep instead.

**Why:** Prevents double-reference problems and sync conflicts in distributed workflows.

## Examples

See existing epic definitions in this directory for reference.

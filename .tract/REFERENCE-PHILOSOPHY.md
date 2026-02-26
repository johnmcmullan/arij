# Reference Philosophy

This document explains how Tract handles references between entities and when double-references are acceptable.

## The Core Pattern: ID + Optional Definition

Several fields follow the same pattern as **sprints**:

| Field | Ticket Value | Definition File | Syncs? | Local? |
|-------|--------------|-----------------|--------|--------|
| `sprint` | `2026-W07` | `.tract/sprints/2026-W07.yaml` | ✅ ID only | ✅ Definition |
| `epic` | `TB-010` | `.tract/epics/TB-010.yaml` | ✅ ID only | ✅ Definition |
| `component` | `trading-oms` | `.tract/components.yaml` | ✅ ID only | ✅ Definition |
| `fix_version` | `"6.8.0"` | `.tract/releases/6.8.0.yaml` | ✅ ID only | ✅ Definition |
| `customer` | `acme-corp` | `.tract/customers/acme-corp.yaml` | ✅ ID only | ✅ Definition |

### Philosophy

**What syncs:** The ID reference in the ticket frontmatter (e.g., `sprint: 2026-W07`)

**What doesn't sync:** The definition files (e.g., `.tract/sprints/2026-W07.yaml`)

**Why:**
- Different developers may have different planning preferences
- Definition files are local convenience, not canonical data
- IDs are the only thing that matters for distributed collaboration
- No conflicts when multiple developers edit definition files

**Querying:**
- To find all tickets in a sprint: `grep -r '^sprint: 2026-W07$' tickets/`
- To get sprint details: `cat .tract/sprints/2026-W07.yaml` (if it exists locally)

## Ticket Links: Accept Incoherence

Ticket links (blocks, blocked_by, related_to, parent, child) are **different**.

### The Trade-Off

You **can specify both sides** of a relationship:
- TB-5: `links: [{ rel: blocks, ref: TB-10 }]`
- TB-10: `links: [{ rel: blocked_by, ref: TB-5 }]`

**But they may become incoherent** (TB-5 says it blocks TB-10, but TB-10 doesn't mention TB-5).

### Why We Accept This

**Benefits:**
- ✅ Explicit relationships are visible when reading a ticket
- ✅ Faster queries (no need to scan all tickets)
- ✅ Each ticket is self-describing
- ✅ Flexibility in distributed editing

**Cost:**
- ⚠️ Links may become inconsistent
- ⚠️ Need to check both sides when querying

**Decision:** The flexibility is worth the risk. Validation tools can flag inconsistencies but should not block operations.

### Querying Relationships

When looking for relationships, **check both directions**:

```bash
# Find all tickets blocked by TB-5
# Option 1: TB-5 explicitly lists them
grep '^  - rel: blocks$' tickets/TB-5.md -A1

# Option 2: Other tickets say they're blocked by TB-5
grep -r 'blocked_by.*TB-5' tickets/
```

## Epic: Not a Link

The `epic` field is **separate from the links system**.

### Epic is a Simple Reference

```yaml
epic: TB-010
```

**Do NOT:**
- Treat epic as a link type
- Add child lists to epic tickets
- Maintain bidirectional epic relationships

**Do:**
- Query epic children via grep: `grep -r '^epic: TB-010$' tickets/`
- Store epic definitions in `.tract/epics/TB-010.yaml` (optional)
- Keep epic tickets clean and simple

### Why Epic is Different

**Links** are peer-to-peer relationships (any ticket can link to any ticket).

**Epics** are hierarchical containers (many tickets belong to one epic).

Treating epic as a link would force epic tickets to maintain child lists, creating:
- Sync conflicts when multiple people add children
- Double-reference complexity
- Large epic ticket files

Instead: **Epic children are discovered via grep, not stored in epic ticket.**

## Summary

### Fields That Sync (ID Only)
- `sprint`, `epic`, `component`, `fix_version`, `customer`
- Definition files are local and optional

### Fields That May Diverge (Links)
- `links` (blocks, blocked_by, related_to, parent, child)
- Both sides can be specified
- Incoherence is acceptable

### No Double References
- Epic tickets do NOT maintain child lists
- Sprint files do NOT maintain ticket lists
- Component definitions do NOT track tickets

**Query via grep, don't maintain bidirectional lists.**

---

This philosophy keeps Tract simple, distributed-friendly, and conflict-free while accepting pragmatic trade-offs.

# AgentSkills Format Comparison

Comparison of original docs vs. AgentSkills-formatted versions.

## Summary

### Original Format (What I Built First)
- **ONBOARDING.md:** 145 lines - LLM guidance in single file
- **SCHEMA.md:** 1,026 lines - Complete spec in monolithic document
- **Total:** 1,171 lines in 2 files

### AgentSkills Format (Refactored)
- **tract-onboarding/SKILL.md:** 276 lines - Core workflow only
- **tract-onboarding/references/:** 552 lines across 3 files (CLI spec, auth, errors)
- **tract-schema/SKILL.md:** 489 lines - Essential operations only
- **tract-schema/references/:** 1,912 lines across 5 files (format, fields, structure, git, config)
- **Total:** 3,229 lines across 10 files (but loaded on-demand)

## Approach 1: Original Single-File Docs

### ONBOARDING.md (145 lines)
**Strengths:**
- Quick to read and understand
- All info in one place
- Good for humans browsing docs

**Weaknesses:**
- Mixed guidance (LLM vs human)
- No separation of workflow vs reference
- Always loaded in context (wastes tokens)

**Structure:**
```
ONBOARDING.md
├── Purpose
├── Two modes (interactive vs full-args)
├── Required information
├── Gathering credentials
├── After onboarding
├── Common issues
└── Example conversation
```

### SCHEMA.md (1,026 lines)
**Strengths:**
- Comprehensive - everything you need
- Good as a reference manual
- Clear, well-organized

**Weaknesses:**
- **Too large to load entirely** (always in context = expensive)
- Mixes "how to" with "reference specs"
- Hard to find specific info without reading whole thing

**Structure:**
```
SCHEMA.md
├── Directory structure (all variations)
├── Ticket format
├── Field reference (all fields)
├── ID generation
├── Config spec
├── Components, sprints, boards
├── Relationships, comments
├── Git conventions
└── Distribution patterns
```

## Approach 2: AgentSkills Format

### tract-onboarding Skill

**SKILL.md (276 lines) - Core workflow:**
- Purpose & triggers
- Step-by-step onboarding process
- Error handling patterns
- Example conversations
- When to load references

**references/ (552 lines total):**
- `onboard-cli-spec.md` (145 lines) - Complete flag reference
- `jira-auth.md` (125 lines) - Authentication setup
- `common-errors.md` (282 lines) - Troubleshooting guide

**Benefit:**
- Load SKILL.md always (~276 lines)
- Load references **only when needed** (error troubleshooting, auth issues, etc.)
- Token savings: ~50-70% in typical usage

### tract-schema Skill

**SKILL.md (489 lines) - Essential operations:**
- Core workflow (create/read/update)
- Common fields (not all fields)
- Basic git workflow
- Essential config
- When to load references

**references/ (1,912 lines total):**
- `ticket-format-spec.md` (348 lines) - Complete markdown format
- `field-reference.md` (325 lines) - All fields with examples
- `directory-structure.md` (318 lines) - All layout variations
- `git-conventions.md` (440 lines) - Complete git workflows
- `config-schema.md` (481 lines) - Full config reference

**Benefit:**
- Load SKILL.md always (~489 lines)
- Load field-reference.md **only when user asks** "what fields can I use?"
- Load git-conventions.md **only when** troubleshooting git issues
- Load directory-structure.md **only when** setting up submodules
- Token savings: ~70-80% in typical usage

## Token Economics

### Typical Onboarding Session

**Original format:**
- Load ONBOARDING.md: 145 lines
- Load SCHEMA.md: 1,026 lines
- **Total context: 1,171 lines** (always loaded)

**AgentSkills format:**
- Load tract-onboarding/SKILL.md: 276 lines
- Load tract-schema/SKILL.md: 489 lines (for post-onboarding questions)
- Load jira-auth.md **only if auth fails**: +125 lines
- **Typical total: 765 lines** (35% reduction)
- **Best case: 276 lines** (if no auth issues, no schema questions)

### Typical Ticket Management Session

**Original format:**
- Load SCHEMA.md: 1,026 lines (always)

**AgentSkills format:**
- Load tract-schema/SKILL.md: 489 lines (always)
- Load field-reference.md **only if** user asks about fields: +325 lines
- Load ticket-format-spec.md **only if** formatting question: +348 lines
- **Typical total: 489-837 lines** (50-60% reduction)
- **Best case: 489 lines** (just workflow, no deep questions)

## Usability Comparison

### For LLMs

**Original:**
- "Read everything, filter mentally"
- High token cost per session
- Slower response times (more context to process)

**AgentSkills:**
- "Read workflow, load details on-demand"
- Lower baseline token cost
- Faster responses for simple operations
- Pay for detail only when needed

### For Humans Browsing Docs

**Original:**
- Single-file = easy to browse
- Searchable with Ctrl+F
- Good for learning top-to-bottom

**AgentSkills:**
- Multiple files = harder to browse manually
- Must know which reference to open
- Better for targeted lookup

### For Repository as Product

**Original:**
- SCHEMA.md IS the product spec
- Self-contained, authoritative
- Good for "read the spec" philosophy

**AgentSkills:**
- SKILL.md + references/ IS the product
- Modular, composable
- Good for "LLM-native" philosophy

## The Philosophical Question

**You said:** "The product is the SCHEMA.md because we are basically using it to turn a model into a piece of software."

**Two interpretations:**

### Interpretation 1: SCHEMA.md is THE spec (monolithic)
- One canonical document
- Complete, self-contained
- Load it all, always
- **Trade-off:** High token cost, but guaranteed complete context

### Interpretation 2: SKILL.md + references/ is THE spec (modular)
- Skill = "how to operate the system"
- References = "complete technical specs"
- Together they define the product
- **Trade-off:** More files, but efficient token use

## Recommendation

**For Tract, I recommend AgentSkills format with a twist:**

### Hybrid Approach: "Core + References"

1. **Keep SCHEMA.md as the authoritative spec** (for humans, for "product is spec" philosophy)
2. **Generate tract-schema skill FROM SCHEMA.md** (for LLMs, for efficiency)
3. **SCHEMA.md = source of truth, SKILL.md = optimized view**

**Why:**
- SCHEMA.md remains the canonical product definition
- LLMs use SKILL.md + references for efficient operation
- Best of both worlds: authoritative spec + efficient execution

**Implementation:**
```
.tract/
├── SCHEMA.md                    # The Product (1,026 lines, canonical)
├── ONBOARDING.md                # Human-friendly onboarding guide
└── skills/
    ├── tract-onboarding/
    │   ├── SKILL.md             # LLM-optimized onboarding workflow
    │   └── references/          # Loaded on-demand
    └── tract-schema/
        ├── SKILL.md             # LLM-optimized operations (extracted from SCHEMA.md)
        └── references/          # Detailed specs (extracted from SCHEMA.md)
```

**Workflow:**
- **Humans:** Read SCHEMA.md, ONBOARDING.md
- **LLMs:** Load SKILL.md, fetch references/ as needed
- **Maintenance:** Update SCHEMA.md → auto-generate SKILL.md + references/

## Your Call, Architect

**Option A: Replace with AgentSkills**
- Delete ONBOARDING.md and SCHEMA.md
- Use skills/ exclusively
- **Pros:** Maximum efficiency, clean separation
- **Cons:** Lose "spec as product" clarity

**Option B: Hybrid (Recommended)**
- Keep SCHEMA.md and ONBOARDING.md as canonical docs
- Add skills/ as LLM-optimized views
- **Pros:** Best of both, clear product definition
- **Cons:** Duplication (but manageable)

**Option C: Keep Original**
- Just use ONBOARDING.md and SCHEMA.md
- Accept higher token costs
- **Pros:** Simple, one source of truth
- **Cons:** Inefficient for LLMs

What's your direction?

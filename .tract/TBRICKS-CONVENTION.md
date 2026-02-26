# The Tbricks Naming Convention

**20 years old. Zero confusion. Get it right.**

## The Rule (Joakim Hassila's Convention)

**Single capital at the beginning. Except acronyms.**

## The Correct Forms

### Product Name
`Tbricks` - Capital T, lowercase b

**NOT:**
- ❌ `TBricks` - Wrong! (Newcomer mistake, two capitals)
- ❌ `TBRICKS` - Wrong!
- ❌ `tbricks` - Wrong in product name context

### Unix/Label Context
`tbricks` - All lowercase (for Unix accounts, labels, file systems)

### Acronyms
`FIX`, `OMS`, `API` - All capitals (exception to the rule)

## Examples of the Convention

**Correct:**
- `Tbricks` - The product
- `TradingSession` - Class/parameter name
- `OrderBook` - Class/parameter name
- `FIX` - Acronym (exception)

**Wrong (Newcomer Mistakes):**
- ❌ `TBricks` - No! Single capital!
- ❌ `TradingSession` - Already correct
- ❌ `Orderbook` - Missing capital B

## Label Normalization for Tract

**The mapping:**

```yaml
labels:
  case: lowercase  # Labels are Unix-like (all lowercase)
  mappings:
    # Fix newcomer mistakes
    TBricks: tbricks   # Two capitals → correct lowercase
    Tbricks: tbricks   # Product name → Unix label
    TBRICKS: tbricks   # All caps → correct lowercase
    
    # Result: Always 'tbricks' in labels
```

**Why lowercase for labels:**
- Labels are like Unix accounts (lowercase)
- Product name is `Tbricks` (in docs, UI)
- Labels are `tbricks` (in code, tags, filesystem)

## The Annoyance

**What annoys the team:**
- Newcomers write `TBricks` (two capitals)
- Shows they don't understand the convention
- 20 years of consistency, broken by ignorance

**The pride:**
- 20 years, zero confusion
- Convention still holds
- Original architects: Jonas Hansbo, Joakim Johanson (now Hassila), Aleksey Dukhanov
- The cleverest men the architect ever met

## Tract's Job

**In labels (Unix context):**
- Normalize everything to `tbricks` (lowercase)
- This is correct for label/tag context

**In documentation (product context):**
- Use `Tbricks` (capital T, lowercase b)
- This is correct for product name

## Bottom Line

**Product name:** `Tbricks` (one capital)  
**Unix/labels:** `tbricks` (all lowercase)  
**Never:** `TBricks` (two capitals - newcomer mistake!)

**20 years. Zero confusion. Respect the convention.**

---

**The architect was right to be annoyed.** We almost normalized TO the wrong form.

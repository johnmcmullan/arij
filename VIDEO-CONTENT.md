# Tract Demo Video - Complete Content & Screenplay

**Duration:** 90 seconds  
**Target:** Developers who hate Jira  
**Goal:** Show the workflow is faster, cleaner, more powerful

---

## Frame-by-Frame Content

### Frame 1: Title Card (0:00 - 0:05)
**Duration:** 5 seconds

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                         TRACT                              ║
║                                                            ║
║           Project Management for Developers                ║
║              Who Hate Clicking Through Jira                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Voiceover (optional):**  
"Tract. Project management that works how developers actually work."

---

### Frame 2: The Problem (0:05 - 0:12)
**Duration:** 7 seconds

**Split screen or quick cuts showing:**

**Left side - Traditional Jira:**
```
1. Open browser
2. Navigate to Jira
3. Search for ticket
4. Click Edit
5. Fill out form
6. Click Save
7. Wait for page to load
8. Close browser
9. Context switch back to code
```

**Right side - Terminal (empty, waiting):**
```
$ _
```

**Text overlay:**  
"The old way: 9 steps, 2 minutes, total context switch"

---

### Frame 3: The Tract Way - Health Check (0:12 - 0:18)
**Duration:** 6 seconds

**Terminal output:**
```
$ tract doctor

🔍 Tract Doctor - Running diagnostics

Directory: /Users/john/code/app-tickets

✓ Git installed (git version 2.39.0)
✓ Git repository initialized
✓ Tract config directory exists
ℹ Tract config file valid (Project: APP)
ℹ Issues directory exists (42 tickets)
ℹ Git user configured (John McMullan <john@company.com>)
✓ Git remote configured (origin → ssh://git@server/app-tickets.git)
ℹ Sync server configured (http://tract-server:3100)
✓ Sync server reachable (Server healthy)

────────────────────────────────────────────────────────────
Summary:
  ✓ 5 passed
  ℹ 4 info

✓ All checks passed! Tract is healthy.
```

**Text overlay:**  
"Step 1: Verify setup (takes 2 seconds)"

**Voiceover:**  
"First, make sure everything's working. Tract tells you exactly what's wrong if something's broken."

---

### Frame 4: Create a Ticket (0:18 - 0:28)
**Duration:** 10 seconds

**Terminal output:**
```
$ tract create APP \
    --title "Fix session timeout bug" \
    --type bug \
    --priority high \
    --assignee john.mcmullan

📝 Creating ticket in APP...
   Title: Fix session timeout bug
   Type: bug

✅ Created APP-3456
   File: issues/APP-3456.md
   Synced to Jira and committed to git

🔗 Edit: issues/APP-3456.md
```

**Text overlay:**  
"Create ticket: 1 command, 3 seconds"

**Voiceover:**  
"Create a ticket from the terminal. No browser. No forms. No clicking. And it's already in Jira."

---

### Frame 5: The Ticket (Markdown) (0:28 - 0:35)
**Duration:** 7 seconds

**Terminal output:**
```
$ cat issues/APP-3456.md

---
title: Fix session timeout bug
type: Bug
status: To Do
priority: High
assignee: john.mcmullan
created: 2026-02-13T18:30:00Z
components: [Auth, Backend]
---

Users are getting logged out after 5 minutes.
Session timeout should be 30 minutes, not 5.

## Technical Details

The issue is in auth-middleware.js where SESSION_TTL 
is set to 300 (5 minutes) instead of 1800 (30 minutes).
```

**Text overlay:**  
"Just a markdown file. Edit with any tool."

**Voiceover:**  
"Tickets are just markdown files. Use vim, VS Code, whatever you want. No special tools required."

---

### Frame 6: Edit & Commit (0:35 - 0:42)
**Duration:** 7 seconds

**Terminal output:**
```
$ vim issues/APP-3456.md

# (quick vim edit showing adding a section)

$ git add issues/APP-3456.md

$ git commit -m "APP-3456: Add reproduction steps"
[master a7f3c2d] APP-3456: Add reproduction steps
 1 file changed, 8 insertions(+)

$ git push
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
To ssh://git@server/app-tickets.git
   f8e1b3a..a7f3c2d  master -> master

# Changes automatically synced to Jira ✓
```

**Text overlay:**  
"Use git. Because git is better than everything."

**Voiceover:**  
"Commit like any code change. Push. Done. Changes sync to Jira automatically."

---

### Frame 7: Log Time (0:42 - 0:48)
**Duration:** 6 seconds

**Terminal output:**
```
$ tract log APP-3456 2h "Fixed session TTL, increased to 30 min"

📝 Logging time to APP-3456...
   Author: john.mcmullan
   Time:   2h
   Work:   Fixed session TTL, increased to 30 min

✅ Time logged successfully!
   Entry: 2026-02-13T20:30:00Z
   Synced to Jira and committed to git
```

**Text overlay:**  
"Log time: 1 command, no forms"

**Voiceover:**  
"Log time in 5 seconds. Syncs to Jira instantly. Managers see it. You never open a browser."

---

### Frame 8: View Timesheet (0:48 - 0:54)
**Duration:** 6 seconds

**Terminal output:**
```
$ tract timesheet

Timesheet for john.mcmullan - 2026-02-13

┌─────────┬──────────┬──────┬─────────────────────────────────┐
│ Issue   │ Started  │ Time │ Comment                         │
├─────────┼──────────┼──────┼─────────────────────────────────┤
│ APP-3450│ 09:00    │ 4h   │ Implemented caching layer       │
│ APP-3451│ 13:00    │ 2h   │ Code review and testing         │
│ APP-3452│ 15:00    │ 1.5h │ Bug fixes in payment processor  │
│ APP-3456│ 20:30    │ 2h   │ Fixed session TTL               │
└─────────┴──────────┴──────┴─────────────────────────────────┘

Total: 9.5h ✅ (target: 8h)
```

**Text overlay:**  
"Check your day. Make sure you logged 8 hours."

**Voiceover:**  
"View your timesheet. Make sure you hit 8 hours. All from the terminal."

---

### Frame 9: Search (Grep) (0:54 - 1:00)
**Duration:** 6 seconds

**Terminal output:**
```
$ grep -r "timeout" issues/

issues/APP-3456.md:title: Fix session timeout bug
issues/APP-3456.md:Users are getting logged out after 5 minutes.
issues/APP-3456.md:Session timeout should be 30 minutes, not 5.
issues/APP-3456.md:The issue is in auth-middleware.js where SESSION_TTL
issues/APP-3451.md:title: Add request timeout handling
issues/APP-3451.md:Handle timeout errors gracefully in API clients.

$ _
```

**Text overlay:**  
"Search: grep > Jira search (100x faster)"

**Voiceover:**  
"Search tickets with grep. Way faster than Jira's search. And you can use sed, awk, whatever."

---

### Frame 10: Git History (1:00 - 1:06)
**Duration:** 6 seconds

**Terminal output:**
```
$ git log --oneline issues/APP-3456.md

a7f3c2d APP-3456: Add reproduction steps
f3e8b1a [tract-sync] Updated APP-3456 from Jira
c9d4e2f Update APP-3456: Add technical details
b8a1f5c Create APP-3456: Session timeout bug

$ git diff b8a1f5c..a7f3c2d issues/APP-3456.md

diff --git a/issues/APP-3456.md b/issues/APP-3456.md
+## Reproduction Steps
+
+1. Log in to the application
+2. Wait 5 minutes without activity
+3. Try to navigate to a new page
+4. Session expired - redirected to login
```

**Text overlay:**  
"Full git history. Every change tracked."

**Voiceover:**  
"See every change. Who edited what. When. Why. Because it's git."

---

### Frame 11: Work Offline (1:06 - 1:12)
**Duration:** 6 seconds

**Terminal output:**
```
# Jira is down (red text: "Could not reach Jira")

$ tract create APP --title "Add API rate limiting"

⏸️  Created APP-OFFLINE-1708025823 (offline)
   File: issues/APP-OFFLINE-1708025823.md
   Jira is unavailable - queued for sync when online
   Temporary ID will be updated to real Jira ID automatically

$ vim issues/APP-OFFLINE-1708025823.md

$ git commit -am "Create rate limiting ticket (offline)"
[master 3f7a8d2] Create rate limiting ticket (offline)

# When Jira comes back online:
# → Syncs automatically
# → Renames APP-OFFLINE-1708025823.md → APP-3457.md
```

**Text overlay:**  
"Jira down? No problem. Work offline."

**Voiceover:**  
"Jira down? Keep working. Create tickets, edit files, commit. Everything syncs when Jira comes back."

---

### Frame 12: The LLM Moment (1:12 - 1:24)
**Duration:** 12 seconds (the payoff)

**Split screen: Chat on left, Terminal on right**

**Left side (chat interface):**
```
You:
"Create a ticket for the auth bug we discussed earlier.
Make it high priority and assign to me."

AI (Claude/Copilot):
Sure! Creating a ticket now...

[Running: tract create APP --title "Fix authentication bug" 
         --type bug --priority high --assignee john.mcmullan]

✅ Created APP-3458
```

**Right side (terminal output appearing simultaneously):**
```
$ tract create APP \
    --title "Fix authentication bug" \
    --type bug \
    --priority high \
    --assignee john.mcmullan

✅ Created APP-3458
   File: issues/APP-3458.md
   Synced to Jira
```

**Then continue chat:**
```
You:
"I spent 3 hours on APP-3456. Log it."

AI:
Logging time...

[Running: tract log APP-3456 3h "Fixed session timeout bug"]

✅ Logged 3h to APP-3456
```

**Terminal:**
```
$ tract log APP-3456 3h "Fixed session timeout bug"

✅ Time logged successfully!
```

**Text overlay:**  
"Talk to AI. Never touch Jira again."

**Voiceover:**  
"Best part: Just talk to your AI. It runs the commands. You stay in flow. Never open Jira again."

---

### Frame 13: The Comparison (1:24 - 1:30)
**Duration:** 6 seconds

**Side-by-side comparison table:**

```
┌──────────────────────┬────────────────┬──────────────┐
│ Task                 │ Jira (old way) │ Tract        │
├──────────────────────┼────────────────┼──────────────┤
│ Create ticket        │ 2 minutes      │ 5 seconds    │
│ Log time             │ 1 minute       │ 3 seconds    │
│ Search tickets       │ 10+ seconds    │ < 1 second   │
│ View history         │ ❌ No git      │ ✅ Full git  │
│ Work offline         │ ❌ Impossible  │ ✅ Yes       │
│ LLM integration      │ ❌ API limits  │ ✅ Native    │
└──────────────────────┴────────────────┴──────────────┘
```

**Text overlay:**  
"24x faster. Git-native. LLM-friendly."

**Voiceover:**  
"Create tickets 24 times faster. Full git history. Works offline. And LLMs understand it natively."

---

### Frame 14: The Pitch (1:30 - 1:40)
**Duration:** 10 seconds

**Text on screen:**
```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                    Why Use Tract?                          ║
║                                                            ║
║  ✓ Developers work in their terminal (not browsers)       ║
║  ✓ Managers still use Jira (bidirectional sync)           ║
║  ✓ Everything in git (version control for free)           ║
║  ✓ LLMs understand files (better than APIs)                ║
║  ✓ Work offline (Jira down? No problem)                    ║
║  ✓ Save money ($15/user/month × 100 devs = $18k/year)     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Voiceover:**  
"Developers stay in their terminal. Managers keep using Jira. Everything syncs automatically. And you save eighteen thousand dollars a year by not paying for developer Jira licenses."

---

### Frame 15: Call to Action (1:40 - 1:50)
**Duration:** 10 seconds

**Terminal showing:**
```
$ git clone https://github.com/johnmcmullan/tract.git
$ cd tract
$ cat QUICKSTART.md

# Tract Quick Start

Install:
  npm install -g @tract/cli

Check setup:
  tract doctor

Clone repo:
  git clone ssh://git@server/app-tickets.git
  cd app-tickets

Create ticket:
  tract create APP --title "Your first ticket"

Start working:
  vim issues/APP-*.md
  git commit -am "Update ticket"
  git push

That's it.
```

**Text overlay:**
```
Try Tract:
github.com/johnmcmullan/tract

Stop clicking. Start coding.
```

**Voiceover:**  
"Try Tract. Stop clicking through Jira. Start coding."

---

### Frame 16: End Card (1:50 - 2:00)
**Duration:** 10 seconds

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                         TRACT                              ║
║                                                            ║
║              github.com/johnmcmullan/tract                 ║
║                                                            ║
║              Stop clicking. Start coding.                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝


              MIT Licensed • Open Source
```

---

## Production Notes

### Terminal Settings
- **Font:** Monospace, 18pt (readable in video)
- **Theme:** Dark (Solarized Dark or similar)
- **Size:** 100 columns × 30 rows
- **Prompt:** Simple `$ ` (no clutter)

### Timing
- **Type speed:** ~50ms per character (realistic)
- **Pauses:** 1-2 seconds between commands
- **Output:** Instant (no typing simulation for output)

### Colors (use ANSI codes)
- Green (`\033[0;32m`) for success (✓)
- Red (`\033[0;31m`) for errors
- Yellow (`\033[1;33m`) for warnings (⚠)
- Blue (`\033[0;34m`) for info (ℹ)
- Cyan (`\033[0;36m`) for commands ($)
- Gray (`\033[0;90m`) for comments

### Music (optional)
- Upbeat but subtle
- Lo-fi coding music vibe
- No lyrics
- Fades out for voiceover, back up during terminal-only sections

### Export Settings
- **Resolution:** 1920×1080 (1080p)
- **Frame rate:** 30 fps
- **Format:** MP4 (H.264)
- **Duration:** ~2 minutes (allows for pacing)

---

## Alternative: 30-Second Version (for Twitter/TikTok)

Keep only:
1. Frame 1: Title (3s)
2. Frame 4: Create ticket (5s)
3. Frame 7: Log time (4s)
4. Frame 12: LLM demo (10s)
5. Frame 15: Call to action (8s)

Total: 30 seconds, hits the key points.

---

## Distribution

**Upload to:**
- YouTube (full 2min version)
- Twitter/X (30s cut)
- LinkedIn (full version)
- Reddit r/programming (full version)
- Hacker News (link to YouTube)

**Title:**  
"Tract: Stop Clicking Through Jira, Start Using Git"

**Description:**  
"Project management for developers who hate Jira. Create tickets, log time, and search from your terminal. Everything syncs to Jira automatically. Git-native, LLM-friendly, works offline. MIT licensed."

**Thumbnail:**  
Split screen: Jira web UI (cluttered) vs. Clean terminal with green ✓ checkmarks

---

This is the complete content. Your colleague can follow this frame-by-frame and create exactly what you need.

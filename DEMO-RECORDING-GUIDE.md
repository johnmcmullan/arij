# How to Record the Tract Demo Video

## Option 1: Asciinema (Recommended - Easiest)

**Asciinema** records terminal sessions perfectly. The output can be:
- Embedded on GitHub/websites
- Converted to GIF/MP4
- Shared as a link

### Setup

```bash
# Install asciinema
npm install -g asciinema

# Or via package manager
brew install asciinema  # macOS
apt install asciinema   # Ubuntu/Debian
```

### Record

```bash
cd ~/path/to/tract

# Make demo script executable
chmod +x DEMO.sh

# Record the demo
asciinema rec tract-demo.cast -c "./DEMO.sh"
```

### Upload or Convert

**Upload to asciinema.org (easiest):**
```bash
asciinema upload tract-demo.cast
# You get a shareable URL like: https://asciinema.org/a/xyz123
```

**Convert to GIF (for README):**
```bash
# Install agg (asciinema GIF generator)
cargo install --git https://github.com/asciinema/agg

# Convert to GIF
agg tract-demo.cast tract-demo.gif

# Optimize GIF size
gifsicle -O3 tract-demo.gif -o tract-demo-optimized.gif
```

**Convert to MP4 (for YouTube/Twitter):**
```bash
# Install svg-term-cli
npm install -g svg-term-cli

# Convert to SVG
svg-term --in tract-demo.cast --out tract.svg

# Then use FFMPEG to convert SVG to MP4
# (requires ffmpeg: brew install ffmpeg)
```

---

## Option 2: ttyrec + ttygif

```bash
# Install ttyrec and ttygif
brew install ttyrec ttygif

# Record
ttyrec demo.tty -e ./DEMO.sh

# Convert to GIF
ttygif demo.tty
```

---

## Option 3: Manual Recording (If You Want Control)

Use **macOS QuickTime** or **OBS Studio** to screen-record the terminal.

### Setup Terminal

```bash
# Use a clean terminal profile with good colors
# Recommended: iTerm2 with "Solarized Dark" theme
# Or Terminal.app with "Pro" theme

# Set font size large enough for video
# 16-18pt recommended

# Terminal size: 100x30 (cols x rows)
# Run: printf '\e[8;30;100t'
```

### Run Demo Manually

Instead of the automated script, run commands one at a time:

```bash
# 1. Health check
tract doctor

# 2. Create ticket
tract create APP \
  --title "Fix session timeout bug" \
  --type bug \
  --priority high

# 3. View ticket
cat issues/APP-3456.md

# 4. Edit ticket
vim issues/APP-3456.md

# 5. Git workflow
git add issues/APP-3456.md
git commit -m "Update APP-3456: Add reproduction steps"
git push

# 6. Log time
tract log APP-3456 2h "Fixed session TTL"

# 7. Timesheet
tract timesheet

# 8. Search with grep
grep -r "timeout" issues/

# 9. Git log
git log --oneline issues/APP-3456.md
```

### Add Captions in Post

Use **Final Cut Pro**, **DaVinci Resolve**, or **Kapwing** to add:
- Title card: "Tract - Git-native Project Management"
- Captions explaining each step
- End card: "Learn more at github.com/johnmcmullan/tract"

---

## Option 4: Terminalizer (Animated GIFs)

```bash
# Install
npm install -g terminalizer

# Record interactively
terminalizer record demo

# Edit timing/config
terminalizer edit demo

# Render to GIF
terminalizer render demo -o tract-demo.gif
```

---

## Demo Script Breakdown (90 seconds)

**0:00-0:10** - Title card + intro  
**0:10-0:20** - `tract doctor` (health checks)  
**0:20-0:30** - `tract create` (create a ticket)  
**0:30-0:40** - `cat` / `vim` (view/edit ticket)  
**0:40-0:50** - `git add/commit/push` (git workflow)  
**0:50-1:00** - `tract log` (time tracking)  
**1:00-1:10** - `tract timesheet` (view logged time)  
**1:10-1:20** - `grep` / `git log` (search/history)  
**1:20-1:30** - LLM demo (text overlay showing conversation)  
**1:30-1:40** - Final summary screen

---

## Tips for a Great Recording

### Visual

- ✅ **Dark terminal theme** (easier on eyes, looks professional)
- ✅ **Large font** (16-18pt minimum)
- ✅ **Clean prompt** (`PS1='$ '` or similar - no clutter)
- ✅ **Terminal size:** 100 columns × 30 rows (fits in video players)
- ✅ **No notifications/popups** during recording

### Content

- ✅ **Show, don't tell** - Let commands speak for themselves
- ✅ **Pace yourself** - Pause after each command (1-2 seconds)
- ✅ **Real output** - Use actual Tract commands, not fake text
- ✅ **Comments** - Brief gray comments explaining what's happening
- ✅ **Ending** - Clear call-to-action (GitHub link)

### Audio (Optional)

If adding voiceover:
- Keep it concise (match the 90-second video)
- Emphasize speed and developer experience
- End with: "Stop clicking. Start coding. Try Tract."

---

## Publishing the Video

### GitHub README

```markdown
![Tract Demo](https://asciinema.org/a/xyz123.svg)

Or:

![Tract Demo](tract-demo.gif)
```

### YouTube / Twitter

- **Title:** "Tract: Project Management for Developers Who Hate Jira"
- **Description:** "Create tickets, log time, and manage projects from your terminal. Git-native, LLM-friendly, syncs with Jira."
- **Tags:** developer tools, productivity, git, jira alternative, terminal

### Hacker News / Reddit

Post with title: **"Show HN: Tract – Manage Jira tickets as markdown files in git"**

Include:
- Link to GitHub repo
- Link to demo video
- Brief explanation in comments

---

## Example Post Script

After recording, you can add:

**For GIF:**
- Slow down the GIF to 0.7x speed (more readable)
- Add a pause at the end (3 seconds on final screen)
- Optimize for file size (keep under 5MB for GitHub)

**For MP4:**
- Add background music (subtle, not distracting)
- Add captions/subtitles (accessibility!)
- Export at 720p (good balance of quality/size)

---

## Need Help?

**Your colleague who's good at videos can:**
1. Run `DEMO.sh` with asciinema to get a base recording
2. Edit the `.cast` file (it's JSON!) to adjust timing
3. Convert to their preferred format
4. Add polish in their video editor of choice

The script does all the hard work. They just need to:
- Record it once
- Maybe add a title card
- Export and upload

**Total time:** ~30 minutes for a polished 90-second demo.

---

## Alternative: I Can Script It Better

If your colleague wants more control, I can create:
- A frame-by-frame screenplay (what appears when)
- Separate title card assets (SVG/PNG)
- Custom timing script
- Multiple "takes" for different audiences (30s, 60s, 90s versions)

Just let me know what format works best for them!

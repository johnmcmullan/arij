# Video Frame Content Files

These files contain the exact terminal output for each frame of the demo video.

## How to Use

Your video editor can:

1. **Copy/paste directly** into a terminal simulator
2. **Use as reference** for what should appear on screen
3. **Time according to** VIDEO-CONTENT.md screenplay

## Files

- `frame-03-doctor.txt` - Health check output
- `frame-04-create.txt` - Create ticket command & output
- `frame-05-ticket.txt` - Markdown file contents
- `frame-06-commit.txt` - Git commit workflow
- `frame-07-log.txt` - Time logging
- `frame-08-timesheet.txt` - Timesheet view
- `frame-09-grep.txt` - Search with grep
- `frame-10-history.txt` - Git history
- `frame-12-llm.txt` - LLM conversation

## Rendering Options

### Option 1: Real Terminal Recording
Record actual commands in a real terminal (use `asciinema` or `ttyrec`)

### Option 2: Terminal Simulator
Use a tool like:
- https://github.com/itsay/term.js (browser-based)
- https://carbon.now.sh (code screenshot tool)
- Keynote/PowerPoint with monospace font

### Option 3: After Effects / Final Cut
Import text files and animate with typewriter effect

## Typography

**Font:** Menlo, Monaco, or JetBrains Mono  
**Size:** 18-20pt (readable in 1080p video)  
**Line height:** 1.4  
**Background:** Dark (#1e1e1e or similar)  
**Foreground:** Light gray (#d4d4d4)

## Color Codes (ANSI)

When rendering, use these colors:

- `✓` Green (#4ec9b0)
- `✗` Red (#f48771)
- `⚠` Yellow (#dcdcaa)
- `ℹ` Blue (#569cd6)
- `$` Cyan (#4fc1ff)
- Comments: Gray (#6a9955)

These match VS Code Dark+ theme colors.

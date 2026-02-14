# Tract Web UI

Beautiful, minimal web interface for Tract project management.

## Features

### Kanban Board
- Drag-and-drop tickets between columns
- Todo → In Progress → Done
- Visual ticket cards with assignee
- Real-time status updates

### Project Management
- Create and manage projects
- List all tickets by project
- Quick ticket creation

### Ticket View
- Full markdown rendering
- Edit tickets in browser
- View ticket history

## Running the UI

### Start Server

```bash
cd ~/work/tract
node app.js
```

Server starts on **http://localhost:3000**

### With Auto-Reload (Development)

```bash
npm install -g nodemon
nodemon app.js
```

### Production (Background)

```bash
cd ~/work/tract
nohup node app.js > tract-web.log 2>&1 &
```

Or use PM2:
```bash
npm install -g pm2
pm2 start app.js --name tract-web
pm2 save
```

## UI Structure

```
tract/
├── app.js                      # Express server
├── routes/
│   └── webhooks.js             # API routes
├── lib/
│   └── markdown-store.js       # Ticket storage
├── views/                      # EJS templates
│   ├── layout.ejs
│   ├── board/
│   │   └── index.ejs           # Kanban board
│   ├── projects/
│   │   ├── index.ejs           # Project list
│   │   ├── show.ejs            # Project detail
│   │   └── new.ejs             # Create project
│   └── tickets/
│       ├── show.ejs            # Ticket detail
│       └── new.ejs             # Create ticket
└── public/                     # Static assets
    ├── css/
    │   └── style.css           # Minimal, clean styles
    └── js/
        └── board.js            # Drag-and-drop logic
```

## Pages

### Homepage: `/`
Redirects to `/projects`

### Projects: `/projects`
List all Tract projects

### Board: `/board`
**Kanban board view** - drag tickets between columns:
- Todo
- In Progress  
- Done

Drag-and-drop updates ticket status automatically.

### Ticket Detail: `/tickets/:id`
View single ticket with:
- Full markdown content
- Metadata (assignee, status, priority)
- Edit button
- Breadcrumb navigation

### Create Ticket: `/projects/:project/tickets/new`
Form to create new ticket:
- Title
- Description (markdown)
- Type (bug, story, task)
- Priority
- Assignee

## API Routes

### Webhooks: `/api/webhooks/jira`
POST endpoint for Jira webhook integration.

## Customization

### Change Port

Edit `app.js`:
```javascript
const PORT = 3000; // Change to your port
```

### Styling

Edit `public/css/style.css`:
- Minimal CSS (no frameworks)
- Easy to customize
- Clean, professional look

### Add Status Columns

Edit `views/board/index.ejs` to add columns:
```html
<div class="board-column" data-status="review">
  <h3>Review</h3>
  <!-- ... -->
</div>
```

## Design Philosophy

**No framework nonsense:**
- Vanilla JavaScript (no jQuery, React, Vue)
- Clean CSS (no Bootstrap, Tailwind)
- EJS templates (simple, server-rendered)
- Fast and lightweight

**Focus on function:**
- Kanban board for visual workflow
- Markdown for ticket content
- Drag-and-drop for quick updates
- Minimal clicks to get work done

## Integration with Tract CLI

Web UI reads/writes the same markdown files as CLI:
- Tickets in `issues/*.md`
- CLI creates → UI shows
- UI updates → CLI sees changes
- Git is the sync layer

## Access Control

**Current:** No authentication (local use)

**For production:** Add middleware:
```javascript
// Simple token auth
app.use((req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (token === process.env.TRACT_TOKEN) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
});
```

Or use reverse proxy (nginx) with auth.

## Screenshots

### Kanban Board
```
┌────────────────┬────────────────┬────────────────┐
│ Todo (12)      │ In Progress (5)│ Done (23)      │
├────────────────┼────────────────┼────────────────┤
│ ┌────────────┐ │ ┌────────────┐ │ ┌────────────┐ │
│ │ APP-123    │ │ │ APP-125    │ │ │ APP-120    │ │
│ │ Fix login  │ │ │ New API    │ │ │ Setup CI   │ │
│ │ @john      │ │ │ @sarah     │ │ │ @mike      │ │
│ └────────────┘ │ └────────────┘ │ └────────────┘ │
│                │                │                │
│ ┌────────────┐ │ ┌────────────┐ │ ┌────────────┐ │
│ │ APP-124    │ │ │ APP-126    │ │ │ APP-121    │ │
│ │ Add tests  │ │ │ Refactor   │ │ │ Deploy     │ │
│ │ @dave      │ │ │ @john      │ │ │ @sarah     │ │
│ └────────────┘ │ └────────────┘ │ └────────────┘ │
│                │                │                │
│ [Drag cards between columns to update status]   │
└──────────────────────────────────────────────────┘
```

## Deployment

### Local Development
```bash
node app.js
# Visit: http://localhost:3000
```

### VPS/Server
```bash
# Install PM2
npm install -g pm2

# Start
pm2 start app.js --name tract-web

# Setup startup script
pm2 startup
pm2 save

# View logs
pm2 logs tract-web
```

### Docker (Future)
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "app.js"]
```

## Mobile Support

UI is responsive:
- Works on mobile browsers
- Touch-friendly drag-and-drop
- Readable on small screens

## Future Enhancements

- [ ] Ticket filtering/search
- [ ] Time tracking view
- [ ] Burndown charts
- [ ] Multi-user presence
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Bulk ticket operations

## Design Goals

| Goal | Tract Approach |
|------|----------------|
| **Speed** | Fast, minimal |
| **Complexity** | Simple, focused |
| **Dependencies** | Few |
| **Cost** | Open source |
| **Hosting** | Self-hosted |
| **Data** | Git + Markdown |
| **Offline** | Yes (with git) |
| **LLM-native** | Yes |

---

**Remember:** The web UI is optional. Tract works perfectly from CLI alone. The UI is for visual thinkers who like Kanban boards.

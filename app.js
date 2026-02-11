const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const marked = require('marked');
const store = require('./lib/markdown-store');

const app = express();
const PORT = 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));

// Make markdown available in templates
app.locals.marked = marked;

// Helper function for ticket full ID
function getTicketFullId(project_key, number) {
  return `${project_key}-${String(number).padStart(3, '0')}`;
}
app.locals.getTicketFullId = getTicketFullId;

// Routes

// Home - redirect to projects
app.get('/', (req, res) => {
  res.redirect('/projects');
});

// Projects list
app.get('/projects', async (req, res) => {
  try {
    const projects = await store.getAllProjects();
    res.render('projects/index', { projects });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading projects');
  }
});

// New project form
app.get('/projects/new', (req, res) => {
  res.render('projects/new');
});

// Create project
app.post('/projects', async (req, res) => {
  try {
    const { name, key, description } = req.body;
    const project = await store.createProject({ name, key, description });
    res.redirect(`/projects/${project.key}`);
  } catch (err) {
    console.error(err);
    res.status(400).send('Error creating project (key might already exist)');
  }
});

// Project detail
app.get('/projects/:key', async (req, res) => {
  try {
    const projectKey = req.params.key;
    const project = await store.getProjectByKey(projectKey);
    
    if (!project) {
      return res.status(404).send('Project not found');
    }
    
    const tickets = await store.getTicketsByProject(projectKey);
    
    // Add an id field for compatibility with views
    project.id = projectKey;
    
    res.render('projects/show', { project, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading project');
  }
});

// Board view
app.get('/board', async (req, res) => {
  try {
    const allTickets = await store.getAllTickets();
    
    const tickets = {
      todo: allTickets.filter(t => t.status === 'todo'),
      in_progress: allTickets.filter(t => t.status === 'in_progress'),
      done: allTickets.filter(t => t.status === 'done')
    };
    
    res.render('board/index', { tickets });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading board');
  }
});

// New ticket form
app.get('/projects/:projectKey/tickets/new', async (req, res) => {
  try {
    const projectKey = req.params.projectKey;
    const project = await store.getProjectByKey(projectKey);
    
    if (!project) {
      return res.status(404).send('Project not found');
    }
    
    // Add id for compatibility
    project.id = projectKey;
    
    res.render('tickets/new', { project });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading form');
  }
});

// Create ticket
app.post('/projects/:projectKey/tickets', async (req, res) => {
  try {
    const projectKey = req.params.projectKey;
    const { title, description, status, assignee, type, priority, component, labels } = req.body;
    
    const ticketData = {
      title,
      description,
      status,
      assignee,
      type,
      priority,
      component,
      labels: labels ? (Array.isArray(labels) ? labels : [labels]) : []
    };
    
    const ticket = await store.createTicket(projectKey, ticketData);
    res.redirect(`/tickets/${ticket.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating ticket');
  }
});

// Ticket detail
app.get('/tickets/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = await store.getTicketById(ticketId);
    
    if (!ticket) {
      return res.status(404).send('Ticket not found');
    }
    
    // Get project info
    const project = await store.getProjectByKey(ticket.project_key);
    
    // Add fields for compatibility with views
    ticket.project_name = project ? project.name : ticket.project_key;
    ticket.project_id = ticket.project_key;
    
    const comments = ticket.comments || [];
    
    res.render('tickets/show', { ticket, comments });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading ticket');
  }
});

// Update ticket status (for drag-and-drop)
app.patch('/tickets/:id/status', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;
    
    await store.updateTicket(ticketId, { status });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating ticket' });
  }
});

// Add comment
app.post('/tickets/:ticketId/comments', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const { body, author } = req.body;
    
    await store.addComment(ticketId, { body, author });
    res.redirect(`/tickets/${ticketId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding comment');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Tract running on http://localhost:${PORT}`);
  console.log('Markdown + Git backend — no database required');
});

module.exports = { app };

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const app = express();
const PORT = 3000;

// Database setup
const db = new sqlite3.Database('./db/jira.db', (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  const schema = fs.readFileSync('./db/schema.sql', 'utf8');
  db.exec(schema, (err) => {
    if (err) {
      console.error('Error initializing database:', err);
    } else {
      console.log('Database schema initialized');
    }
  });
}

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
  return `${project_key}-${number}`;
}
app.locals.getTicketFullId = getTicketFullId;

// Routes

// Home - redirect to projects
app.get('/', (req, res) => {
  res.redirect('/projects');
});

// Projects list
app.get('/projects', (req, res) => {
  db.all('SELECT * FROM projects WHERE archived = 0 ORDER BY created_at DESC', (err, projects) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('projects/index', { projects });
  });
});

// New project form
app.get('/projects/new', (req, res) => {
  res.render('projects/new');
});

// Create project
app.post('/projects', (req, res) => {
  const { name, key, description } = req.body;
  
  db.run(
    'INSERT INTO projects (name, key, description) VALUES (?, ?, ?)',
    [name, key.toUpperCase(), description],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(400).send('Error creating project (key might already exist)');
      }
      res.redirect(`/projects/${this.lastID}`);
    }
  );
});

// Project detail
app.get('/projects/:id', (req, res) => {
  const projectId = req.params.id;
  
  db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err || !project) {
      return res.status(404).send('Project not found');
    }
    
    db.all(
      'SELECT * FROM tickets WHERE project_id = ? ORDER BY number DESC',
      [projectId],
      (err, tickets) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }
        res.render('projects/show', { project, tickets });
      }
    );
  });
});

// Board view
app.get('/board', (req, res) => {
  const query = `
    SELECT tickets.*, projects.key as project_key, projects.name as project_name
    FROM tickets
    JOIN projects ON tickets.project_id = projects.id
    WHERE projects.archived = 0
    ORDER BY tickets.created_at DESC
  `;
  
  db.all(query, (err, allTickets) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    
    const tickets = {
      todo: allTickets.filter(t => t.status === 'todo'),
      in_progress: allTickets.filter(t => t.status === 'in_progress'),
      done: allTickets.filter(t => t.status === 'done')
    };
    
    res.render('board/index', { tickets });
  });
});

// New ticket form
app.get('/projects/:projectId/tickets/new', (req, res) => {
  const projectId = req.params.projectId;
  
  db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err || !project) {
      return res.status(404).send('Project not found');
    }
    res.render('tickets/new', { project });
  });
});

// Create ticket
app.post('/projects/:projectId/tickets', (req, res) => {
  const projectId = req.params.projectId;
  const { title, description, status, assignee } = req.body;
  
  // Get next ticket number for this project
  db.get(
    'SELECT MAX(number) as max_number FROM tickets WHERE project_id = ?',
    [projectId],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      
      const nextNumber = (row.max_number || 0) + 1;
      
      db.run(
        'INSERT INTO tickets (project_id, number, title, description, status, assignee) VALUES (?, ?, ?, ?, ?, ?)',
        [projectId, nextNumber, title, description, status || 'todo', assignee],
        function(err) {
          if (err) {
            console.error(err);
            return res.status(500).send('Error creating ticket');
          }
          res.redirect(`/tickets/${this.lastID}`);
        }
      );
    }
  );
});

// Ticket detail
app.get('/tickets/:id', (req, res) => {
  const ticketId = req.params.id;
  
  db.get(
    `SELECT tickets.*, projects.key as project_key, projects.name as project_name, projects.id as project_id
     FROM tickets
     JOIN projects ON tickets.project_id = projects.id
     WHERE tickets.id = ?`,
    [ticketId],
    (err, ticket) => {
      if (err || !ticket) {
        return res.status(404).send('Ticket not found');
      }
      
      db.all(
        'SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC',
        [ticketId],
        (err, comments) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Database error');
          }
          res.render('tickets/show', { ticket, comments });
        }
      );
    }
  );
});

// Update ticket status (for drag-and-drop)
app.patch('/tickets/:id/status', (req, res) => {
  const ticketId = req.params.id;
  const { status } = req.body;
  
  db.run(
    'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, ticketId],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error updating ticket' });
      }
      res.json({ success: true });
    }
  );
});

// Add comment
app.post('/tickets/:ticketId/comments', (req, res) => {
  const ticketId = req.params.ticketId;
  const { body, author } = req.body;
  
  db.run(
    'INSERT INTO comments (ticket_id, body, author) VALUES (?, ?, ?)',
    [ticketId, body, author || 'Anonymous'],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Error adding comment');
      }
      res.redirect(`/tickets/${ticketId}`);
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Jira Killer running on http://localhost:${PORT}`);
  console.log('Navigate to http://localhost:3000 to get started');
});

// Export db for potential use in other modules
module.exports = { app, db };

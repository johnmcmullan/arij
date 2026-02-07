// Seed the database with sample data

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/jira.db');

console.log('Seeding database with sample data...');

// Create sample projects
const projects = [
  { name: 'Jira Killer', key: 'JIRA', description: 'Build a Jira alternative to prove software is commoditizable' },
  { name: 'Website Redesign', key: 'WEB', description: 'Redesign the company website' },
  { name: 'API Integration', key: 'API', description: 'Integrate with external APIs' }
];

const tickets = [
  // JIRA project tickets
  { project_key: 'JIRA', title: 'Set up Express.js server', description: 'Initialize the project with Express and SQLite', status: 'done' },
  { project_key: 'JIRA', title: 'Create database schema', description: 'Design tables for projects, tickets, and comments', status: 'done' },
  { project_key: 'JIRA', title: 'Build project CRUD', description: 'Implement create, read, update, delete for projects', status: 'done' },
  { project_key: 'JIRA', title: 'Build ticket CRUD', description: 'Implement ticket management with auto-generated IDs (PROJ-123)', status: 'done' },
  { project_key: 'JIRA', title: 'Implement Kanban board', description: 'Create a board view with todo/in progress/done columns', status: 'in_progress', assignee: 'Wylie' },
  { project_key: 'JIRA', title: 'Add drag-and-drop', description: 'Enable dragging tickets between status columns', status: 'in_progress', assignee: 'Wylie' },
  { project_key: 'JIRA', title: 'Add comments feature', description: 'Allow users to comment on tickets with markdown support', status: 'todo', assignee: 'Wylie' },
  { project_key: 'JIRA', title: 'Write documentation', description: 'Create README with screenshots and deployment guide', status: 'todo' },
  { project_key: 'JIRA', title: 'Deploy to production', description: 'Deploy on Fly.io or similar platform', status: 'todo' },
  
  // WEB project tickets
  { project_key: 'WEB', title: 'Design mockups', description: 'Create Figma mockups for the new design', status: 'in_progress', assignee: 'Designer' },
  { project_key: 'WEB', title: 'Set up new repo', description: 'Initialize Git repository for the redesign', status: 'done', assignee: 'Dev' },
  { project_key: 'WEB', title: 'Implement homepage', description: 'Build out the new homepage design', status: 'todo' },
  
  // API project tickets
  { project_key: 'API', title: 'Research API options', description: 'Compare different payment gateways', status: 'todo', assignee: 'Backend' },
  { project_key: 'API', title: 'Set up auth flow', description: 'Implement OAuth2 authentication', status: 'todo' }
];

// Insert projects
db.serialize(() => {
  const projectStmt = db.prepare('INSERT INTO projects (name, key, description) VALUES (?, ?, ?)');
  
  projects.forEach(project => {
    projectStmt.run(project.name, project.key, project.description, function(err) {
      if (err) {
        console.error(`Error inserting project ${project.key}:`, err.message);
      } else {
        console.log(`Created project: ${project.name} (${project.key})`);
      }
    });
  });
  
  projectStmt.finalize(() => {
    // After projects are inserted, insert tickets
    const ticketCounts = {};
    
    tickets.forEach(ticket => {
      db.get('SELECT id, key FROM projects WHERE key = ?', [ticket.project_key], (err, project) => {
        if (err || !project) {
          console.error(`Project ${ticket.project_key} not found`);
          return;
        }
        
        // Track ticket numbers per project
        if (!ticketCounts[ticket.project_key]) {
          ticketCounts[ticket.project_key] = 0;
        }
        ticketCounts[ticket.project_key]++;
        
        const ticketNumber = ticketCounts[ticket.project_key];
        
        db.run(
          'INSERT INTO tickets (project_id, number, title, description, status, assignee) VALUES (?, ?, ?, ?, ?, ?)',
          [project.id, ticketNumber, ticket.title, ticket.description, ticket.status, ticket.assignee || null],
          function(err) {
            if (err) {
              console.error(`Error inserting ticket ${ticket.title}:`, err.message);
            } else {
              console.log(`Created ticket: ${project.key}-${ticketNumber} - ${ticket.title}`);
            }
          }
        );
      });
    });
    
    setTimeout(() => {
      console.log('\n✅ Database seeded successfully!');
      console.log('Run "npm start" and visit http://localhost:3000');
      db.close();
    }, 1000);
  });
});

const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const simpleGit = require('simple-git');

const TICKETS_DIR = path.join(__dirname, '../tickets');
const PROJECTS_DIR = path.join(__dirname, '../projects');

const git = simpleGit();

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(TICKETS_DIR, { recursive: true });
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

// Helper to parse markdown files
function parseTicketFile(filename, content) {
  const parsed = matter(content);
  const data = parsed.data;
  
  // Extract comments from markdown body if they exist
  const comments = [];
  const bodyParts = parsed.content.split('\n## Comments\n');
  const description = bodyParts[0].trim();
  
  if (bodyParts[1]) {
    const commentBlocks = bodyParts[1].split('\n\n---\n\n');
    commentBlocks.forEach(block => {
      const match = block.match(/\*\*(.+?)\*\* \((.+?)\):\n\n([\s\S]+)/);
      if (match) {
        comments.push({
          author: match[1],
          created_at: match[2],
          body: match[3].trim()
        });
      }
    });
  }
  
  return {
    ...data,
    description,
    comments,
    filename
  };
}

// Helper to serialize ticket to markdown
function serializeTicket(data, description, comments = []) {
  const frontmatter = { ...data };
  delete frontmatter.description;
  delete frontmatter.comments;
  delete frontmatter.filename;
  delete frontmatter.project_key;
  delete frontmatter.project_name;
  delete frontmatter.number;
  
  let content = description || '';
  
  if (comments && comments.length > 0) {
    content += '\n\n## Comments\n\n';
    content += comments.map(c => 
      `**${c.author || 'Anonymous'}** (${c.created_at || new Date().toISOString()}):\n\n${c.body}`
    ).join('\n\n---\n\n');
  }
  
  return matter.stringify(content, frontmatter);
}

// PROJECTS
async function getAllProjects() {
  await ensureDirectories();
  
  try {
    const files = await fs.readdir(PROJECTS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const projects = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(PROJECTS_DIR, file), 'utf8');
        const parsed = matter(content);
        const key = file.replace('.md', '');
        return {
          ...parsed.data,
          id: key,  // For compatibility with views
          key,
          description: parsed.content.trim()
        };
      })
    );
    
    return projects.filter(p => !p.archived);
  } catch (err) {
    return [];
  }
}

async function getProjectByKey(key) {
  const projects = await getAllProjects();
  return projects.find(p => p.key === key);
}

async function createProject(data) {
  await ensureDirectories();
  
  const { name, key, description } = data;
  const filename = path.join(PROJECTS_DIR, `${key.toUpperCase()}.md`);
  
  // Check if exists
  try {
    await fs.access(filename);
    throw new Error('Project key already exists');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  
  const frontmatter = {
    name,
    created: new Date().toISOString().split('T')[0],
    archived: false
  };
  
  const content = matter.stringify(description || '', frontmatter);
  await fs.writeFile(filename, content, 'utf8');
  
  return { key: key.toUpperCase(), name, description };
}

// TICKETS
async function getAllTickets() {
  await ensureDirectories();
  
  try {
    const files = await fs.readdir(TICKETS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md') && f !== '.gitkeep');
    
    const tickets = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(TICKETS_DIR, file), 'utf8');
        const ticket = parseTicketFile(file, content);
        
        // Parse project key and number from ID (e.g., "JK-001")
        const idMatch = ticket.id.match(/^([A-Z]+)-(\d+)$/);
        if (idMatch) {
          ticket.project_key = idMatch[1];
          ticket.number = parseInt(idMatch[2], 10);
        }
        
        return ticket;
      })
    );
    
    return tickets;
  } catch (err) {
    return [];
  }
}

async function getTicketsByProject(projectKey) {
  const allTickets = await getAllTickets();
  return allTickets.filter(t => t.project_key === projectKey);
}

async function getTicketById(ticketId) {
  const tickets = await getAllTickets();
  return tickets.find(t => t.id === ticketId);
}

async function getNextTicketNumber(projectKey) {
  const tickets = await getTicketsByProject(projectKey);
  if (tickets.length === 0) return 1;
  
  const maxNumber = Math.max(...tickets.map(t => t.number || 0));
  return maxNumber + 1;
}

async function createTicket(projectKey, data) {
  await ensureDirectories();
  
  const number = await getNextTicketNumber(projectKey);
  const id = `${projectKey}-${String(number).padStart(3, '0')}`;
  const filename = path.join(TICKETS_DIR, `${id}.md`);
  
  const frontmatter = {
    id,
    title: data.title,
    status: data.status || 'todo',
    type: data.type || 'task',
    created: new Date().toISOString().split('T')[0],
    priority: data.priority || 'medium',
    assignee: data.assignee || null,
    component: data.component || null,
    labels: data.labels || []
  };
  
  const content = serializeTicket(frontmatter, data.description || '', []);
  await fs.writeFile(filename, content, 'utf8');
  
  return { ...frontmatter, description: data.description, project_key: projectKey, number };
}

async function updateTicket(ticketId, updates) {
  const filename = path.join(TICKETS_DIR, `${ticketId}.md`);
  
  try {
    const content = await fs.readFile(filename, 'utf8');
    const ticket = parseTicketFile(ticketId + '.md', content);
    
    // Update fields
    const updatedData = { ...ticket, ...updates };
    delete updatedData.comments; // Handle separately
    
    const updatedContent = serializeTicket(
      updatedData,
      updates.description !== undefined ? updates.description : ticket.description,
      ticket.comments
    );
    
    await fs.writeFile(filename, updatedContent, 'utf8');
    
    return { ...updatedData, id: ticketId };
  } catch (err) {
    throw new Error('Ticket not found');
  }
}

async function deleteTicket(ticketId) {
  const filename = path.join(TICKETS_DIR, `${ticketId}.md`);
  await fs.unlink(filename);
}

// COMMENTS
async function addComment(ticketId, commentData) {
  const filename = path.join(TICKETS_DIR, `${ticketId}.md`);
  
  try {
    const content = await fs.readFile(filename, 'utf8');
    const ticket = parseTicketFile(ticketId + '.md', content);
    
    const newComment = {
      author: commentData.author || 'Anonymous',
      created_at: new Date().toISOString(),
      body: commentData.body
    };
    
    const comments = [...(ticket.comments || []), newComment];
    
    const updatedContent = serializeTicket(ticket, ticket.description, comments);
    await fs.writeFile(filename, updatedContent, 'utf8');
    
    return newComment;
  } catch (err) {
    throw new Error('Ticket not found');
  }
}

async function getCommentsByTicket(ticketId) {
  const ticket = await getTicketById(ticketId);
  return ticket ? ticket.comments || [] : [];
}

module.exports = {
  // Projects
  getAllProjects,
  getProjectByKey,
  createProject,
  
  // Tickets
  getAllTickets,
  getTicketsByProject,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  
  // Comments
  addComment,
  getCommentsByTicket,
  
  // Git (for manual commits)
  git
};

// Initialize the database schema

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Ensure db directory exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database('./db/jira.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Read and execute schema
const schema = fs.readFileSync('./db/schema.sql', 'utf8');

db.exec(schema, (err) => {
  if (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
  console.log('✅ Database schema initialized successfully!');
  db.close();
});

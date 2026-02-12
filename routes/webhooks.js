const express = require('express');
const crypto = require('crypto');
const store = require('../lib/markdown-store');

const router = express.Router();

// Configuration
const WEBHOOK_SECRET = process.env.TRACT_WEBHOOK_SECRET || 'change-me-in-production';
const TICKET_ID_REGEX = /\b([A-Z]{2,10}-\d+)\b/g;

/**
 * Verify webhook signature
 * Expects X-Git-Secret header to match configured secret
 */
function verifyWebhookSignature(req, res, next) {
  const receivedSecret = req.headers['x-git-secret'];
  
  if (!receivedSecret) {
    return res.status(401).json({ error: 'Missing X-Git-Secret header' });
  }
  
  if (receivedSecret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Invalid webhook secret' });
  }
  
  next();
}

/**
 * Extract ticket IDs from commit message
 * Matches patterns like TB-12345, APP-76489, etc.
 */
function extractTicketIds(message) {
  const matches = message.match(TICKET_ID_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Format commit data for display in ticket comments
 */
function formatCommitComment(commit, repo, branch) {
  const shortSha = commit.id.substring(0, 7);
  const branchName = branch.replace('refs/heads/', '');
  
  return `**Git Commit** (${new Date().toISOString()}):

\`${shortSha}\` on \`${repo}/${branchName}\`

**${commit.author}**: ${commit.message}`;
}

/**
 * POST /api/webhooks/git
 * 
 * Receives git post-receive hook payload:
 * {
 *   "repo": "myproject",
 *   "ref": "refs/heads/main",
 *   "before": "abc123...",
 *   "after": "def456...",
 *   "commits": [
 *     {
 *       "id": "def456...",
 *       "message": "TB-001: Fix login bug",
 *       "author": "John Doe",
 *       "timestamp": "2026-02-12T08:00:00Z"
 *     }
 *   ]
 * }
 */
router.post('/git', verifyWebhookSignature, async (req, res) => {
  try {
    const { repo, ref, commits } = req.body;
    
    if (!repo || !ref || !commits || !Array.isArray(commits)) {
      return res.status(400).json({ 
        error: 'Invalid payload',
        expected: { repo: 'string', ref: 'string', commits: 'array' }
      });
    }
    
    const branch = ref.replace('refs/heads/', '');
    const results = {
      processed: 0,
      linked: 0,
      tickets: []
    };
    
    // Process each commit
    for (const commit of commits) {
      const ticketIds = extractTicketIds(commit.message);
      results.processed++;
      
      if (ticketIds.length === 0) {
        continue; // Skip commits without ticket references
      }
      
      // Link commit to all mentioned tickets
      for (const ticketId of ticketIds) {
        try {
          const ticket = await store.getTicketById(ticketId);
          
          if (!ticket) {
            console.warn(`Ticket ${ticketId} not found (mentioned in ${commit.id})`);
            continue;
          }
          
          // Add commit as a comment
          const commentBody = formatCommitComment(commit, repo, branch);
          await store.addComment(ticketId, {
            author: 'Git',
            body: commentBody
          });
          
          results.linked++;
          results.tickets.push(ticketId);
          
          console.log(`Linked commit ${commit.id.substring(0, 7)} to ticket ${ticketId}`);
          
        } catch (err) {
          console.error(`Error linking commit to ${ticketId}:`, err);
        }
      }
    }
    
    // Log summary
    console.log(`Git webhook: ${results.processed} commits processed, ${results.linked} ticket links created`);
    
    res.json({
      success: true,
      ...results
    });
    
  } catch (err) {
    console.error('Git webhook error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  }
});

/**
 * GET /api/webhooks/test
 * Test endpoint to verify webhooks are working
 */
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tract',
    webhook_version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

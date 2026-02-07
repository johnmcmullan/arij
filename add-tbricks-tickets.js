const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/jira.db');

// First, create or get the APP project
db.get(`SELECT id FROM projects WHERE key = 'APP'`, (err, row) => {
  let projectId;
  
  if (row) {
    projectId = row.id;
    console.log(`Using existing project APP (ID ${projectId})`);
    createTickets(projectId);
  } else {
    db.run(
      `INSERT INTO projects (name, key, description, archived, created_at, updated_at) 
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['Tbricks App Development', 'APP', 'Custom applications for Tbricks trading platform - volatility managers, FIX connectivity, portfolio tools', 0],
      function(err) {
        if (err) {
          console.error('Error creating project:', err);
          db.close();
          return;
        }
        projectId = this.lastID;
        console.log(`Created project APP with ID ${projectId}`);
        createTickets(projectId);
      }
    );
  }
});

function createTickets(projectId) {
  const tickets = [
    // Volatility Manager tickets
    {title: 'Implement Black-Scholes pricing engine', description: 'Build C++ module for real-time Black-Scholes option pricing. Needs to handle Greeks calculation (delta, gamma, vega, theta, rho) with <1ms latency for volatility surface updates.', status: 'in_progress', assignee: 'Sarah Chen'},
    {title: 'Volatility surface interpolation optimization', description: 'Current cubic spline interpolation causing 15ms lag on vol surface updates. Investigate faster methods (linear, Hermite). Target: <5ms for 1000-point surface.', status: 'todo', assignee: 'Marcus Webb'},
    {title: 'Real-time implied vol calculator from market data', description: 'Parse incoming option quotes, extract implied volatility using Newton-Raphson. Cache results per strike/expiry. Integration with market data feed required.', status: 'done', assignee: 'Sarah Chen'},
    {title: 'SABR model implementation for vol smile', description: 'Implement SABR (Stochastic Alpha Beta Rho) volatility model for capturing smile dynamics. Calibrate alpha, beta, rho, nu parameters from market data. Validate against Bloomberg VCUB.', status: 'todo', assignee: 'Priya Sharma'},
    {title: 'Vol surface visualization widget', description: 'Build Tbricks GUI widget to display 3D volatility surface. Color-coded by moneyness, interactive rotation. Update frequency: 1Hz from live market data.', status: 'in_progress', assignee: 'Marcus Webb'},
    
    // FIX Connectivity tickets
    {title: 'FIX 4.4 order entry gateway', description: 'Implement FIX engine for order submission to external venues. Support NewOrderSingle (35=D), OrderCancelRequest (35=F), OrderCancelReplaceRequest (35=G). QuickFIX C++ library integration.', status: 'done', assignee: 'David Kumar'},
    {title: 'FIX session heartbeat monitoring', description: 'Add heartbeat (35=0) monitoring for all FIX sessions. Auto-reconnect on 30s timeout. Log all session state changes to audit trail. Alert on repeated disconnects.', status: 'in_progress', assignee: 'Elena Volkov'},
    {title: 'Custom FIX tag mapping for Bloomberg EMSX', description: 'Bloomberg EMSX uses custom FIX tags (10000+). Build mapper to translate Tbricks internal order model to EMSX-specific tags. Handle baskets, multi-leg orders.', status: 'todo', assignee: 'David Kumar'},
    {title: 'FIX drop-copy feed parser', description: 'Parse execution reports from FIX drop-copy feed (venue-side). Extract fills, update position tracker in real-time. Handle partial fills, busts, corrections.', status: 'done', assignee: 'Elena Volkov'},
    {title: 'FIX message validation framework', description: 'Build pre-send validation for all outbound FIX messages. Check required tags, data types, value ranges per venue spec. Prevent reject rate >0.1%.', status: 'todo', assignee: 'James Liu'},
    {title: 'Multi-venue FIX routing logic', description: 'Smart order router: choose best venue based on liquidity, latency, fees. FIX session pool management. Failover to secondary venue on disconnect.', status: 'in_progress', assignee: 'David Kumar'},
    
    // Portfolio Management tickets  
    {title: 'Real-time P&L aggregation engine', description: 'Calculate portfolio P&L across all positions. Mark-to-market updates on every tick. Support Greeks aggregation for options book. 10ms max latency requirement.', status: 'done', assignee: 'Sophia Martinez'},
    {title: 'Risk limit monitoring system', description: 'Track position limits, notional limits, sector exposure in real-time. Hard blocks on breach, soft warnings at 80%. Integration with compliance dashboard.', status: 'in_progress', assignee: 'Sophia Martinez'},
    {title: 'Portfolio rebalancing optimizer', description: 'Given target weights and current positions, calculate optimal trades to rebalance. Minimize transaction costs, market impact. Quadratic programming solver (CVXOPT).', status: 'todo', assignee: 'Priya Sharma'},
    {title: 'Historical attribution analysis tool', description: 'Break down portfolio returns by sector, factor exposures, alpha/beta. Daily batch job, output to CSV. Integration with risk models (Barra, Axioma).', status: 'todo', assignee: 'Marcus Webb'},
    {title: 'Position reconciliation checker', description: 'Compare Tbricks positions vs. exchange/broker positions. Flag discrepancies >10 shares. Auto-reconcile on T+1. Email report to ops team.', status: 'done', assignee: 'James Liu'},
    
    // General Tbricks App Dev tickets
    {title: 'Tbricks SDK upgrade to v8.5', description: 'Current apps on SDK v7.2. Upgrade to v8.5 for new strategy API, improved performance. Breaking changes in market data callbacks - need refactor.', status: 'in_progress', assignee: 'Elena Volkov'},
    {title: 'Strategy backtesting framework', description: 'Build harness to replay historical market data through strategies. Calculate Sharpe, max drawdown, win rate. Output HTML report with equity curve.', status: 'todo', assignee: 'Sarah Chen'},
    {title: 'Custom instrument definition loader', description: 'Load exotic derivatives (swaptions, variance swaps) into Tbricks instrument database. Parse XML spec, generate C++ classes. Support user-defined payoff functions.', status: 'done', assignee: 'Priya Sharma'},
    {title: 'Market data feed latency monitor', description: 'Measure tick-to-strategy latency for all subscribed instruments. Publish metrics to Grafana. Alert if p99 latency >5ms (indicates feed issue).', status: 'in_progress', assignee: 'James Liu'},
    {title: 'Order book reconstruction from L2 data', description: 'Build full order book from incremental L2 updates. Handle add/modify/delete. Validate book integrity on snapshot. Used for VWAP/TWAP calculations.', status: 'done', assignee: 'David Kumar'},
    {title: 'Strategy parameter tuning UI', description: 'Web interface for strategy params (alpha decay, position limits, etc). Real-time param updates without restart. Audit log of all changes.', status: 'todo', assignee: 'Marcus Webb'},
    {title: 'Cross-asset portfolio Greeks calculator', description: 'Aggregate delta, gamma, vega across equities, options, futures. Handle different underliers, currencies. Display risk ladder by expiry, strike.', status: 'in_progress', assignee: 'Sophia Martinez'},
    {title: 'Automated regression test suite', description: 'Test all apps against simulated market scenarios. Verify order logic, risk checks, P&L calculation. Run on every commit (CI/CD integration).', status: 'todo', assignee: 'Elena Volkov'},
    {title: 'Performance profiling of strategy hot paths', description: 'Use perf/valgrind to identify bottlenecks in high-frequency strategies. Target: reduce CPU usage 20%, improve cache hit rate. Focus on order book update callbacks.', status: 'done', assignee: 'James Liu'},
  ];
  
  // Delete existing APP tickets first
  db.run(`DELETE FROM tickets WHERE project_id = ?`, [projectId], (err) => {
    if (err) console.error('Error clearing old tickets:', err);
    
    let completed = 0;
    tickets.forEach((ticket, idx) => {
      const ticketNumber = idx + 1;
      db.run(
        `INSERT INTO tickets (project_id, number, title, description, status, assignee, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [projectId, ticketNumber, ticket.title, ticket.description, ticket.status, ticket.assignee],
        (err) => {
          if (err) {
            console.error(`Error creating ticket ${ticketNumber}:`, err);
          } else {
            console.log(`✓ APP-${ticketNumber}: ${ticket.title.substring(0, 50)}...`);
          }
          completed++;
          if (completed === tickets.length) {
            db.close();
            console.log(`\n✅ Created ${tickets.length} Tbricks tickets in project APP`);
            console.log(`\nView them at: https://yet-arrested-whatever-paxil.trycloudflare.com/board`);
          }
        }
      );
    });
  });
}

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const DEMO_DIR     = path.join(os.homedir(), '.tract', 'demo');
const DEFAULT_PORT = 7766;

// ── Ticket content ─────────────────────────────────────────────────────────

const NOVA_TICKETS = [
  {
    id: 'NOVA-1', title: 'Epic: User Authentication System',
    type: 'epic', status: 'in-progress', priority: 'critical',
    assignee: 'alice.chen', labels: ['security', 'auth'],
    sprints: ['sprint-1'],
    created: '2026-01-20T09:00:00Z',
    body: `Umbrella epic for all user authentication work.\n\n## Scope\n- OAuth2 / SSO login\n- Session management\n- Password reset flow\n- Mobile Safari compatibility\n\n## Comments\n\n### alice.chen — 2026-01-20 10:15\nScope confirmed with product. Mobile Safari is in scope after QA flagged it during last sprint demo.\n\n### carol.smith — 2026-02-03 09:00\nCI pipeline is ready — any auth PRs will get full e2e coverage automatically.`
  },
  {
    id: 'NOVA-2', title: 'Implement OAuth2 login with Google and GitHub',
    type: 'story', status: 'in-progress', priority: 'critical',
    assignee: 'alice.chen', labels: ['auth', 'oauth'],
    sprints: ['sprint-1'], estimate: '5d',
    created: '2026-02-03T10:30:00Z',
    body: `Users should be able to sign in with their Google or GitHub account.\n\n## Acceptance Criteria\n- [ ] Google OAuth2 flow working in staging\n- [ ] GitHub OAuth2 flow working in staging\n- [x] Tokens stored securely (httpOnly cookie)\n- [ ] Session expires after 8h idle\n\n## Comments\n\n### alice.chen — 2026-02-11 14:00\nGoogle flow is working end-to-end in staging. Starting on GitHub next. Token storage is done — using httpOnly + SameSite=Strict.\n\n### bob.patel — 2026-02-12 09:30\nReviewed the token storage approach. Looks solid. One question — are we handling token refresh on expiry or just forcing re-login?\n\n### alice.chen — 2026-02-12 11:00\nForcing re-login for now. Token refresh is a nice-to-have but not in scope for this sprint.`
  },
  {
    id: 'NOVA-3', title: 'Login form fails on mobile Safari — submit button unresponsive',
    type: 'bug', status: 'todo', priority: 'major',
    assignee: 'bob.patel', labels: ['bug', 'mobile'],
    sprints: ['sprint-1'],
    created: '2026-02-10T14:15:00Z',
    body: `**Reported by:** QA team\n**Affects:** Safari 17 on iOS 17+\n\n## Steps to Reproduce\n1. Open https://nova.app/login on iPhone\n2. Enter credentials\n3. Tap "Sign in"\n4. Nothing happens\n\n## Root Cause (suspected)\nEvent listener not firing on iOS — likely a passive touch event conflict.\n\n## Comments\n\n### bob.patel — 2026-02-10 15:30\nReproduced on my iPhone 14. Also fails on iPad with Safari 17. Chrome on iOS works fine — confirms it's a WebKit issue, not iOS generally.\n\n### alice.chen — 2026-02-11 10:00\nThis is almost certainly the same passive event listener issue we saw on the old checkout form. Fix should be straightforward — switch to { passive: false } or use a click handler instead of touchstart.`
  },
  {
    id: 'NOVA-4', title: 'User profile page — display and edit account details',
    type: 'story', status: 'review', priority: 'major',
    assignee: 'alice.chen', labels: ['profile', 'ui'],
    sprints: ['sprint-1'], estimate: '3d',
    created: '2026-02-05T11:00:00Z',
    body: `Users need a profile page to view and update their account information.\n\n## Fields\n- Display name\n- Email (read-only)\n- Avatar (upload)\n- Timezone preference\n- Notification settings\n\n## Comments\n\n### alice.chen — 2026-02-13 17:00\nPR up for review: #247. Avatar upload uses S3 presigned URLs — no binary in the app server. All fields save optimistically and roll back on error.\n\n### carol.smith — 2026-02-14 10:30\nReviewed. Two minor comments in the PR — nothing blocking. The timezone selector is a nice touch. Approving once those are addressed.`
  },
  {
    id: 'NOVA-5', title: 'Set up GitHub Actions CI/CD pipeline',
    type: 'task', status: 'done', priority: 'major',
    assignee: 'carol.smith', labels: ['ci', 'devops'],
    sprints: ['sprint-1'],
    created: '2026-02-01T09:00:00Z', updated: '2026-02-10T16:30:00Z',
    body: `Configure automated test + deploy pipeline.\n\n## Done\n- [x] Run unit tests on every PR\n- [x] Run e2e tests on merge to main\n- [x] Auto-deploy to staging on merge\n- [x] Slack notification on failure\n\n## Comments\n\n### carol.smith — 2026-02-08 16:00\nPipeline is live. First full run took 4m 12s — acceptable. E2e suite runs in parallel across 4 workers.\n\n### alice.chen — 2026-02-10 09:00\nFirst deployment to staging went through automatically this morning. Huge improvement over the old manual process.`
  },
  {
    id: 'NOVA-6', title: 'Dashboard analytics — usage metrics and retention charts',
    type: 'story', status: 'backlog', priority: 'minor',
    assignee: 'alice.chen', labels: ['analytics'],
    created: '2026-02-08T13:00:00Z',
    body: `Product team needs visibility into user engagement.\n\n## Metrics Required\n- DAU/WAU/MAU\n- Feature adoption by cohort\n- Churn signals (last-seen > 14 days)\n\n## Comments\n\n### alice.chen — 2026-02-08 13:30\nHolding this until product confirms the exact metric definitions — DAU in particular has three different interpretations depending on who you ask.\n\n### carol.smith — 2026-02-15 11:00\nWorth looking at Plausible or PostHog instead of building custom. Either would give us all of this out of the box.`
  },
  {
    id: 'NOVA-7', title: 'API rate limiting not enforced on /export endpoints',
    type: 'bug', status: 'todo', priority: 'major',
    assignee: 'bob.patel', labels: ['security', 'api'],
    blocked_by: 'NOVA-2',
    created: '2026-02-12T10:00:00Z',
    body: `The /api/v1/export/* endpoints bypass the global rate limiter.\n\n**Risk:** Allows scraping or DoS without auth throttling.\n\n## Fix\nAdd rate-limit middleware specifically to export routes. Depends on auth epic completing first (NOVA-2) to ensure user context is available.\n\n## Comments\n\n### bob.patel — 2026-02-12 10:30\nFound this while auditing the export flow. The rate limiter middleware is applied at the router level but export routes mount before it. Quick fix once NOVA-2 lands and we have user context.\n\n### alice.chen — 2026-02-12 11:15\nConfirmed — unblocks as soon as the auth token is in the request context. Should be a 30-minute fix after NOVA-2 merges.`
  },
  {
    id: 'NOVA-8', title: 'Transactional email notifications — welcome, reset, alerts',
    type: 'story', status: 'backlog', priority: 'minor',
    labels: ['email', 'notifications'],
    links: [{ rel: 'related_to', ref: 'NOVA-2' }],
    created: '2026-02-09T09:30:00Z',
    body: `Set up transactional email via SendGrid.\n\n## Templates Needed\n- Welcome email on first login\n- Password reset link\n- Account locked alert\n- Weekly digest (opt-in)\n\n## Comments\n\n### carol.smith — 2026-02-09 10:00\nWe already have a SendGrid account from the old marketing site — credentials are in 1Password under "SendGrid API". Should be straightforward to hook up.\n\n### alice.chen — 2026-02-14 14:00\nPassword reset is the blocker for auth going to prod — let's pull that template into NOVA-2 rather than waiting for this whole story.`
  },
  {
    id: 'NOVA-9', title: 'Dependency audit and upgrade — Q1 2026',
    type: 'task', status: 'backlog', priority: 'trivial',
    assignee: 'carol.smith',
    created: '2026-02-14T11:00:00Z',
    body: `Quarterly dependency hygiene pass.\n\n- Run \`npm audit\`\n- Upgrade minor/patch versions\n- Flag any major version breaks for discussion\n\n## Comments\n\n### carol.smith — 2026-02-14 11:30\nLast audit was November — overdue. Already know express and axios have minor updates waiting. Will timebox to half a day.\n\n### bob.patel — 2026-02-14 14:00\nWatch out for the webpack upgrade — v5 to v6 has breaking changes for our CSS loader setup.`
  },
  {
    id: 'NOVA-10', title: 'Epic: Billing and Subscription Management',
    type: 'epic', status: 'backlog', priority: 'critical',
    labels: ['billing', 'payments'],
    created: '2026-02-15T10:00:00Z',
    body: `Everything needed to charge customers.\n\n## Scope\n- Stripe integration\n- Plan selection UI\n- Invoice history\n- Upgrade/downgrade flows\n- Failed payment recovery\n\n## Comments\n\n### alice.chen — 2026-02-15 10:30\nKicking this off after auth ships. Stripe has a hosted checkout option that would save us significant scope — worth a spike before we commit to a custom flow.\n\n### carol.smith — 2026-02-15 16:00\nAgreed on Stripe hosted checkout. We should also factor in VAT handling early — it's painful to retrofit.`
  },
  {
    id: 'NOVA-11', title: 'Stripe checkout flow — plan selection and payment',
    type: 'story', status: 'backlog', priority: 'critical',
    assignee: 'alice.chen', labels: ['billing', 'stripe'],
    blocked_by: 'NOVA-10',
    created: '2026-02-15T10:30:00Z',
    body: `Implement the Stripe Checkout flow for new subscriptions.\n\nBlocked on NOVA-10 (billing epic) getting kicked off and architecture agreed.\n\n## Comments\n\n### alice.chen — 2026-02-15 11:00\nParking this until the architecture decision from NOVA-10 is made. If we go hosted checkout this story shrinks significantly.\n\n### bob.patel — 2026-02-18 09:30\nStripe's hosted checkout now supports custom domains — removes the last reason we had to build custom. Strong recommendation to go that route.`
  },
  {
    id: 'NOVA-12', title: 'CSV export truncates values longer than 255 characters',
    type: 'bug', status: 'done', priority: 'minor',
    assignee: 'bob.patel', labels: ['bug', 'export'],
    sprints: ['sprint-1'],
    created: '2026-01-25T09:00:00Z', updated: '2026-02-08T11:00:00Z',
    body: `**Reported by:** Customer success\n\nExported CSVs cut off long text fields at exactly 255 characters.\n\n## Fix Applied\nRemoved hard column width limit in csv-writer options. Added regression test.\n\n## Comments\n\n### bob.patel — 2026-01-25 14:00\nConfirmed — the csv-writer library defaults to a 255-char column width and silently truncates. No warning, no error. Terrible default.\n\n### bob.patel — 2026-02-08 11:00\nFixed in #231. Regression test added with a 1000-char field. Customer success notified — they can re-export the affected records.`
  },
  // Historical done tickets for control chart
  {
    id: 'NOVA-13', title: 'Fix broken pagination on mobile list view',
    type: 'bug', status: 'done', priority: 'major',
    assignee: 'bob.patel', labels: ['bug', 'mobile'],
    created: '2026-01-10T09:00:00Z', updated: '2026-01-18T17:00:00Z',
    body: `Pagination controls not rendering on screens < 375px wide.\n\n## Fix\nReplaced fixed-width pagination component with responsive flex layout.\n\n## Comments\n\n### bob.patel — 2026-01-12 10:00\nReproduced on iPhone SE (375px). The pagination bar overflows and the next/prev buttons end up off-screen. Flex layout will fix this cleanly.\n\n### alice.chen — 2026-01-18 17:30\nShipped. Looks great on SE — finally. Should have been flex from the start.`
  },
  {
    id: 'NOVA-14', title: 'Update OpenAPI spec to v3.1 and publish to developer portal',
    type: 'task', status: 'done', priority: 'minor',
    assignee: 'carol.smith', labels: ['docs', 'api'],
    created: '2026-01-15T10:00:00Z', updated: '2026-01-22T16:00:00Z',
    body: `Migrate API docs from Swagger 2.0 to OpenAPI 3.1 format and deploy to docs.nova.app.\n\n## Comments\n\n### carol.smith — 2026-01-19 14:00\nMigration done — used the swagger2openapi converter then hand-fixed about 20 schema references it got wrong. Published to docs.nova.app.\n\n### bob.patel — 2026-01-20 09:15\nChecked the new docs — the request/response examples are much cleaner in 3.1. Nice work.`
  },
  {
    id: 'NOVA-15', title: 'Dark mode — system preference detection and manual toggle',
    type: 'story', status: 'done', priority: 'minor',
    assignee: 'alice.chen', labels: ['ui', 'accessibility'],
    links: [{ rel: 'related_to', ref: 'NOVA-16' }],
    created: '2026-01-05T09:00:00Z', updated: '2026-01-22T14:00:00Z',
    body: `Add dark mode support that respects prefers-color-scheme and allows manual override.\n\nTook longer than expected — browser compatibility issues with CSS custom properties in older Chromium versions.\n\n## Comments\n\n### alice.chen — 2026-01-14 16:00\nHit a wall with Chrome 108 — CSS custom properties in media queries don't cascade correctly. Working around with a class-based approach on the root element instead.\n\n### bob.patel — 2026-01-22 09:00\nShipped and looking great. The toggle persists across sessions via localStorage. One thing — the avatar images still look a bit harsh on dark backgrounds. Could add a subtle filter but not blocking.\n\n### alice.chen — 2026-01-22 14:00\nGood catch on the avatars. Filed NOVA-16 to track it.`
  }
];

const OPS_TICKETS = [
  {
    id: 'OPS-1', title: 'Migrate application stack to Kubernetes',
    type: 'task', status: 'in-progress', priority: 'critical',
    assignee: 'dave.jones', labels: ['kubernetes', 'infra'],
    sprints: ['sprint-1'], estimate: '8d',
    links: [{ rel: 'blocked_by', ref: 'OPS-4' }],
    created: '2026-01-28T09:00:00Z',
    body: `Move all services from docker-compose on bare VMs to a managed Kubernetes cluster (EKS).\n\n## Progress\n- [x] EKS cluster provisioned\n- [x] Stateless services migrated\n- [ ] Stateful services (Postgres, Redis) — in progress\n- [ ] DNS cutover\n- [ ] Old VMs decommissioned\n\n## Comments\n\n### dave.jones — 2026-02-10 09:00\nStateless services (API, workers, scheduler) all running in EKS. Stateful services are the hard part — Postgres needs a PVC migration and Redis needs cluster mode enabled first.\n\n### carol.smith — 2026-02-13 14:30\nOPS-4 (backup) should complete before we migrate Postgres — want PITR in place before touching prod data. Coordinating with dave to sequence this correctly.\n\n### dave.jones — 2026-02-18 16:00\nPostgres PVC migration done in staging. Clean. Scheduling prod for Saturday maintenance window.`
  },
  {
    id: 'OPS-2', title: 'Set up Prometheus + Grafana monitoring stack',
    type: 'task', status: 'done', priority: 'major',
    assignee: 'carol.smith', labels: ['monitoring', 'observability'],
    sprints: ['sprint-1'],
    created: '2026-02-03T09:00:00Z', updated: '2026-02-14T17:00:00Z',
    body: `Deploy Prometheus for metrics scraping and Grafana for dashboards.\n\n## Done\n- [x] Prometheus deployed in-cluster\n- [x] Node/pod metrics exporter configured\n- [x] Grafana with team auth (Google SSO)\n- [x] Alertmanager → PagerDuty routing\n\n## Comments\n\n### carol.smith — 2026-02-10 11:00\nPrometheus and node exporter running. First dashboards look good — CPU and memory visible for all pods. SSO auth via Google working.\n\n### dave.jones — 2026-02-14 17:00\nAlertmanager → PagerDuty routing tested end-to-end. Fired a test alert and it paged correctly. We are now actually monitoring things.`
  },
  {
    id: 'OPS-3', title: 'Memory leak in background job workers — heap grows unbounded',
    type: 'bug', status: 'todo', priority: 'critical',
    assignee: 'dave.jones', labels: ['bug', 'performance'],
    sprints: ['sprint-1'],
    created: '2026-02-11T08:00:00Z',
    body: `Worker processes (Node.js) grow to 2GB+ over 24h then OOM-killed.\n\n**Impact:** Job queue backs up every day, requires manual restart.\n\n## Investigation\nHeap snapshots show EventEmitter listener accumulation — likely from uncleaned watchers in the job processor loop.\n\n## Comments\n\n### dave.jones — 2026-02-11 09:30\nTaken three heap snapshots 6h apart. Listener count grows from ~200 to ~14,000 between snapshots. The job processor registers an 'error' listener per job but never removes it on completion.\n\n### carol.smith — 2026-02-12 10:00\nThis is urgent — we're doing a manual restart every morning before standup. Can we add a process memory limit + auto-restart as a short-term fix while dave investigates properly?\n\n### dave.jones — 2026-02-12 11:00\nAdded --max-old-space-size=512 and a PM2 memory restart threshold as mitigation. Not a fix but stops it taking down the whole queue. Root cause fix this sprint.`
  },
  {
    id: 'OPS-4', title: 'Automated database backup with point-in-time recovery',
    type: 'task', status: 'review', priority: 'major',
    assignee: 'carol.smith', labels: ['database', 'backup'],
    sprints: ['sprint-1'], estimate: '3d',
    created: '2026-02-06T10:00:00Z',
    body: `Implement automated Postgres backups with WAL archiving for PITR.\n\n## Approach\n- pg_basebackup nightly to S3\n- WAL streaming to S3 via pgBackRest\n- Retention: 30 days full, 7 days WAL\n- Restore runbook documented and tested\n\n## Comments\n\n### carol.smith — 2026-02-14 15:00\nImplementation complete. Tested a full restore to a point 6h in the past — took 4 minutes, data consistent. Runbook written and in the wiki. PR up for review.\n\n### dave.jones — 2026-02-17 09:30\nReviewed the pgBackRest config. One suggestion — add a backup verification step (pgBackRest verify) to the nightly cron so we know the backups are actually readable. Otherwise LGTM.`
  },
  {
    id: 'OPS-5', title: 'Zero-downtime deployment pipeline',
    type: 'story', status: 'backlog', priority: 'major',
    assignee: 'dave.jones', labels: ['devops', 'kubernetes'],
    links: [{ rel: 'blocked_by', ref: 'OPS-1' }],
    created: '2026-02-10T11:00:00Z',
    body: `Current deploys cause ~30s downtime during pod restart.\n\n## Solution\n- Rolling update strategy in Kubernetes manifests\n- Readiness probes configured per service\n- PodDisruptionBudget to maintain quorum\n\n## Comments\n\n### dave.jones — 2026-02-10 11:30\nNow that we're on K8s this is straightforward. Rolling update strategy is one line in the Deployment manifest. The hard part is getting the readiness probes right so K8s knows when a pod is actually ready to serve traffic.\n\n### carol.smith — 2026-02-16 14:00\nPriority goes up once OPS-1 (K8s migration) completes. Let's schedule this for next sprint.`
  },
  {
    id: 'OPS-6', title: 'Automate SSL certificate rotation with cert-manager',
    type: 'task', status: 'backlog', priority: 'minor',
    assignee: 'dave.jones', labels: ['ssl', 'kubernetes'],
    links: [{ rel: 'blocked_by', ref: 'OPS-1' }, { rel: 'related_to', ref: 'OPS-11' }],
    created: '2026-02-12T09:00:00Z',
    body: `Current certs are renewed manually every 90 days — high toil, easy to miss.\n\nInstall cert-manager in the cluster, configure Let's Encrypt ClusterIssuer, annotate ingresses.\n\n## Comments\n\n### dave.jones — 2026-02-12 09:30\ncert-manager is the standard here — well supported, handles Let's Encrypt and custom CAs. Installation is a single helm chart. Blocking on OPS-1 completing so we have a stable ingress to annotate.\n\n### carol.smith — 2026-02-12 10:00\nWe still have 4 legacy VMs with manual certs (see OPS-11). Make sure cert-manager covers everything once those are decommissioned.`
  },
  {
    id: 'OPS-7', title: 'Log aggregation broken — Loki not receiving pod logs',
    type: 'bug', status: 'todo', priority: 'major',
    assignee: 'dave.jones', labels: ['bug', 'logging', 'observability'],
    created: '2026-02-16T13:00:00Z',
    body: `Since K8s migration, Loki is receiving 0 logs from application pods.\n\n**Impact:** No application-level log visibility in Grafana.\n\n## Suspected Cause\nPromtail DaemonSet not mounting the correct log path for containerd runtime (was docker, now containerd).\n\n## Comments\n\n### dave.jones — 2026-02-16 14:00\nConfirmed — Promtail is looking for logs at /var/lib/docker/containers but EKS uses containerd which writes to /var/log/pods. One-line fix in the DaemonSet config.\n\n### carol.smith — 2026-02-16 15:30\nFlying blind without logs is not acceptable. Dave, can you push the fix today? This blocks any prod incident investigation.`
  },
  {
    id: 'OPS-8', title: 'Cloud cost optimisation audit — Q1 2026',
    type: 'task', status: 'backlog', priority: 'minor',
    labels: ['cost', 'cloud'],
    created: '2026-02-14T10:00:00Z',
    body: `Monthly AWS bill has grown 40% since Q4. Audit and identify savings.\n\n## Areas to Check\n- Unattached EBS volumes\n- Idle RDS instances\n- Reserved instance coverage\n- Data transfer costs\n\n## Comments\n\n### dave.jones — 2026-02-14 10:30\nQuick scan shows ~15 unattached EBS volumes from old dev environments. That alone is ~$200/month. Easy win.\n\n### carol.smith — 2026-02-17 09:00\nData transfer costs are the hidden killer — inter-AZ traffic. Worth mapping our service topology before the audit to understand where the traffic is actually flowing.`
  },
  // Historical done tickets for control chart
  {
    id: 'OPS-9', title: 'Upgrade PostgreSQL from 14 to 16',
    type: 'task', status: 'done', priority: 'major',
    assignee: 'carol.smith', labels: ['database', 'upgrade'],
    created: '2026-01-12T09:00:00Z', updated: '2026-01-21T16:00:00Z',
    body: `In-place major version upgrade using pg_upgrade.\n\n## Done\n- [x] Staging upgrade + smoke test\n- [x] Production upgrade (Sunday maintenance window)\n- [x] Verify logical replication still working\n- [x] Remove old 14 binaries\n\n## Comments\n\n### carol.smith — 2026-01-17 12:00\nStaging upgrade complete. pg_upgrade ran in 8 minutes. All smoke tests pass. Logical replication to the read replica picked up cleanly after a brief pause.\n\n### dave.jones — 2026-01-21 16:00\nProd upgrade done — Sunday 02:00-02:15 UTC. Zero issues. 15-minute window, came in under time. 14 binaries removed. Closing.`
  },
  {
    id: 'OPS-10', title: 'Redis cluster setup for session and cache layer',
    type: 'task', status: 'done', priority: 'major',
    assignee: 'dave.jones', labels: ['redis', 'cache'],
    created: '2026-01-20T09:00:00Z', updated: '2026-02-04T17:00:00Z',
    body: `Replace single Redis instance with a 3-node cluster for HA.\n\nTook longer than estimated — Redis Cluster mode required app-side changes to the connection pool. Updated redis client library.\n\n## Comments\n\n### dave.jones — 2026-01-28 15:00\nCluster is up but the app is failing to connect. The ioredis client needs to be initialised in cluster mode — different API from standalone. Updating the connection pool now.\n\n### carol.smith — 2026-02-04 17:00\nAll good in staging and prod. Session handling is faster and we now survive a single node failure. The ioredis cluster API is actually cleaner than standalone once you get used to it.`
  },
  {
    id: 'OPS-11', title: 'Automate SSL renewal with Let\'s Encrypt on legacy VMs',
    type: 'task', status: 'done', priority: 'minor',
    assignee: 'carol.smith', labels: ['ssl', 'automation'],
    created: '2026-01-28T10:00:00Z', updated: '2026-02-07T15:00:00Z',
    body: `Stop manually renewing certs on the 4 remaining legacy VMs. Deploy certbot with systemd timer.\n\n## Comments\n\n### carol.smith — 2026-02-03 11:00\nCertbot deployed to all 4 VMs. Systemd timer runs renewal check twice daily. Tested with --dry-run, all 4 certs would renew successfully.\n\n### dave.jones — 2026-02-07 15:00\nMonitored through the weekend — all timers fired correctly. First real renewal is in 60 days. Set a calendar reminder to check the Grafana cert expiry dashboard at that point.`
  }
];

const SPRINT = {
  id: 'sprint-1',
  name: 'Sprint 1',
  state: 'open',
  goal: 'Ship OAuth2 login, begin K8s migration, nail CI/CD',
  start: '2026-02-10',
  end: '2026-02-21'
};

const WORKSPACE_YAML = `workspace:
  name: Demo Workspace
projects:
  - prefix: NOVA
    name: Nova Platform
    path: nova
  - prefix: OPS
    name: Operations
    path: ops
`;

const INDEX_YAML = `# Tract Dashboard Index
# Edit this file to add, rename, or configure your dashboards.
# Each entry becomes a named link on the landing page at http://localhost:7766/

dashboards:
  - name: "Team Kanban"
    file: kanban.html
    description: "All tickets across Nova Platform and Operations"

  - name: "Sprint Board"
    file: scrum.html
    description: "Current sprint — sprint-1"

  - name: "Control Chart"
    file: control-chart.html
    description: "Cycle time and throughput (target: 225 cases/year)"
    params:
      goal: 225
      lcl: 7
      ucl: 14

  - name: "Alice's Board"
    file: kanban.html
    description: "alice.chen's open tickets across all projects"
    params:
      assignee: alice.chen
      title: "Alice's Board"

  - name: "NOVA Only"
    file: kanban.html
    description: "Nova Platform tickets only"
    params:
      project: NOVA
      title: "Nova Platform"

  - name: "OPS Only"
    file: kanban.html
    description: "Operations tickets only"
    params:
      project: OPS
      title: "Operations"
`;

// ── Helpers ────────────────────────────────────────────────────────────────

function frontmatter(ticket) {
  const lines = ['---'];
  lines.push(`id: ${ticket.id}`);
  lines.push(`title: "${ticket.title.replace(/"/g, '\\"')}"`);
  lines.push(`type: ${ticket.type}`);
  lines.push(`status: ${ticket.status}`);
  lines.push(`priority: ${ticket.priority}`);
  if (ticket.assignee) lines.push(`assignee: ${ticket.assignee}`);
  if (ticket.labels && ticket.labels.length) lines.push(`labels: [${ticket.labels.map(l => `"${l}"`).join(', ')}]`);
  if (ticket.sprints && ticket.sprints.length) lines.push(`sprints: [${ticket.sprints.join(', ')}]`);
  if (ticket.estimate) lines.push(`estimate: "${ticket.estimate}"`);
  if (ticket.blocked_by) lines.push(`blocked_by: ${ticket.blocked_by}`);
  if (ticket.links && ticket.links.length) {
    lines.push('links:');
    for (const link of ticket.links) lines.push(`  - rel: ${link.rel}\n    ref: ${link.ref}`);
  }
  lines.push(`created: ${ticket.created}`);
  if (ticket.updated) lines.push(`updated: ${ticket.updated}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${ticket.title}`);
  lines.push('');
  lines.push(ticket.body || '');
  return lines.join('\n');
}

function sprintYaml(sprint) {
  return [
    `id: ${sprint.id}`,
    `name: "${sprint.name}"`,
    `state: ${sprint.state}`,
    `goal: "${sprint.goal}"`,
    `start: "${sprint.start}"`,
    `end: "${sprint.end}"`,
    ''
  ].join('\n');
}

function createDemo() {
  console.log('  Creating demo workspace...');

  // Workspace structure
  const dirs = [
    path.join(DEMO_DIR, '.tract', 'sprints'),
    path.join(DEMO_DIR, 'nova', '.tract'),
    path.join(DEMO_DIR, 'nova', 'tickets'),
    path.join(DEMO_DIR, 'ops', '.tract'),
    path.join(DEMO_DIR, 'ops', 'tickets'),
    path.join(DEMO_DIR, 'dashboards')
  ];
  dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

  // workspace.yaml
  fs.writeFileSync(path.join(DEMO_DIR, '.tract', 'workspace.yaml'), WORKSPACE_YAML);

  // Sprint
  fs.writeFileSync(path.join(DEMO_DIR, '.tract', 'sprints', 'sprint-1.yaml'), sprintYaml(SPRINT));

  // Project configs
  fs.writeFileSync(path.join(DEMO_DIR, 'nova', '.tract', 'config.yaml'),
    'project: NOVA\nname: Nova Platform\nstatuses: [backlog, todo, in-progress, review, done]\n');
  fs.writeFileSync(path.join(DEMO_DIR, 'ops', '.tract', 'config.yaml'),
    'project: OPS\nname: Operations\nstatuses: [backlog, todo, in-progress, review, done]\n');

  // Tickets
  for (const t of NOVA_TICKETS) {
    fs.writeFileSync(path.join(DEMO_DIR, 'nova', 'tickets', `${t.id}.md`), frontmatter(t));
  }
  for (const t of OPS_TICKETS) {
    fs.writeFileSync(path.join(DEMO_DIR, 'ops', 'tickets', `${t.id}.md`), frontmatter(t));
  }

  // index.yaml
  fs.writeFileSync(path.join(DEMO_DIR, 'dashboards', 'index.yaml'), INDEX_YAML);

  console.log(`  Two projects: NOVA (${NOVA_TICKETS.length} tickets), OPS (${OPS_TICKETS.length} tickets)`);
  console.log(`  Sprint: ${SPRINT.name} (${SPRINT.state})`);
  console.log(`  Dashboards: kanban, scrum, control-chart, + 3 filtered views`);
  console.log(`  Location: ${DEMO_DIR}`);
}

// ── Command ────────────────────────────────────────────────────────────────

async function demoCommand(opts) {
  const port = parseInt(opts.port || DEFAULT_PORT, 10);

  if (opts.reset) {
    if (fs.existsSync(DEMO_DIR)) {
      fs.rmSync(DEMO_DIR, { recursive: true, force: true });
      console.log('  Demo workspace cleared.');
    }
  }

  console.log('');
  if (!fs.existsSync(DEMO_DIR)) {
    createDemo();
  } else {
    const novaCount = fs.readdirSync(path.join(DEMO_DIR, 'nova', 'tickets')).length;
    const opsCount  = fs.readdirSync(path.join(DEMO_DIR, 'ops',  'tickets')).length;
    console.log(`  Demo workspace exists: NOVA (${novaCount} tickets), OPS (${opsCount} tickets)`);
    console.log(`  Use --reset to regenerate fresh data.`);
  }

  // Open browser after a short delay to let server start
  setTimeout(() => {
    const url = `http://localhost:${port}/`;
    const opener =
      process.platform === 'win32' ? `start "" "${url}"` :
      process.platform === 'darwin' ? `open "${url}"` :
      `xdg-open "${url}"`;
    require('child_process').exec(opener);
  }, 1200);

  // Hand off to serve
  const serveCommand = require('./serve');
  await serveCommand({ port: String(port), workspace: DEMO_DIR });
}

module.exports = demoCommand;

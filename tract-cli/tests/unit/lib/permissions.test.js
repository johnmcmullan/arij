const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

function writePermissions(securityHome, doc) {
  fs.writeFileSync(path.join(securityHome, 'permissions.yaml'), yaml.dump(doc), 'utf8');
}

describe('permissions', () => {
  let securityHome, permissions;

  beforeEach(() => {
    securityHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-permissions-test-'));
    process.env.TRACT_SECURITY_HOME = securityHome;
    jest.resetModules();
    permissions = require('../../../lib/permissions');
  });

  afterEach(() => {
    delete process.env.TRACT_SECURITY_HOME;
    fs.rmSync(securityHome, { recursive: true, force: true });
  });

  describe('loadPermissions', () => {
    test('returns empty structure when permissions.yaml does not exist', () => {
      expect(permissions.loadPermissions()).toEqual({ projects: {}, admins: [] });
    });

    test('parses a real permissions.yaml', () => {
      writePermissions(securityHome, {
        projects: { APP: { teams: [] } },
        admins: ['admin@example.com'],
      });
      const loaded = permissions.loadPermissions();
      expect(loaded.admins).toEqual(['admin@example.com']);
      expect(loaded.projects.APP).toBeDefined();
    });

    test('reloads on every call — a live edit takes effect immediately', () => {
      writePermissions(securityHome, { admins: ['a@example.com'] });
      expect(permissions.loadPermissions().admins).toEqual(['a@example.com']);
      writePermissions(securityHome, { admins: ['b@example.com'] });
      expect(permissions.loadPermissions().admins).toEqual(['b@example.com']);
    });
  });

  describe('isAdmin', () => {
    test('true for listed admins, false otherwise', () => {
      writePermissions(securityHome, { admins: ['admin@example.com'] });
      expect(permissions.isAdmin('admin@example.com')).toBe(true);
      expect(permissions.isAdmin('nobody@example.com')).toBe(false);
      expect(permissions.isAdmin(null)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    beforeEach(() => {
      writePermissions(securityHome, {
        projects: {
          APP: {
            teams: [
              { name: 'engineering', members: ['eng@example.com'], permissions: ['read:tickets', 'write:tickets'] },
              { name: 'sales', members: ['sales@example.com'], permissions: ['read:tickets'] },
            ],
          },
        },
        admins: ['admin@example.com'],
      });
    });

    test('admins have every permission everywhere', () => {
      expect(permissions.hasPermission('admin@example.com', 'APP', 'write:tickets')).toBe(true);
      expect(permissions.hasPermission('admin@example.com', 'NONEXISTENT', 'write:tickets')).toBe(true);
    });

    test('team members get their team permissions', () => {
      expect(permissions.hasPermission('eng@example.com', 'APP', 'write:tickets')).toBe(true);
      expect(permissions.hasPermission('sales@example.com', 'APP', 'write:tickets')).toBe(false);
      expect(permissions.hasPermission('sales@example.com', 'APP', 'read:tickets')).toBe(true);
    });

    test('non-members get nothing', () => {
      expect(permissions.hasPermission('nobody@example.com', 'APP', 'read:tickets')).toBe(false);
    });
  });

  describe('getRateLimit / getGlobalRateLimit', () => {
    test('admins are unlimited (null)', () => {
      writePermissions(securityHome, { admins: ['admin@example.com'] });
      expect(permissions.getRateLimit('admin@example.com', 'APP', 'api')).toBeNull();
      expect(permissions.getGlobalRateLimit('admin@example.com', 'api')).toBeNull();
    });

    test('a single matching team returns its limit', () => {
      writePermissions(securityHome, {
        projects: {
          APP: { teams: [{ name: 'eng', members: ['e@example.com'], rate_limits: { api: '100/hour' } }] },
        },
      });
      expect(permissions.getRateLimit('e@example.com', 'APP', 'api')).toBe('100/hour');
    });

    test('the most generous limit wins across multiple teams on the same project', () => {
      writePermissions(securityHome, {
        projects: {
          APP: {
            teams: [
              { name: 'a', members: ['x@example.com'], rate_limits: { api: '100/hour' } },
              { name: 'b', members: ['x@example.com'], rate_limits: { api: '5000/hour' } },
            ],
          },
        },
      });
      expect(permissions.getRateLimit('x@example.com', 'APP', 'api')).toBe('5000/hour');
    });

    test('getGlobalRateLimit scans across all projects for the most generous limit', () => {
      writePermissions(securityHome, {
        projects: {
          APP: { teams: [{ name: 'a', members: ['x@example.com'], rate_limits: { api: '100/hour' } }] },
          OPS: { teams: [{ name: 'b', members: ['x@example.com'], rate_limits: { api: '2000/hour' } }] },
        },
      });
      expect(permissions.getGlobalRateLimit('x@example.com', 'api')).toBe('2000/hour');
    });

    test('no matching team means unlimited (permissions gate access, not rate limits)', () => {
      writePermissions(securityHome, { projects: { APP: { teams: [] } } });
      expect(permissions.getRateLimit('nobody@example.com', 'APP', 'api')).toBeNull();
      expect(permissions.getGlobalRateLimit('nobody@example.com', 'api')).toBeNull();
    });
  });

  describe('getTicketFilters / filterTickets', () => {
    test('admins see everything unfiltered', () => {
      writePermissions(securityHome, { admins: ['admin@example.com'] });
      const tickets = [{ id: 'APP-1', project: 'APP', labels: ['security'] }];
      expect(permissions.filterTickets('admin@example.com', tickets)).toEqual(tickets);
    });

    test('excludes tickets with a filtered label', () => {
      writePermissions(securityHome, {
        projects: {
          APP: {
            teams: [{
              name: 'sales', members: ['s@example.com'], permissions: ['read:tickets'],
              filters: { exclude_labels: ['security', 'internal'] },
            }],
          },
        },
      });
      const tickets = [
        { id: 'APP-1', project: 'APP', labels: ['security'] },
        { id: 'APP-2', project: 'APP', labels: [] },
      ];
      const visible = permissions.filterTickets('s@example.com', tickets);
      expect(visible.map(t => t.id)).toEqual(['APP-2']);
    });

    test('excludes tickets with a filtered component', () => {
      writePermissions(securityHome, {
        projects: {
          APP: {
            teams: [{
              name: 'sales', members: ['s@example.com'], permissions: ['read:tickets'],
              filters: { exclude_components: ['billing'] },
            }],
          },
        },
      });
      const tickets = [
        { id: 'APP-1', project: 'APP', component: 'billing' },
        { id: 'APP-2', project: 'APP', component: 'ui' },
      ];
      expect(permissions.filterTickets('s@example.com', tickets).map(t => t.id)).toEqual(['APP-2']);
    });

    test('a ticket is only excluded if every matching team excludes it', () => {
      writePermissions(securityHome, {
        projects: {
          APP: {
            teams: [
              { name: 'a', members: ['x@example.com'], permissions: ['read:tickets'], filters: { exclude_labels: ['security'] } },
              { name: 'b', members: ['x@example.com'], permissions: ['read:tickets'], filters: { exclude_labels: [] } },
            ],
          },
        },
      });
      const tickets = [{ id: 'APP-1', project: 'APP', labels: ['security'] }];
      // On team 'b' too, which doesn't exclude 'security' — broadest membership wins.
      expect(permissions.filterTickets('x@example.com', tickets)).toHaveLength(1);
    });

    test('users without read:tickets on the project see nothing from it', () => {
      writePermissions(securityHome, {
        projects: { APP: { teams: [{ name: 'a', members: ['x@example.com'], permissions: [] }] } },
      });
      const tickets = [{ id: 'APP-1', project: 'APP', labels: [] }];
      expect(permissions.filterTickets('x@example.com', tickets)).toEqual([]);
    });
  });
});

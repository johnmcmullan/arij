const path = require('path');

jest.mock('axios');
const axios = require('axios');

const timesheet = require(path.join(__dirname, '../../../commands/timesheet'));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(issue, seconds, startedIso, comment = '') {
  return { issue, seconds, started: startedIso, comment };
}

function makeResponse(entries, totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const mins  = Math.floor((totalSeconds % 3600) / 60);
  const total = hours > 0 && mins > 0 ? `${hours}h ${mins}m` : hours > 0 ? `${hours}h` : `${mins}m`;
  return {
    data: {
      entries,
      total,
      totalSeconds,
      filter: { date: '2026-02-21' }
    }
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tract timesheet', () => {
  let exitMock;
  let consoleLogMock;

  beforeEach(() => {
    jest.clearAllMocks();
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.TRACT_SYNC_SERVER;
  });

  test('reads daily entries and sums hours', async () => {
    const entries = [
      makeEntry('APP-1', 3600, '2026-02-21T09:00:00Z', 'Review PR'),
      makeEntry('APP-2', 7200, '2026-02-21T10:00:00Z', 'Write tests'),
    ];
    axios.get.mockResolvedValue(makeResponse(entries, 10800));

    await timesheet('john', { server: 'http://localhost:3100', date: '2026-02-21' });

    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:3100/timesheet/john',
      expect.objectContaining({ params: expect.objectContaining({ date: '2026-02-21' }) })
    );
    const output = consoleLogMock.mock.calls.flat().join('\n');
    expect(output).toMatch(/APP-1/);
    expect(output).toMatch(/APP-2/);
  });

  test('day with less than 8h shows warning', async () => {
    const entries = [makeEntry('APP-1', 3600, '2026-02-21T09:00:00Z', 'Quick fix')];
    axios.get.mockResolvedValue(makeResponse(entries, 3600));

    await timesheet('john', { server: 'http://localhost:3100', date: '2026-02-21' });

    const output = consoleLogMock.mock.calls.flat().join('\n');
    // Under 8h → shows daily warning and total warning
    expect(output).toMatch(/Need.*h more|⚠/);
  });

  test('empty month returns zero summary without crash', async () => {
    axios.get.mockResolvedValue({ data: { entries: [], total: '0m', totalSeconds: 0, filter: { date: '2026-02-21' } } });

    // Should not throw
    await timesheet('john', { server: 'http://localhost:3100', date: '2026-02-21' });

    const output = consoleLogMock.mock.calls.flat().join('\n');
    expect(output).toMatch(/No time logged/);
  });

  test('multiple tickets in one day are all displayed', async () => {
    const entries = [
      makeEntry('APP-1', 3600,  '2026-02-21T09:00:00Z', 'Task 1'),
      makeEntry('APP-2', 3600,  '2026-02-21T10:00:00Z', 'Task 2'),
      makeEntry('APP-3', 10800, '2026-02-21T11:00:00Z', 'Task 3'),
    ];
    axios.get.mockResolvedValue(makeResponse(entries, 18000));

    await timesheet('john', { server: 'http://localhost:3100', date: '2026-02-21' });

    const output = consoleLogMock.mock.calls.flat().join('\n');
    expect(output).toMatch(/APP-1/);
    expect(output).toMatch(/APP-2/);
    expect(output).toMatch(/APP-3/);
  });
});

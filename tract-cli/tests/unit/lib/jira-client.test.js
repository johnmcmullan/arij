const path = require('path');

jest.mock('axios');
const axios = require('axios');

const JiraClient = require(path.join(__dirname, '../../../lib/jira-client'));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JiraClient', () => {
  let client;
  let mockGet;

  beforeEach(() => {
    jest.useFakeTimers();
    mockGet = jest.fn();
    axios.create.mockReturnValue({ get: mockGet, post: jest.fn() });
    client = new JiraClient('https://jira.example.com', { username: 'user', password: 'pass' });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('successful GET returns response data', async () => {
    mockGet.mockResolvedValue({ data: { issues: [{ id: '1' }] } });

    const res = await client.request('get', '/rest/api/2/search', {});

    expect(res.data.issues).toHaveLength(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  test('429 with valid retry-after waits and retries', async () => {
    const err429 = Object.assign(new Error('Rate limited'), {
      response: { status: 429, headers: { 'retry-after': '2' } }
    });
    mockGet
      .mockRejectedValueOnce(err429)
      .mockResolvedValue({ data: { ok: true } });

    const requestPromise = client.request('get', '/path', {});
    await jest.runAllTimersAsync();
    const res = await requestPromise;

    expect(res.data.ok).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  test('429 with empty retry-after uses exponential backoff (NaN regression)', async () => {
    // Regression test: parseInt('') === NaN, sleep(NaN) should not be a no-op
    const err429 = Object.assign(new Error('Rate limited'), {
      response: { status: 429, headers: { 'retry-after': '' } }
    });
    mockGet
      .mockRejectedValueOnce(err429)
      .mockResolvedValue({ data: { ok: true } });

    const requestPromise = client.request('get', '/path', {});
    await jest.runAllTimersAsync();
    const res = await requestPromise;

    expect(res.data.ok).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  test('401 throws immediately without retry', async () => {
    const err401 = Object.assign(new Error('Unauthorized'), {
      response: { status: 401, headers: {} }
    });
    mockGet.mockRejectedValue(err401);

    await expect(client.request('get', '/path', {})).rejects.toMatchObject({
      message: 'Unauthorized'
    });
    // 401 is not retryable — only one attempt
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  test('max retries exceeded throws with final error', async () => {
    const err503 = Object.assign(new Error('Service Unavailable'), {
      response: { status: 503, headers: {} }
    });
    mockGet.mockRejectedValue(err503);

    const requestPromise = client.request('get', '/path', {});
    // Attach the rejection handler BEFORE draining timers to avoid
    // the unhandled-rejection detection firing between the final retry
    // completing and us reading the result.
    const assertion = expect(requestPromise).rejects.toMatchObject({ message: 'Service Unavailable' });
    // Drain all retry delays (MAX_RETRIES = 4, so 5 total attempts)
    await jest.runAllTimersAsync();
    await assertion;
    expect(mockGet).toHaveBeenCalledTimes(5); // initial + 4 retries
  });
});

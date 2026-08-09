const { RateLimiter, parseRateLimit } = require('../../../lib/rate-limiter');

describe('parseRateLimit', () => {
  test.each([
    ['100/hour', { count: 100, windowMs: 60 * 60 * 1000 }],
    ['5/minute', { count: 5, windowMs: 60 * 1000 }],
    ['20/day', { count: 20, windowMs: 24 * 60 * 60 * 1000 }],
    ['1000 / hour', { count: 1000, windowMs: 60 * 60 * 1000 }],
  ])('parses %s', (spec, expected) => {
    expect(parseRateLimit(spec)).toEqual(expected);
  });

  test.each([
    ['100/fortnight', 'unknown unit'],
    ['abc/hour', 'non-numeric count'],
    ['100', 'missing unit'],
    ['', 'empty string'],
    [null, 'null'],
    [undefined, 'undefined'],
    ['0/hour', 'zero count'],
  ])('rejects %s (%s)', (spec) => {
    expect(parseRateLimit(spec)).toBeNull();
  });
});

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i++) {
      expect(limiter.check('alice', 'api', '3/hour').allowed).toBe(true);
    }
  });

  test('blocks the request after the limit is reached', () => {
    for (let i = 0; i < 3; i++) limiter.check('alice', 'api', '3/hour');
    const result = limiter.check('alice', 'api', '3/hour');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('tracks separate keys independently', () => {
    for (let i = 0; i < 3; i++) limiter.check('alice', 'api', '3/hour');
    expect(limiter.check('bob', 'api', '3/hour').allowed).toBe(true);
  });

  test('tracks separate buckets independently for the same key', () => {
    for (let i = 0; i < 3; i++) limiter.check('alice', 'api', '3/hour');
    expect(limiter.check('alice', 'embeddings', '3/hour').allowed).toBe(true);
  });

  test('resets after the window elapses', () => {
    for (let i = 0; i < 3; i++) limiter.check('alice', 'api', '3/hour');
    expect(limiter.check('alice', 'api', '3/hour').allowed).toBe(false);

    jest.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(limiter.check('alice', 'api', '3/hour').allowed).toBe(true);
  });

  test('an unparseable spec means unlimited', () => {
    for (let i = 0; i < 50; i++) {
      expect(limiter.check('alice', 'api', 'not-a-spec').allowed).toBe(true);
    }
  });

  test('a null spec means unlimited', () => {
    for (let i = 0; i < 50; i++) {
      expect(limiter.check('alice', 'api', null).allowed).toBe(true);
    }
  });

  test('reset() clears all tracked state', () => {
    for (let i = 0; i < 3; i++) limiter.check('alice', 'api', '3/hour');
    expect(limiter.check('alice', 'api', '3/hour').allowed).toBe(false);
    limiter.reset();
    expect(limiter.check('alice', 'api', '3/hour').allowed).toBe(true);
  });
});

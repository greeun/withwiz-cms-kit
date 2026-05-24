import { beforeEach } from 'vitest';
import {
  resolveClientIdentity,
  setPmsConfig,
  resetPmsConfig,
} from '@withwiz/pms/config';

describe('rate-limit client identity (PMS-RLI / §4.6 S4)', () => {
  beforeEach(() => {
    resetPmsConfig();
  });

  it('PMS-RLI-01: anti-spoof — identity NOT rotatable purely via x-forwarded-for', () => {
    // Two requests differing ONLY in the x-forwarded-for header value, no
    // consumer trusted-proxy config set.
    const a = new Headers({ 'x-forwarded-for': '1.2.3.4' });
    const b = new Headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' });

    const idA = resolveClientIdentity(a);
    const idB = resolveClientIdentity(b);

    // A client cannot rotate identity by changing x-forwarded-for under the
    // safe default → the package-derived identity is EQUAL.
    expect(idA).toBe(idB);
  });

  it('PMS-RLI-02: consumer-injected extractor is honored', () => {
    setPmsConfig({
      rateLimit: {
        identityExtractor: () => 'CONSUMER-ID',
      },
    });

    const h1 = new Headers({ 'x-forwarded-for': '1.1.1.1' });
    const h2 = new Headers({ 'x-real-ip': '2.2.2.2' });

    expect(resolveClientIdentity(h1)).toBe('CONSUMER-ID');
    expect(resolveClientIdentity(h2)).toBe('CONSUMER-ID');
  });

  it('PMS-RLI-03: consumer extractor can use real proxy topology', () => {
    // A consumer who knows they sit behind exactly one trusted proxy may take
    // the LAST x-forwarded-for hop — proving the strategy is fully overridable.
    setPmsConfig({
      rateLimit: {
        identityExtractor: (headers) => {
          const xff = headers.get('x-forwarded-for');
          if (!xff) return 'no-xff';
          const parts = xff.split(',').map((s) => s.trim());
          return parts[parts.length - 1];
        },
      },
    });

    const h = new Headers({ 'x-forwarded-for': 'spoofed, 203.0.113.7' });
    expect(resolveClientIdentity(h)).toBe('203.0.113.7');
  });

  it('PMS-RLI-04: no 127.0.0.1 magic default leak', () => {
    const h = new Headers(); // no XFF, no override
    const id = resolveClientIdentity(h);
    expect(id).not.toBe('127.0.0.1');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

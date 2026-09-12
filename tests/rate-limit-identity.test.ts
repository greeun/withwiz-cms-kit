import { beforeEach, afterEach, vi } from 'vitest';
import {
  resolveClientIdentity,
  resolveRateLimitEnabled,
  createForwardedIdentityExtractor,
  SHARED_ANON_IDENTITY,
  setCmsConfig,
  resetCmsConfig,
} from '@withwiz/cms-kit/config';

describe('rate-limit client identity (CMS-RLI / §4.6 S4)', () => {
  beforeEach(() => {
    resetCmsConfig();
  });

  describe('shared-bucket self-DoS guard (CMS-RLI-05..07)', () => {
    const prevEnv = process.env.RATE_LIMIT_ENABLED;
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      delete process.env.RATE_LIMIT_ENABLED;
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warn.mockRestore();
      if (prevEnv === undefined) delete process.env.RATE_LIMIT_ENABLED;
      else process.env.RATE_LIMIT_ENABLED = prevEnv;
    });

    it('CMS-RLI-05: extractor 미주입 → rate-limit 비활성 + namespaced warn 1회', () => {
      expect(resolveRateLimitEnabled()).toBe(false);
      expect(resolveRateLimitEnabled()).toBe(false);
      const msgs = warn.mock.calls.map((c) => String(c[0]));
      expect(msgs.filter((m) => m.includes('identityExtractor'))).toHaveLength(1);
      expect(msgs[0]).toMatch(/^@withwiz\/cms-kit:/);
      expect(msgs[0]).toContain('DISABLED');
    });

    it('CMS-RLI-06: extractor 주입 → 기본 활성', () => {
      setCmsConfig({ rateLimit: { identityExtractor: () => 'x' } });
      expect(resolveRateLimitEnabled()).toBe(true);
      expect(warn).not.toHaveBeenCalled();
    });

    it('CMS-RLI-07: enabled:true 를 명시하면 공유 버킷을 경고하고 활성화한다', () => {
      setCmsConfig({ rateLimit: { enabled: true } });
      expect(resolveRateLimitEnabled()).toBe(true);
      const msgs = warn.mock.calls.map((c) => String(c[0]));
      expect(msgs.some((m) => m.includes('shares ONE rate-limit bucket'))).toBe(true);
    });

    it('CMS-RLI-08: enabled:false 는 extractor 여부와 무관하게 비활성', () => {
      setCmsConfig({
        rateLimit: { enabled: false, identityExtractor: () => 'x' },
      });
      expect(resolveRateLimitEnabled()).toBe(false);
    });
  });

  describe('createForwardedIdentityExtractor (CMS-RLI-09..12)', () => {
    it('CMS-RLI-09: trustedHops=1 → 마지막 XFF 값 (클라이언트가 앞에 붙인 값은 무시)', () => {
      const ex = createForwardedIdentityExtractor({ trustedHops: 1 });
      const h = new Headers({ 'x-forwarded-for': 'spoofed, 203.0.113.7' });
      expect(ex(h)).toBe('203.0.113.7');
    });

    it('CMS-RLI-10: trustedHops=2 → 뒤에서 두 번째 값', () => {
      const ex = createForwardedIdentityExtractor({ trustedHops: 2 });
      const h = new Headers({ 'x-forwarded-for': 'spoofed, 198.51.100.9, 10.0.0.2' });
      expect(ex(h)).toBe('198.51.100.9');
    });

    it('CMS-RLI-11: XFF 없으면 fallback 헤더, 그것도 없으면 고정 식별자', () => {
      const ex = createForwardedIdentityExtractor();
      expect(ex(new Headers({ 'x-real-ip': ' 192.0.2.1 ' }))).toBe('192.0.2.1');
      expect(ex(new Headers())).toBe(SHARED_ANON_IDENTITY);
    });

    it('CMS-RLI-12: 주입하면 resolveClientIdentity 가 그대로 사용한다', () => {
      setCmsConfig({
        rateLimit: { identityExtractor: createForwardedIdentityExtractor() },
      });
      const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' });
      expect(resolveClientIdentity(h)).toBe('203.0.113.7');
    });
  });

  it('CMS-RLI-01: anti-spoof — identity NOT rotatable purely via x-forwarded-for', () => {
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

  it('CMS-RLI-02: consumer-injected extractor is honored', () => {
    setCmsConfig({
      rateLimit: {
        identityExtractor: () => 'CONSUMER-ID',
      },
    });

    const h1 = new Headers({ 'x-forwarded-for': '1.1.1.1' });
    const h2 = new Headers({ 'x-real-ip': '2.2.2.2' });

    expect(resolveClientIdentity(h1)).toBe('CONSUMER-ID');
    expect(resolveClientIdentity(h2)).toBe('CONSUMER-ID');
  });

  it('CMS-RLI-03: consumer extractor can use real proxy topology', () => {
    // A consumer who knows they sit behind exactly one trusted proxy may take
    // the LAST x-forwarded-for hop — proving the strategy is fully overridable.
    setCmsConfig({
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

  it('CMS-RLI-04: no 127.0.0.1 magic default leak', () => {
    const h = new Headers(); // no XFF, no override
    const id = resolveClientIdentity(h);
    expect(id).not.toBe('127.0.0.1');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

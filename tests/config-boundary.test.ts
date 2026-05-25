import { vi, beforeEach } from 'vitest';

/**
 * CMS-CB — §5 config/injection boundary semantics (spec.md §5 / B2/B3/B4/B5,
 * CHK-5-1 / CHK-5-2 / CHK-5-3).
 */

const BARRELS = [
  '@withwiz/cms-kit/index',
  '@withwiz/cms-kit/components/index',
  '@withwiz/cms-kit/hooks/index',
  '@withwiz/cms-kit/infrastructure/index',
  '@withwiz/cms-kit/infrastructure/middleware/index',
  '@withwiz/cms-kit/services/index',
  '@withwiz/cms-kit/types/index',
  '@withwiz/cms-kit/utils/index',
  '@withwiz/cms-kit/validators/index',
];

describe('config boundary (CMS-CB)', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
    resetCmsConfig();
  });

  it('CMS-CB-01: precedence inject > legacy-env > built-in default (JWT secret)', async () => {
    const STRONG_ENV = 'e'.repeat(40);
    const STRONG_INJECT = 'i'.repeat(40);

    // default (no inject, no env): missing-no-safe-default → throws.
    {
      vi.resetModules();
      delete process.env.JWT_SECRET;
      const { resolveJwtConfig, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      expect(() => resolveJwtConfig()).toThrowError(/@withwiz\/cms-kit/);
    }

    // legacy env wins over default.
    {
      vi.resetModules();
      process.env.JWT_SECRET = STRONG_ENV;
      const { resolveJwtConfig, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      expect(resolveJwtConfig().secret).toBe(STRONG_ENV);
    }

    // explicit injection wins over legacy env.
    {
      vi.resetModules();
      process.env.JWT_SECRET = STRONG_ENV;
      const { resolveJwtConfig, setCmsConfig, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      setCmsConfig({ jwt: { secret: STRONG_INJECT } });
      expect(resolveJwtConfig().secret).toBe(STRONG_INJECT);
      delete process.env.JWT_SECRET;
    }
  });

  it('CMS-CB-02: precedence for a second surface (trusted iframe origins)', async () => {
    const { resolveTrustedIframeOrigins, setCmsConfig, resetCmsConfig } =
      await import('@withwiz/cms-kit/config');
    resetCmsConfig();
    // default
    expect(resolveTrustedIframeOrigins()).toContain('https://www.youtube.com/');
    // injection wins
    setCmsConfig({ sanitizer: { trustedIframeOrigins: ['https://loom.com/'] } });
    expect(resolveTrustedIframeOrigins()).toEqual(['https://loom.com/']);
  });

  it('CMS-CB-03: lazy / point-of-use — all 9 barrels import with no throw (Sprint-1 env unset)', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_TOKEN_EXPIRES_IN;
    delete process.env.RATE_LIMIT_ENABLED;

    for (const barrel of BARRELS) {
      vi.resetModules();
      const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
      resetCmsConfig();
      // Fresh, uncached evaluation: a cached prior import would mask an
      // import-time throw.
      await expect(import(/* @vite-ignore */ barrel)).resolves.toBeTruthy();
    }
  });

  it('CMS-CB-04: warn-once + namespaced (safe-default-but-unconfigured)', async () => {
    const { resolveBrandConfig, resetCmsConfig } = await import(
      '@withwiz/cms-kit/config'
    );
    resetCmsConfig();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    try {
      // first unconfigured use → exactly one namespaced warn naming config.
      resolveBrandConfig();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = String(warnSpy.mock.calls[0][0]);
      expect(msg).toContain('@withwiz/cms-kit');
      expect(msg.toLowerCase()).toMatch(/nav|navigation|brand/);

      // re-invoking the same unconfigured surface → NO second warn.
      resolveBrandConfig();
      resolveBrandConfig();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('CMS-CB-05: no-safe-default path → namespaced fail-fast error', async () => {
    vi.resetModules();
    delete process.env.JWT_SECRET;
    const { resolveJwtConfig, resetCmsConfig } = await import(
      '@withwiz/cms-kit/config'
    );
    resetCmsConfig();
    let caught: Error | null = null;
    try {
      resolveJwtConfig();
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toContain('@withwiz/cms-kit');
  });

  it('CMS-CB-07: R2 credentials precedence inject > legacy env > null (no-safe-default)', async () => {
    // default (no inject, no env): 모든 필드 null.
    {
      vi.resetModules();
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      const { resolveR2CredentialsConfig, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      const c = resolveR2CredentialsConfig();
      expect(c.accountId).toBeNull();
      expect(c.accessKeyId).toBeNull();
      expect(c.secretAccessKey).toBeNull();
      expect(c.bucketName).toBeNull();
    }

    // legacy env 가 default 를 이긴다.
    {
      vi.resetModules();
      process.env.R2_ACCOUNT_ID = 'env-acc';
      process.env.R2_ACCESS_KEY_ID = 'env-key';
      process.env.R2_SECRET_ACCESS_KEY = 'env-sec';
      process.env.R2_BUCKET_NAME = 'env-buck';
      const { resolveR2CredentialsConfig, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      const c = resolveR2CredentialsConfig();
      expect(c.accountId).toBe('env-acc');
      expect(c.accessKeyId).toBe('env-key');
      expect(c.secretAccessKey).toBe('env-sec');
      expect(c.bucketName).toBe('env-buck');
    }

    // inject 가 legacy env 를 이긴다 (필드별 독립).
    {
      vi.resetModules();
      process.env.R2_ACCOUNT_ID = 'env-acc';
      process.env.R2_ACCESS_KEY_ID = 'env-key';
      process.env.R2_SECRET_ACCESS_KEY = 'env-sec';
      process.env.R2_BUCKET_NAME = 'env-buck';
      const { resolveR2CredentialsConfig, setCmsConfig, resetCmsConfig } =
        await import('@withwiz/cms-kit/config');
      resetCmsConfig();
      setCmsConfig({
        storage: {
          r2: {
            accountId: 'inj-acc',
            accessKeyId: 'inj-key',
            secretAccessKey: 'inj-sec',
            bucketName: 'inj-buck',
          },
        },
      });
      const c = resolveR2CredentialsConfig();
      expect(c.accountId).toBe('inj-acc');
      expect(c.accessKeyId).toBe('inj-key');
      expect(c.secretAccessKey).toBe('inj-sec');
      expect(c.bucketName).toBe('inj-buck');
    }

    // 부분 inject (bucketName 만) → 나머지는 env fallback.
    {
      vi.resetModules();
      process.env.R2_ACCOUNT_ID = 'env-acc';
      process.env.R2_ACCESS_KEY_ID = 'env-key';
      process.env.R2_SECRET_ACCESS_KEY = 'env-sec';
      process.env.R2_BUCKET_NAME = 'env-buck';
      const { resolveR2CredentialsConfig, setCmsConfig, resetCmsConfig } =
        await import('@withwiz/cms-kit/config');
      resetCmsConfig();
      setCmsConfig({ storage: { r2: { bucketName: 'inj-buck-only' } } });
      const c = resolveR2CredentialsConfig();
      expect(c.accountId).toBe('env-acc');
      expect(c.bucketName).toBe('inj-buck-only');
    }

    // cleanup
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
  });

  it('CMS-CB-08: R2 publicUrl precedence inject(publicBaseUrl) > R2_PUBLIC_URL env > null', async () => {
    // default: null
    {
      vi.resetModules();
      delete process.env.R2_PUBLIC_URL;
      const { resolveR2PublicUrl, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      expect(resolveR2PublicUrl()).toBeNull();
    }
    // env wins over default
    {
      vi.resetModules();
      process.env.R2_PUBLIC_URL = 'https://env.example';
      const { resolveR2PublicUrl, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      expect(resolveR2PublicUrl()).toBe('https://env.example');
    }
    // inject wins over env
    {
      vi.resetModules();
      process.env.R2_PUBLIC_URL = 'https://env.example';
      const { resolveR2PublicUrl, setCmsConfig, resetCmsConfig } = await import(
        '@withwiz/cms-kit/config'
      );
      resetCmsConfig();
      setCmsConfig({ storage: { publicBaseUrl: 'https://inj.example' } });
      expect(resolveR2PublicUrl()).toBe('https://inj.example');
    }
    delete process.env.R2_PUBLIC_URL;
  });

  it('CMS-CB-06: backward-compat — legacy env-only path unchanged (B5)', async () => {
    vi.resetModules();
    process.env.JWT_SECRET = 's'.repeat(36);
    process.env.JWT_EXPIRES_IN = '5h';
    const { resolveJwtConfig, resetCmsConfig } = await import(
      '@withwiz/cms-kit/config'
    );
    resetCmsConfig();
    const cfg = resolveJwtConfig();
    expect(cfg.secret).toBe('s'.repeat(36));
    expect(cfg.accessTokenExpiry).toBe('5h'); // legacy env honored
    expect(cfg.refreshTokenExpiry).toBe('7d'); // documented default
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });
});

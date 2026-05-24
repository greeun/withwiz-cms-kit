import { vi, beforeEach } from 'vitest';

/**
 * PMS-CB — §5 config/injection boundary semantics (spec.md §5 / B2/B3/B4/B5,
 * CHK-5-1 / CHK-5-2 / CHK-5-3).
 */

const BARRELS = [
  '@withwiz/pms/index',
  '@withwiz/pms/components/index',
  '@withwiz/pms/hooks/index',
  '@withwiz/pms/infrastructure/index',
  '@withwiz/pms/infrastructure/middleware/index',
  '@withwiz/pms/services/index',
  '@withwiz/pms/types/index',
  '@withwiz/pms/utils/index',
  '@withwiz/pms/validators/index',
];

describe('config boundary (PMS-CB)', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { resetPmsConfig } = await import('@withwiz/pms/config');
    resetPmsConfig();
  });

  it('PMS-CB-01: precedence inject > legacy-env > built-in default (JWT secret)', async () => {
    const STRONG_ENV = 'e'.repeat(40);
    const STRONG_INJECT = 'i'.repeat(40);

    // default (no inject, no env): missing-no-safe-default → throws.
    {
      vi.resetModules();
      delete process.env.JWT_SECRET;
      const { resolveJwtConfig, resetPmsConfig } = await import(
        '@withwiz/pms/config'
      );
      resetPmsConfig();
      expect(() => resolveJwtConfig()).toThrowError(/@withwiz\/pms/);
    }

    // legacy env wins over default.
    {
      vi.resetModules();
      process.env.JWT_SECRET = STRONG_ENV;
      const { resolveJwtConfig, resetPmsConfig } = await import(
        '@withwiz/pms/config'
      );
      resetPmsConfig();
      expect(resolveJwtConfig().secret).toBe(STRONG_ENV);
    }

    // explicit injection wins over legacy env.
    {
      vi.resetModules();
      process.env.JWT_SECRET = STRONG_ENV;
      const { resolveJwtConfig, setPmsConfig, resetPmsConfig } = await import(
        '@withwiz/pms/config'
      );
      resetPmsConfig();
      setPmsConfig({ jwt: { secret: STRONG_INJECT } });
      expect(resolveJwtConfig().secret).toBe(STRONG_INJECT);
      delete process.env.JWT_SECRET;
    }
  });

  it('PMS-CB-02: precedence for a second surface (trusted iframe origins)', async () => {
    const { resolveTrustedIframeOrigins, setPmsConfig, resetPmsConfig } =
      await import('@withwiz/pms/config');
    resetPmsConfig();
    // default
    expect(resolveTrustedIframeOrigins()).toContain('https://www.youtube.com/');
    // injection wins
    setPmsConfig({ sanitizer: { trustedIframeOrigins: ['https://loom.com/'] } });
    expect(resolveTrustedIframeOrigins()).toEqual(['https://loom.com/']);
  });

  it('PMS-CB-03: lazy / point-of-use — all 9 barrels import with no throw (Sprint-1 env unset)', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_TOKEN_EXPIRES_IN;
    delete process.env.RATE_LIMIT_ENABLED;

    for (const barrel of BARRELS) {
      vi.resetModules();
      const { resetPmsConfig } = await import('@withwiz/pms/config');
      resetPmsConfig();
      // Fresh, uncached evaluation: a cached prior import would mask an
      // import-time throw.
      await expect(import(/* @vite-ignore */ barrel)).resolves.toBeTruthy();
    }
  });

  it('PMS-CB-04: warn-once + namespaced (safe-default-but-unconfigured)', async () => {
    const { resolveBrandConfig, resetPmsConfig } = await import(
      '@withwiz/pms/config'
    );
    resetPmsConfig();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    try {
      // first unconfigured use → exactly one namespaced warn naming config.
      resolveBrandConfig();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = String(warnSpy.mock.calls[0][0]);
      expect(msg).toContain('@withwiz/pms');
      expect(msg.toLowerCase()).toMatch(/nav|navigation|brand/);

      // re-invoking the same unconfigured surface → NO second warn.
      resolveBrandConfig();
      resolveBrandConfig();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('PMS-CB-05: no-safe-default path → namespaced fail-fast error', async () => {
    vi.resetModules();
    delete process.env.JWT_SECRET;
    const { resolveJwtConfig, resetPmsConfig } = await import(
      '@withwiz/pms/config'
    );
    resetPmsConfig();
    let caught: Error | null = null;
    try {
      resolveJwtConfig();
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toContain('@withwiz/pms');
  });

  it('PMS-CB-06: backward-compat — legacy env-only path unchanged (B5)', async () => {
    vi.resetModules();
    process.env.JWT_SECRET = 's'.repeat(36);
    process.env.JWT_EXPIRES_IN = '5h';
    const { resolveJwtConfig, resetPmsConfig } = await import(
      '@withwiz/pms/config'
    );
    resetPmsConfig();
    const cfg = resolveJwtConfig();
    expect(cfg.secret).toBe('s'.repeat(36));
    expect(cfg.accessTokenExpiry).toBe('5h'); // legacy env honored
    expect(cfg.refreshTokenExpiry).toBe('7d'); // documented default
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { slugSchema, optionalUrlSchema } from '@withwiz/pms/validators/shared';

/**
 * PMS-ZC — Zod peer-range ↔ source mutual consistency (spec.md §4.7 / Z1 /
 * AC-4.7.1).
 *
 * Chosen direction (spec-permitted, narrowest): tighten peerDependencies.zod
 * to a 4-only range (was the dishonest ">=3"; installed/dev Zod is 4.4.3 and
 * src/validators/shared.ts uses Zod-4 APIs `z.url()` / `{ error }`). No
 * source rewrite, so PMS-SV-01..12 stay byte-identical and pass unchanged.
 */

function zodPeerRange(): string {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'),
  );
  return pkg.peerDependencies.zod as string;
}

describe('zod compat (PMS-ZC)', () => {
  it('PMS-ZC-01: peerDependencies.zod admits 4.4.3 and NONE of Zod 3.x', () => {
    const range = zodPeerRange();
    let semver: typeof import('semver') | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      semver = require('semver');
    } catch {
      semver = null;
    }
    if (semver) {
      const admits3 = ['3.0.0', '3.22.0', '3.99.0'].some((v) =>
        semver!.satisfies(v, range),
      );
      const admits4 = semver.satisfies('4.4.3', range);
      expect(admits3).toBe(false);
      expect(admits4).toBe(true);
    } else {
      // Equivalent manual assertion: starts with >=4 / ^4 / 4, no >=3 / 3
      // lower bound, no `||` alternative re-admitting 3.
      expect(range).toMatch(/^(>=\s*4|\^4|4)/);
      expect(range).not.toContain('3');
      expect(range).not.toContain('||');
    }
  });

  it('PMS-ZC-02: slugSchema accepts valid, rejects invalid (installed Zod)', () => {
    expect(slugSchema.safeParse('my-valid-slug').success).toBe(true);
    expect(slugSchema.safeParse('Invalid Slug!').success).toBe(false);
    expect(slugSchema.safeParse('').success).toBe(false);
  });

  it('PMS-ZC-03: optionalUrlSchema accepts https + empty/undefined', () => {
    expect(optionalUrlSchema.safeParse('https://example.com').success).toBe(
      true,
    );
    expect(optionalUrlSchema.safeParse('').success).toBe(true);
    expect(optionalUrlSchema.safeParse(undefined).success).toBe(true);
  });

  it('PMS-ZC-04: optionalUrlSchema REJECTS file:/javascript:/data: protocols', () => {
    expect(
      optionalUrlSchema.safeParse('file:///etc/passwd').success,
    ).toBe(false);
    expect(
      optionalUrlSchema.safeParse('javascript:alert(1)').success,
    ).toBe(false);
    expect(
      optionalUrlSchema.safeParse('data:text/html,<script>').success,
    ).toBe(false);
  });
});

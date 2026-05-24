import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * PMS-NCL — canonical "no consumer-specific literal" guard (spec.md §4.1 /
 * AC-4.1.3 / Sprint 1 C5).
 *
 * This test IS the machine definition of the grep rule (regression-caught in
 * CI). It scans every src/** .ts/.tsx file recursively and FAILS if a
 * consumer-specific brand token or a hardcoded admin-route literal reappears
 * in CODE. Comment-only lines are excluded (consistent with the CHK-41-2
 * human cross-check which drops comment lines) because illustrative JSDoc
 * examples are not shipped behavior; brand tokens are matched
 * case-insensitively even in comments (a leaked tenant name is never OK).
 */

const SRC_ROOT = resolve(__dirname, '..', 'src');

// Brand tokens — matched case-insensitively, EVERYWHERE (incl. comments).
const BRAND_TOKENS = [/DTS BALLET/i, /Dance Theater/i, /Shahar/i];

// Hardcoded admin-route literals — the CHK-41-2 enumerated set. Matched in
// CODE only (comment lines excluded).
const ROUTE_LITERALS = [
  '/admin/login',
  '/api/admin/auth/',
  '/api/admin/upload',
  '/admin/dashboard',
  '/admin/performances',
  '/admin/repertoires',
  '/admin/artists',
  '/admin/galleries',
  '/admin/settings',
  '/admin/docs',
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** A line that is purely a comment (// ... or * ... JSDoc body / block). */
function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

describe('no consumer-specific literals in src/** (PMS-NCL)', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('PMS-NCL-01: scans src/** recursively (sanity: many files found)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith('config/index.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('components/AdminShell.tsx'))).toBe(
      true,
    );
  });

  it('PMS-NCL-02: no brand token (DTS BALLET / Dance Theater / Shahar) anywhere', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      for (const re of BRAND_TOKENS) {
        if (re.test(content)) {
          offenders.push(`${f} :: ${re}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('PMS-NCL-03: no hardcoded admin-route literal in CODE', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (isCommentLine(line)) return;
        for (const lit of ROUTE_LITERALS) {
          if (line.includes(lit)) {
            offenders.push(`${f}:${i + 1} :: ${lit} :: ${line.trim()}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

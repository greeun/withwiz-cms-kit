import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

/**
 * PMS-EXP — I1 public-export superset (spec.md §3 I1 / CHK-I1).
 *
 * For each of the 9 code barrels, EVERY name in baseline-exports.json must
 * still be exported (SUPERSET: new names allowed, none of the baseline names
 * missing). The baseline was captured from the built dist `.d.ts` via the
 * TypeScript compiler API (ts.getExportsOfModule); this test reproduces the
 * SAME enumeration against the `src/**` barrels (src exports === dist
 * exports — tsup only bundles) so it covers TYPE exports too (a runtime
 * `name in module` check cannot see type-only exports like
 * `AdminManagerBaseHandle` / `IApiContext`). Non-vacuous: it iterates the
 * baseline arrays and asserts each name appears in the module's actual
 * export symbol set — removing e.g. `sanitizeHtmlContent` from ./utils, or
 * the `JsonLd` type/value, would make this RED.
 *
 * I6 scope note: baseline-exports.json["./infrastructure"] is the current
 * 8-name set and does NOT include setPrismaClient/getPrisma — closing that
 * gap is Sprint 2, so this sprint's bar is "the existing 8 still resolve".
 */

const PKG_ROOT = resolve(__dirname, '..');

const baseline = JSON.parse(
  readFileSync(
    resolve(PKG_ROOT, '.claude/harness/pms-refactor/baseline-exports.json'),
    'utf8',
  ),
) as Record<string, string[] | { type: string }>;

const SUBPATH_TO_SRC: Record<string, string> = {
  '.': 'src/index.ts',
  './components': 'src/components/index.ts',
  './hooks': 'src/hooks/index.ts',
  './infrastructure': 'src/infrastructure/index.ts',
  './infrastructure/middleware': 'src/infrastructure/middleware/index.ts',
  './services': 'src/services/index.ts',
  './types': 'src/types/index.ts',
  './utils': 'src/utils/index.ts',
  './validators': 'src/validators/index.ts',
};

function exportedNames(srcRel: string): Set<string> {
  const file = resolve(PKG_ROOT, srcRel);
  const program = ts.createProgram([file], {
    noEmit: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
  });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file);
  if (!sf) throw new Error('no source file for ' + srcRel);
  const sym = checker.getSymbolAtLocation(sf);
  if (!sym) throw new Error('no module symbol for ' + srcRel);
  const names = checker
    .getExportsOfModule(sym)
    .map((s) => s.getName())
    .filter((n) => n && n !== 'default' && n !== '__esModule');
  return new Set(names);
}

describe('exports superset vs baseline (PMS-EXP)', () => {
  for (const [subpath, srcRel] of Object.entries(SUBPATH_TO_SRC)) {
    const names = baseline[subpath] as string[];
    it(`PMS-EXP: ${subpath} (${names.length} baseline names) all still exported`, () => {
      const exported = exportedNames(srcRel);
      const missing = names.filter((n) => !exported.has(n));
      expect(missing).toEqual([]);
    });
  }

  it('PMS-EXP-TOUCHED: sprint-touched baseline names remain (compatible shape)', () => {
    const utils = exportedNames(SUBPATH_TO_SRC['./utils']);
    const components = exportedNames(SUBPATH_TO_SRC['./components']);
    const validators = exportedNames(SUBPATH_TO_SRC['./validators']);
    const infra = exportedNames(SUBPATH_TO_SRC['./infrastructure']);
    const root = exportedNames(SUBPATH_TO_SRC['.']);

    for (const n of [
      'sanitizeHtmlContent',
      'collectR2Keys',
      'extractR2KeysFromHtml',
      'getVariantUrl',
      'getJWTManager',
      'getAuthHeaders',
      'refreshAccessToken',
      'parseSortKey',
      // additive (superset — allowed):
      'createSanitizer',
      'setPmsConfig',
    ]) {
      expect(utils.has(n)).toBe(true);
    }
    expect(components.has('JsonLd')).toBe(true);
    expect(components.has('AdminShell')).toBe(true);
    expect(validators.has('slugSchema')).toBe(true);
    expect(validators.has('optionalUrlSchema')).toBe(true);
    expect(infra.has('prisma')).toBe(true);
    expect(infra.has('withPublicApi')).toBe(true);
    expect(root.has('parseSortParam')).toBe(true);
    expect(root.has('parseSortKey')).toBe(true);
  });
});

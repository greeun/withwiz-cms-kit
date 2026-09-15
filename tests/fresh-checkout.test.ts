import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * CMS-FRESH — 새로 받은 체크아웃에서 스위트가 실행되는지 확인한다 (TC-SM-005).
 *
 * 스위트가 gitignore 대상 파일에 의존하면 `git clone`·`git worktree add` 직후
 * 모든 테스트 파일이 로드에 실패한다. 2026-09-16 이전에는 `vitest.config.ts`
 * 의 셋업 파일과 `exports-superset.test.ts` 의 기준선이 각각 gitignore 대상
 * 디렉터리에 있어 추적 파일만으로는 0건이 실행되었다.
 *
 * - FRESH-01: Vitest 프로젝트가 지정한 셋업 파일이 모두 존재하고 git 추적 대상이다.
 * - FRESH-02: 설정 파일과 테스트 코드가 gitignore 대상 디렉터리 경로를 가리키지 않는다.
 * - FRESH-03: 테스트가 읽는 fixture 가 git 추적 대상이다.
 *
 * git 저장소 밖(소스 압축본 등)에서 실행하면 추적 여부 단언은 건너뛴다.
 */

const PKG_ROOT = resolve(__dirname, '..');

function isInsideGitWorkTree(): boolean {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: PKG_ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim() === 'true'
    );
  } catch {
    return false;
  }
}

const IN_GIT = isInsideGitWorkTree();

function isTracked(relPath: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relPath], {
      cwd: PKG_ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function toRepoRelative(p: string): string {
  return relative(PKG_ROOT, resolve(PKG_ROOT, p)).split('\\').join('/');
}

type ProjectLike = { test?: { name?: string; setupFiles?: string | string[] } };

async function loadSetupFiles(): Promise<Array<{ project: string; file: string }>> {
  const mod = (await import('../vitest.config')) as {
    default: { test?: { projects?: ProjectLike[] } };
  };
  const projects = mod.default.test?.projects ?? [];
  return projects.flatMap((p) => {
    const raw = p.test?.setupFiles ?? [];
    const files = Array.isArray(raw) ? raw : [raw];
    return files.map((file) => ({ project: p.test?.name ?? '(unnamed)', file }));
  });
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === 'node_modules') return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** 주석 줄을 뺀 코드 줄만 남긴다 (경로 설명 주석은 검사하지 않는다). */
function codeLines(source: string): string[] {
  return source.split('\n').filter((line) => {
    const t = line.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  });
}

// 과거에 스위트가 의존했던 gitignore 대상 디렉터리. 이 파일 자체가 검사에
// 걸리지 않도록 조각을 이어 붙인다.
const IGNORED_DIR_LITERALS = ['.cla' + 'ude/', 'tests-' + 'harness/'];

describe('새로 받은 체크아웃에서 스위트 실행 (CMS-FRESH)', () => {
  it('CMS-FRESH-01: Vitest 프로젝트의 셋업 파일이 존재하고 git 추적 대상이다', async () => {
    const entries = await loadSetupFiles();
    expect(entries.length).toBeGreaterThan(0);

    const missing = entries.filter(({ file }) => !existsSync(resolve(PKG_ROOT, file)));
    expect(missing).toEqual([]);

    if (IN_GIT) {
      const untracked = entries.filter(({ file }) => !isTracked(toRepoRelative(file)));
      expect(untracked).toEqual([]);
    }
  });

  it('CMS-FRESH-02: 설정 파일과 테스트 코드가 gitignore 대상 디렉터리 경로를 가리키지 않는다', () => {
    const selfPath = resolve(__filename);
    const files = [
      resolve(PKG_ROOT, 'vitest.config.ts'),
      ...walk(resolve(PKG_ROOT, 'tests')).filter(
        (f) => /\.(ts|tsx)$/.test(f) && resolve(f) !== selfPath,
      ),
    ];

    const hits: string[] = [];
    for (const file of files) {
      codeLines(readFileSync(file, 'utf8')).forEach((line) => {
        if (IGNORED_DIR_LITERALS.some((lit) => line.includes(lit))) {
          hits.push(`${toRepoRelative(file)}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('CMS-FRESH-03: 테스트가 읽는 fixture 가 git 추적 대상이다', () => {
    const fixtures = walk(resolve(PKG_ROOT, 'tests/fixtures')).map(toRepoRelative);
    expect(fixtures).toContain('tests/fixtures/baseline-exports.json');

    if (IN_GIT) {
      expect(fixtures.filter((f) => !isTracked(f))).toEqual([]);
    }
  });
});

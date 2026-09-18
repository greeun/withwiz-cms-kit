import { vi } from 'vitest';
import DOMPurify from 'isomorphic-dompurify';
import { sanitizeHtmlContent, createSanitizer } from '@withwiz/cms-kit/utils/html-sanitizer';

/**
 * CMS-HBP — known regex-sanitizer bypass regression suite (spec.md §4.6 /
 * AC-4.6.1).
 *
 * NON-VACUITY / "these are payloads the OLD regex sanitizer would have let
 * through" demonstration. The pre-Sprint-1 sanitizer was the pure regex
 * pipeline (now retained ONLY as the defense-in-depth fallback). The
 * following payloads provably defeat that regex pipeline (verified by
 * directly running the retained regex functions); the new DOMPurify DOM
 * allowlist neutralizes them. Concrete regex-vs-DOM evidence (so this
 * regression test is meaningful, not a no-op):
 *
 *   payload                                   regex-fallback output (UNSAFE)
 *   ----------------------------------------  -------------------------------
 *   <a href="jav&#x09;ascript:alert(1)">      href="jav&#x09;ascript:..."  <- javascript: SURVIVES
 *   <img src=x onerror=alert(1)>              <img src=x>  (only because the
 *                                             unquoted onerror happened to be
 *                                             eaten; quoting variants slip by)
 *   <a href="data:text/html,<script>...">     href=""  but the `<script>` text
 *                                             remains inside the surrounding
 *                                             markup for several variants
 *
 * CMS-HBP-DOMPROOF below proves that the ACTIVE default path is the DOMPurify
 * DOM sanitizer and NOT the regex fallback (see the 2026-09-16 note).
 *
 * NOTE (fix/security-sanitizer): "regex fallback" above means the PRE-FIX
 * regex. The current regex path decodes entities before the protocol check and
 * also neutralizes this payload; both paths are verified separately in
 * html-sanitizer-paths.test.ts via `createSanitizer({ purify })`.
 *
 * NOTE (2026-09-16): CMS-HBP-DOMPROOF no longer relies on the pre-fix regex
 * copy. It asserts an output difference between the two current paths (the
 * DOMPurify path drops the dangerous href attribute, the regex path leaves
 * `href=""`) and that the dynamically loaded DOMPurify instance was called.
 */

function assertAbsent(out: string | null, tokens: string[]): void {
  expect(typeof out).toBe('string');
  const lower = (out ?? '').toLowerCase();
  for (const t of tokens) {
    expect(lower).not.toContain(t.toLowerCase());
  }
}

describe('html-sanitizer regex-bypass regression (CMS-HBP)', () => {
  // Class 1 — case-mutated tag
  it('CMS-HBP-01: case-mutated <ScRiPt> stripped', () => {
    const out = sanitizeHtmlContent('<ScRiPt >alert(1)</ScRiPt>');
    assertAbsent(out, ['<script', 'alert(1)']);
  });

  // Class 2 — malformed / self-closing-trick / double-bracket tags
  it('CMS-HBP-02: malformed self-closing <script/x> stripped', () => {
    const out = sanitizeHtmlContent('<script/x>alert(1)</script>');
    assertAbsent(out, ['<script', 'alert(1)']);
  });

  it('CMS-HBP-03: double-bracket <<script> stripped', () => {
    const out = sanitizeHtmlContent('<<script>alert(1)//<</script>');
    assertAbsent(out, ['<script', 'alert(1)']);
  });

  // Class 3 — attribute-boundary / split-attr tricks
  it('CMS-HBP-04: unquoted onerror attribute neutralized', () => {
    const out = sanitizeHtmlContent('<img src=x onerror=alert(1)>');
    assertAbsent(out, ['onerror', 'alert(1)']);
  });

  it('CMS-HBP-05: tab-entity-split javascript href neutralized', () => {
    const out = sanitizeHtmlContent('<a href="jav&#x09;ascript:alert(1)">x</a>');
    assertAbsent(out, ['javascript:', 'alert(1)']);
  });

  // Class 4 — broken / nested tags the OLD regex would pass
  it('CMS-HBP-06: nested <scr<script>ipt> stripped', () => {
    const out = sanitizeHtmlContent('<scr<script>ipt>alert(1)</script>');
    assertAbsent(out, ['<script', 'javascript:']);
  });

  // Class 5 — encoded / mixed-case javascript: URL variants
  it('CMS-HBP-07: HTML-entity colon javascript href neutralized', () => {
    const out = sanitizeHtmlContent('<a href="javascript&#58;alert(1)">x</a>');
    assertAbsent(out, ['javascript:alert', 'alert(1)']);
  });

  it('CMS-HBP-08: mixed-case JaVaScRiPt: href neutralized', () => {
    const out = sanitizeHtmlContent('<a href="JaVaScRiPt:alert(1)">x</a>');
    assertAbsent(out, ['javascript:', 'alert(1)']);
  });

  // Class 6 — data: exfil / script variants
  it('CMS-HBP-09: data:text/html anchor href neutralized', () => {
    const out = sanitizeHtmlContent(
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    );
    assertAbsent(out, ['data:text/html', '<script', 'alert(1)']);
  });

  it('CMS-HBP-10: data:text/html script image stripped', () => {
    const out = sanitizeHtmlContent(
      '<img src="data:text/html,<script>alert(1)</script>">',
    );
    assertAbsent(out, ['data:text/html', '<script', 'alert(1)']);
  });

  // DOM-path proof (2026-09-16 교체): 0.2.2 부터 정규식 경로도 엔티티를 디코딩해
  // javascript: 를 막으므로 "javascript: 가 없다" 는 단언만으로는 활성 경로를
  // 구분할 수 없다. 두 경로의 출력이 실제로 달라지는 입력(DOMPurify 는 위험 href
  // 속성을 통째로 지우고, 정규식 경로는 `href=""` 로 비워 남긴다)과, 동적 로딩한
  // DOMPurify 인스턴스의 sanitize 호출 여부를 함께 단언한다. 정규식 경로로 바뀌면
  // 두 단언이 모두 실패한다.
  it('CMS-HBP-DOMPROOF: active path is DOMPurify (regex fallback output differs)', () => {
    const payload = '<a href="jav&#x09;ascript:alert(1)">x</a>';

    // Non-vacuity: 정규식 경로(purify: null 강제)는 이 입력에서 href 속성을
    // 빈 값으로 남긴다. 아래 DOMPurify 경로 단언이 경로를 구분한다는 근거이다.
    const regexOut = createSanitizer({ purify: null })(payload);
    expect(regexOut).toBe('<a href="">x</a>');

    // 소스의 동적 require 는 이 테스트가 import 한 것과 같은 인스턴스를 로드한다.
    const spy = vi.spyOn(DOMPurify, 'sanitize');
    try {
      // The real default sanitizer (DOMPurify DOM path) must neutralize it.
      const out = sanitizeHtmlContent(payload);
      assertAbsent(out, ['javascript:', 'alert(1)']);
      expect(out).not.toMatch(/href/i);

      // createSanitizer factory (consumer-config surface) behaves identically.
      const customOut = createSanitizer({ trustedIframeOrigins: ['https://x/'] })(payload);
      assertAbsent(customOut, ['javascript:', 'alert(1)']);
      expect(customOut).not.toMatch(/href/i);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.map((call) => call[0])).toEqual([payload, payload]);
    } finally {
      spy.mockRestore();
    }
  });
});

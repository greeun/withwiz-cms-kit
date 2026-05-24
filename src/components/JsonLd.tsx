/**
 * JSON-LD 구조화 데이터 스크립트 (spec.md §4.6 / Sprint 1 S2).
 *
 * `JSON.stringify(data)` 를 그대로 `<script>` 에 주입하면 `data` 값에 들어 있는
 * `</script>` / `<!--` / `<` / `&` / U+2028 / U+2029 가 스크립트 요소를
 * 탈출(breakout)시켜 저장/반사형 XSS 가 된다. 아래 escapeJsonForScript 가
 * 직렬화 결과를 안전하게 이스케이프한다 (codepoint 기반 — 소스에 비가시
 * 라인 종결자 문자를 두지 않는다). 이스케이프 대상:
 *
 *   U+003C  (escaped to backslash-u003c) -- blocks </script>, <!--, <
 *   U+003E  (escaped to backslash-u003e)
 *   U+0026  (escaped to backslash-u0026)
 *   U+2028  (escaped to backslash-u2028) -- JS string literal break guard
 *   U+2029  (escaped to backslash-u2029)
 *
 * 이 치환들은 JSON 문자열 컨텍스트 안에서 유효한 \uXXXX 이스케이프이므로,
 * 디코드된 스크립트 텍스트를 JSON.parse 하면 원본 data 와 정확히
 * deep-equal 한다 (round-trip 보존).
 */

// 소스에 raw U+2028/U+2029 (JS line terminator) 를 두지 않도록 codepoint 으로
// 문자 클래스를 구성한다.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const JSON_LD_UNSAFE = new RegExp(`[<>&${LS}${PS}]`, 'g');

const JSON_LD_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  [LS]: '\\u2028',
  [PS]: '\\u2029',
};

/**
 * `<script>` 안에 안전하게 넣을 수 있도록 직렬화된 JSON 을 이스케이프한다.
 * 결과는 여전히 유효한 `application/ld+json` 이며 `JSON.parse` 시 원본으로
 * 복원된다.
 */
export function escapeJsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(
    JSON_LD_UNSAFE,
    (ch) => JSON_LD_ESCAPES[ch],
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonForScript(data) }}
    />
  );
}

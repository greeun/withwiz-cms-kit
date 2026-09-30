/**
 * 변형 이미지 경로 계산 내부 헬퍼 (package.json `exports` 에 없는 내부 모듈).
 *
 * 확장자는 경로(또는 저장소 키)의 마지막 세그먼트에서만 찾는다. 이전에는
 * `/\.[^.]+$/` 를 문자열 전체에 적용해 호스트 이름이나 폴더 이름의 점을
 * 확장자로 인식했다 (TC-U-027 결함 이력).
 */

/** 마지막 세그먼트에서 확장자(마지막 `.` 부터 끝까지)가 시작하는 위치. 없으면 -1. */
function extensionStart(path: string): number {
  const segmentStart = path.lastIndexOf('/') + 1;
  const dot = path.lastIndexOf('.');
  return dot >= segmentStart && dot < path.length - 1 ? dot : -1;
}

/**
 * 경로·저장소 키의 마지막 세그먼트에서 확장자를 지운다. 확장자가 없으면 입력을
 * 그대로 돌려준다. 예: `news.v2/abc.jpg` → `news.v2/abc`, `news.v2/abc` → `news.v2/abc`.
 */
export function stripPathExtension(path: string): string {
  const start = extensionStart(path);
  return start === -1 ? path : path.slice(0, start);
}

/**
 * 변형 이미지 키(또는 URL 경로)의 형식 `<base>-<size>.webp`. 변형을 만드는 쪽
 * (`generateImageVariants`)과 지우는 쪽(`getVariantKeys`), 보여주는 쪽
 * (`getVariantUrl`)이 모두 이 함수로 키를 만들어 형식이 갈라지지 않게 한다.
 */
export function buildVariantKey(baseKey: string, size: string): string {
  return `${baseKey}-${size}.webp`;
}

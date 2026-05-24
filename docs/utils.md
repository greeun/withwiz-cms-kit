# Utils

## `adminFetch(url, options?)`

401 응답 시 `/api/admin/auth/refresh` 로 자동 쿠키 갱신 후 **1회 재시도** 하는 fetch 래퍼. 갱신 실패 시 `/admin/login` 으로 리다이렉트합니다.

```ts
import { adminFetch } from '@withwiz/pms/utils';

const res = await adminFetch('/api/admin/news', { method: 'POST', body: JSON.stringify(form) });
```

- `credentials: 'same-origin'` 자동 부여
- 동시 다발 401 요청이 있어도 refresh 는 **단일 in-flight Promise 로 공유**
- `getAuthHeaders()`, `refreshAccessToken()` 는 **Deprecated** — 현재 인증은 httpOnly 쿠키 기반

## `cn(...classes)`

`clsx` + `tailwind-merge` 조합. Tailwind 충돌 클래스를 뒤쪽 선언이 이기도록 병합.

## `date`

```ts
toLocalDatetime(iso): string;      // <input type="datetime-local"> 값
formatDateTime(iso): string;       // 한국어 YYYY. M. D. HH:mm
formatDate(iso): string;           // 한국어 YYYY. M. D.
```

## `html-sanitizer`

Tiptap 에디터가 생성한 HTML 을 서버 저장 전 새니타이즈. 허용 태그/속성 화이트리스트 기반이며, `ResizableImage` 가 쓰는 width 속성은 보존합니다.

```ts
sanitizeHtmlContent(html: string): string;
```

## `api-response` / `api-helpers` / `route-params`

API 라우트 보일러플레이트를 줄이는 헬퍼.

```ts
NextApiResponse.success(data);                        // { success: true, data }
NextApiResponse.error(message, status?);              // { success: false, error: message }

validateIds(body, ['id']);                            // 필수 id 검증
validateAndParse(body, schema);                       // Zod 검증
parseSortKey(raw, allowed, defaultKey);               // sort key 파서

getRouteParam(context, 'id');                         // /[id] 파라미터 추출 (Promise params 대응)
```

## `jwt`

```ts
const jwt = getJWTManager();
jwt.sign(payload, ttl);
jwt.verify(token);
```

토큰 시크릿은 환경변수에서 로드. 자세한 구현은 `@withwiz/toolkit` 의 jwt 모듈에 위임합니다.

## 이미지 관련 유틸

### `image-resize.ts` (브라우저)

```ts
resizeImageIfNeeded(file: File, maxWidth: number): Promise<Blob>;
validateImageSize(file: File, maxBytes: number): string | null;
```

클라이언트 측에서 업로드 전 축소하여 네트워크 부하를 줄입니다.

### `image-variants.ts` (서버)

sharp 기반 WebP variant 생성.

```ts
const variants = await generateImageVariants(buffer, baseKey, contentType);
// → ImageVariant[] : { size, width, buffer, key, contentType }
```

| size | 최대 너비 | 용도 |
|---|---|---|
| `lg` | 1920 | 데스크톱 풀사이즈, 라이트박스 |
| `md` | 960 | 카드, 목록 이미지 |
| `sm` | 480 | 모바일 그리드 썸네일 |
| `thumb` | 240 | 어드민 프리뷰 (항상 생성) |

원본보다 큰 사이즈는 스킵. GIF 는 생성하지 않음.

### `image-variant-utils.ts`

```ts
IMAGE_VARIANT_SIZES; // { lg: 1920, md: 960, sm: 480, thumb: 240 }
getVariantUrl(originalUrl, size);  // 원본 URL → variant URL 계산
```

### `r2-storage.ts`

```ts
isR2Enabled(): boolean;
uploadToR2(key, buffer, contentType): Promise<{ url, key, size }>;
uploadImageWithVariants(key, buffer, contentType): Promise<{
  url, key, size, variants: ImageVariantUrls, variantKeys: string[]
}>;
deleteFromR2(key): Promise<void>;
```

환경변수:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL` — 커스텀 공개 도메인 (없으면 `{bucket}.r2.dev` 사용)

`uploadImageWithVariants` 는 원본 업로드 후 variant 생성/업로드를 병렬 처리합니다. 일부 variant 가 실패해도 원본 업로드 결과는 반환하며, 실패 내역은 `logError` 로 기록합니다.

### `r2-helpers.ts`

Tiptap HTML 에 삽입된 이미지/파일 URL 에서 R2 키만 추출해 고아 객체를 정리합니다.

```ts
extractR2KeysFromHtml(html: string): string[];
collectR2Keys(prevHtml: string, nextHtml: string): string[];   // prev 에만 있는 키
deleteR2Keys(keys: string[]): Promise<void>;
```

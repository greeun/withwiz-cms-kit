# Utils

## 진입점

| 진입점 | 내용 | 용도 |
|---|---|---|
| `@withwiz/cms-kit/utils/client` | 브라우저 유틸(`adminFetch`, `resizeImageIfNeeded` 등) + 공용 유틸 | 클라이언트 컴포넌트 |
| `@withwiz/cms-kit/utils/server` | 서버 유틸(`uploadToR2`, `getJWTManager`, `NextApiResponse` 등) + 공용 유틸 + 설정 API | Route Handler, 서버 컴포넌트, 서비스 |
| `@withwiz/cms-kit/utils` | 위 둘의 합 (이전 버전 호환) | 기존 코드 |
| `@withwiz/cms-kit/utils/<모듈>` | 개별 모듈 | |

공용 유틸은 `cn`, `date`, `html-sanitizer`, `getVariantUrl`, `IMAGE_VARIANT_SIZES` 입니다.
`./utils/client` 는 `@aws-sdk/client-s3`·`sharp`·`next/server`·prisma·toolkit 인증 모듈을
import 경로에 두지 않고, `./utils/server` 는 `window`·`document` 를 쓰는 모듈을 두지
않습니다. 넓은 `./utils` 배럴을 클라이언트 컴포넌트에서 import 하면 서버 전용 모듈이
번들에 들어가므로 `./utils/client` 를 쓰세요.

## `adminFetch(url, options?)`

401 응답 시 `/api/admin/auth/refresh` 로 자동 쿠키 갱신 후 **1회 재시도** 하는 fetch 래퍼. 갱신 실패 시 `/admin/login` 으로 리다이렉트합니다.

```ts
import { adminFetch } from '@withwiz/cms-kit/utils';

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
createSanitizer({ trustedIframeOrigins?, allowedTags?, allowedAttributes?, purify? });
```

- `purify` 에 DOMPurify 인스턴스를 넘기면 동적 로딩(`require('isomorphic-dompurify')`) 대신 그 인스턴스를 씁니다. `null` 은 정규식 경로를 강제하고, 지정하지 않으면 동적 로딩을 시도합니다. Next.js Turbopack 서버 번들처럼 `require` 가 항상 실패하는 환경에서는 인스턴스를 주입해야 DOMPurify 경로로 동작합니다.
- 두 경로 모두 블록 에디터 데이터 주석(`<!-- xbe-blocks:... -->`, `<!-- alpha-data:... -->`, `<!-- beta-data:... -->`, `<!-- nbe-cta-start -->` 등)과 `target` 속성을 보존합니다.
- 정규식 경로는 `script`·`object`·`embed`·`applet`·`form`·`input`·`textarea`·`select`·`button`·`style` 태그(닫는 태그가 없는 경우 포함)와 SVG 애니메이션 요소(`animate`·`animateMotion`·`animateTransform`·`animateColor`·`set`), `meta`·`base`·`link` 태그를 지웁니다. 태그 이름 전체로 비교하므로 `<settings>` 같은 다른 이름의 태그와 본문 텍스트는 바꾸지 않습니다. DOMPurify 경로는 DOMPurify 허용 목록을 따르므로 `animateMotion`·`animateTransform`·`animateColor` 요소는 남기고, 소문자 `href` 가 들어 있는 `attributeName` 과 `to`·`from` 속성, `javascript:` 로 시작하는 `values`·`by` 값을 지웁니다. 값 중간의 `javascript:`(`values="#;javascript:…"`)나 대문자 `attributeName="HREF"` 는 남을 수 있지만, href 를 바꿀 수 있는 조합이 함께 남지는 않습니다.

## `api-response` / `api-helpers` / `route-params`

API 라우트 보일러플레이트를 줄이는 헬퍼.

```ts
NextApiResponse.success(data);                        // { success: true, data }
NextApiResponse.error(message, status?);              // { success: false, error: message }

validateIds(body, ['id']);                            // 필수 id 검증
validateAndParse(body, schema);                       // Zod 검증
parseSortKey(searchParams, allowed, defaultKey);      // sort key 파서 (허용 목록에 없으면 기본값)

getRouteParam(context, 'id');                         // /[id] 파라미터 추출 (Promise params 대응)
```

## `jwt`

```ts
const jwt = getJWTManager();
jwt.sign(payload, ttl);
jwt.verify(token);
```

시크릿·만료·알고리즘은 설정 경계에서 해석합니다 (`setCmsConfig({ jwt })` > `JWT_SECRET`·`JWT_EXPIRES_IN`·`JWT_REFRESH_TOKEN_EXPIRES_IN`). 시크릿이 없거나 32자 미만이면 처음 사용할 때 `@withwiz/cms-kit:` 에러를 던집니다. 자세한 구현은 `@withwiz/toolkit` 의 jwt 모듈에 위임합니다.

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

확장자는 URL 경로의 마지막 세그먼트에서만 찾습니다. 확장자가 없으면 원본 URL 을 그대로 돌려주고, 쿼리 문자열과 해시는 파일 이름만 바꾼 뒤 그대로 붙입니다 (`…/photo.jpg?v=1` → `…/photo-thumb.webp?v=1`). `getVariantKeys()` 와 `uploadImageWithVariants()` 의 기준 키도 같은 규칙으로 계산하므로 `news.v2/abc` 의 변형 키는 `news.v2/abc-thumb.webp` 등입니다.

### `r2-storage.ts`

```ts
isR2Enabled(): boolean;   // 백엔드 주입 또는 R2 자격 증명 완비
uploadToR2(key, buffer, contentType): Promise<{ url, key, size }>;
uploadImageWithVariants(key, buffer, contentType): Promise<{
  url, key, size,
  variants: ImageVariantUrls, variantKeys: string[],
  variantStatus: 'complete' | 'partial' | 'failed' | 'skipped',
  failedVariants: VariantSize[],
}>;
deleteFromR2(key): Promise<void>;
```

자격 증명은 `setCmsConfig({ storage: { r2 } })` 또는 legacy 환경변수로 지정합니다.

| 주입 키 | 환경변수 | 설명 |
|---|---|---|
| `storage.r2.accountId` | `R2_ACCOUNT_ID` | Cloudflare endpoint `<accountId>.r2.cloudflarestorage.com` 구성 |
| `storage.r2.endpoint` | — | S3 호환 endpoint. 지정하면 `accountId` 가 필요 없고 path-style 주소를 쓴다 |
| `storage.r2.region` | — | S3 서명 region (기본 `auto`) |
| `storage.r2.accessKeyId` | `R2_ACCESS_KEY_ID` | |
| `storage.r2.secretAccessKey` | `R2_SECRET_ACCESS_KEY` | |
| `storage.r2.bucketName` | `R2_BUCKET_NAME` | |
| `storage.publicBaseUrl` | `R2_PUBLIC_URL` | 공개 URL prefix. 없으면 `<endpoint>/<bucket>`(endpoint 주입 시) 또는 `https://<bucket>.r2.dev` |

`@aws-sdk/client-s3` 는 기본 R2/S3 경로로 실제 업로드·삭제할 때 불러옵니다. 설치되어
있지 않으면 그 시점에 `@withwiz/cms-kit:` 에러를 던집니다.

#### 저장소 백엔드 주입

R2/S3 대신 다른 저장소를 쓰려면 백엔드를 주입합니다. 주입하면 `@aws-sdk/client-s3` 를
로드하지 않습니다. 키는 백엔드에 넘기기 전에 검증합니다(경로 탈출·절대 경로 거부).

```ts
import { setCmsConfig, type CmsStorageBackend } from '@withwiz/cms-kit/config';

const backend: CmsStorageBackend = {
  put: (key, body, contentType) => myStore.put(key, body, { contentType }),
  delete: (key) => myStore.remove(key),
  publicUrl: (key) => `https://media.example.com/${key}`, // 생략하면 storage.publicBaseUrl 사용
};
setCmsConfig({ storage: { backend } });
```

`publicUrl` 도 `storage.publicBaseUrl` 도 없으면 업로드 전에 에러를 던집니다.

#### 변형 업로드 결과

`uploadImageWithVariants` 는 원본을 올린 뒤 변형을 병렬로 만들고 올립니다. 원본 업로드가
실패하면 예외를 던지고, 변형 처리 결과는 `variantStatus` 로 알립니다.

| `variantStatus` | 의미 |
|---|---|
| `complete` | 만든 변형을 모두 올렸다 |
| `partial` | 일부 변형 업로드가 실패했다 (`failedVariants` 에 크기 목록) |
| `failed` | 변형 생성이 실패했거나 하나도 올리지 못했다 |
| `skipped` | 만들 변형이 없다 (GIF 등) |

실패 내역은 `logError` 로도 기록합니다.

### `r2-helpers.ts`

Tiptap HTML 에 삽입된 이미지/파일 URL 에서 R2 키만 추출해 고아 객체를 정리합니다.

```ts
extractR2KeysFromHtml(html: string): string[];
collectR2Keys(prevHtml: string, nextHtml: string): string[];   // prev 에만 있는 키
deleteR2Keys(keys: string[]): Promise<void>;
```

**호스트 검증:** 절대 URL 은 우리 스토리지의 공개 origin 으로 시작할 때만 키로 인정합니다. 인정되는 base 는 `storage.publicBaseUrl`, legacy `R2_PUBLIC_URL`, 자격 증명에서 유도한 `https://<bucket>.r2.dev` 이며, 비교는 경계(`base` 또는 `base/…`)를 지킵니다. 상대 경로(`/news/x.jpg`)는 같은 origin 으로 간주합니다. 외부 호스트를 가리키는 `<img src="https://attacker.example/news/x.jpg">` 는 경로가 그럴듯해도 수집하지 않으므로, 편집 권한자가 본문에 외부 이미지를 넣는 것만으로 다른 글의 객체를 삭제시킬 수 없습니다. `inlineKeyPrefixes` 는 호스트 검증을 통과한 키에 추가로 적용됩니다.

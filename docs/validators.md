# Validators

공통 Zod 스키마. 도메인 검증 스키마(`src/lib/validators/*`)에서 조합해 사용합니다.

```ts
import { slugSchema, optionalUrlSchema } from '@withwiz/pms/validators';
```

## `slugSchema`

URL-safe slug 문자열.

```ts
slugSchema = z.string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
```

- 허용: 소문자 알파벳, 숫자, 하이픈
- 금지: 대문자, 언더스코어, 공백, 연속 하이픈, 시작/끝 하이픈

## `optionalUrlSchema`

비어 있거나, 안전한 프로토콜의 URL 만 허용.

```ts
optionalUrlSchema = safeUrl.optional().or(z.literal(''));
```

차단 프로토콜:
- `file:` — 로컬 파일 접근
- `javascript:` — XSS
- `data:` — 인라인 데이터 URI (악용 가능성)

탭/개행/캐리지리턴은 제거한 뒤 소문자 비교하므로 `jav\tascript:` 같은 우회 시도도 막습니다.

## 조합 예

```ts
// src/lib/validators/news.ts
import { z } from 'zod';
import { slugSchema, optionalUrlSchema } from '@withwiz/pms/validators';

export const newsInputSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
  body: z.string(),
  coverUrl: optionalUrlSchema,
  externalLink: optionalUrlSchema,
  publishedAt: z.string().datetime().optional(),
  isPublished: z.boolean().default(false),
});

export type NewsInput = z.infer<typeof newsInputSchema>;
```

# Testing

`@withwiz/cms-kit` 는 Vitest 기반 자체 테스트 스위트를 갖습니다. 패키지 루트의 `vitest.config.ts` 가 두 프로젝트를 정의하고, 패키지 안에서 단일 명령으로 전체 스위트를 실행합니다. `@withwiz/cms-kit/*` import 는 테스트에서 `src/` 로 해석됩니다.

도메인별 시나리오·케이스, 파일별 테스트 수, 실측 결과는 [testing/test-classification.md](./testing/test-classification.md) 가 현행 기준입니다. 이 문서는 실행 방법과 작성 규칙만 다룹니다.

| Project | 환경 | 포함 경로 | 제외 |
|---|---|---|---|
| `cms-kit` | node | `tests/**/*.test.{ts,tsx}` | `**/*.dom.test.*` |
| `cms-kit-dom` | jsdom | `tests/**/*.dom.test.{ts,tsx}` | — |

두 프로젝트 모두 `tests/setup.ts` 를 셋업 파일로 쓰고, node 프로젝트는 `@withwiz/toolkit` 을 인라인 의존성으로 변환합니다.

## 실행

```bash
# 전체 스위트(cms-kit + cms-kit-dom)
npm test

# watch 모드
npm run test:watch

# 개별 프로젝트 (진단용)
npx vitest run --project cms-kit
npx vitest run --project cms-kit-dom
```

`tests/smoke/pure-node-esm.test.ts` 는 빌드 산출물(`dist/`)을 검사하므로 `dist/index.mjs` 가 없으면 테스트가 먼저 `npm run build` 를 실행합니다.

## 디렉터리

```
tests/
├── setup.ts          # 공통 셋업
├── spec.md           # 초기 구현 작업 계획서 (과거 기록, 현행 목록은 test-classification.md)
├── integration/      # 여러 모듈을 조합하는 테스트
├── smoke/            # 빌드 산출물 검사 (순수 Node ESM 소비 범위 등)
├── *.dom.test.ts(x)  # jsdom 이 필요한 훅·컴포넌트 테스트
└── *.test.ts         # node 환경 테스트
```

파일 목록과 파일별 테스트 수는 test-classification.md 의 파일 대조표를 봅니다.

## 작성 규칙

- **DOM 이 필요한 훅·컴포넌트 테스트**는 파일명에 `.dom.test` 를 포함해야 `cms-kit-dom` 프로젝트에 편입됩니다.
- **Prisma 테스트**는 `prisma-di.test.ts` 처럼 `setPrismaClient` 로 mock 을 주입합니다. 이 패키지의 테스트는 실제 DB 에 접속하지 않습니다.
- **R2 네트워크 호출**은 `@aws-sdk/client-s3` 를 `vi.mock` 으로 대체합니다. 실제 업로드는 이 패키지의 테스트 범위 밖입니다.
- **토큰·서명**은 `jose` 를 실제로 호출합니다. mock 하지 않습니다.
- **소비 프로젝트 문구**(이 패키지를 쓰는 앱의 이름·브랜드·도메인 용어)는 테스트 데이터에도 쓰지 않습니다. 업종과 무관한 중립 값을 씁니다.

## 공통 셋업 (`tests/setup.ts`)

- `process.env.NODE_ENV = 'test'`
- `RATE_LIMIT_ENABLED` 가 지정되지 않았으면 `'false'` 로 둡니다(rate limiter 비활성). 이미 지정된 값은 그대로 존중합니다.
- `next/cache` 의 `revalidatePath`·`revalidateTag` 를 `vi.fn()` 으로 대체합니다.
- 그 밖의 환경변수가 필요한 테스트는 `vi.stubEnv` 를 씁니다.
- `setPrismaClient` 는 각 테스트 파일에서 필요할 때 호출합니다. 셋업에서 주입하면 mock 이 고착될 위험이 있습니다.

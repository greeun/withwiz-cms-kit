# Testing

`@withwiz/pms` 는 Vitest 기반 자체 테스트 스위트를 갖습니다. 루트 `vitest.config.ts` 의 projects 에 두 개의 프로젝트로 등록되어 있습니다.

| Project | 환경 | 포함 경로 | 제외 |
|---|---|---|---|
| `pms` | node | `packages/pms/tests/**/*.test.ts` | `*.dom.test.*` |
| `pms-dom` | jsdom | `packages/pms/tests/**/*.dom.test.{ts,tsx}` | — |

## 실행

### 로컬 자체 실행 (패키지 내부, 권장)

`@withwiz/pms` 는 자체 포함형(self-contained) 로컬 Vitest 러너를 가집니다.
패키지 루트(`node-packages/withwiz-pms/`)에 `vitest.config.ts` 가 있으며,
루트 모노레포 config 없이 패키지 안에서 단일 명령으로 전체 스위트를
실행할 수 있습니다. `@withwiz/pms/*` import 별칭은 `src/` 로 해석됩니다.

```bash
# 전체 스위트(두 프로젝트 pms + pms-dom) 한 번에 실행 — 문서화된 단일 명령
npm test

# (선택) watch 모드
npm run test:watch

# 개별 프로젝트 (진단용)
npx vitest run --project pms
npx vitest run --project pms-dom
```

`npm test` 는 `vitest run` 으로, 로컬 `vitest.config.ts` 의
`test.projects` 에 정의된 `pms`(node) 와 `pms-dom`(jsdom) 두 프로젝트를
모두 실행합니다. 아래 표의 프로젝트 이름·환경·포함/제외 경로 규칙은
그대로 유지됩니다.

### 모노레포 루트 실행 (참고)

```bash
# 패키지 테스트만 실행
npx vitest --project pms --project pms-dom

# 개별 프로젝트
npx vitest --project pms-dom
```

루트 `npm run test` 는 전체 project 를 실행합니다.

## 디렉터리

```
packages/pms/tests/
├── setup.ts                       # 공통 셋업 (Prisma mock, env 초기화)
├── spec.md                        # 테스트 범위 명세
├── integration/
│   ├── middleware-wrappers.test.ts
│   ├── prisma-service-flow.test.ts
│   └── r2-pipeline.test.ts
├── admin-fetch.dom.test.ts
├── ImageDropUpload.dom.test.tsx
├── JsonLd.dom.test.tsx
├── ToggleSwitch.dom.test.tsx
├── useAdminForm.dom.test.ts
├── useAdminList.dom.test.ts
├── useImageDropZone.dom.test.ts
├── useScrollReveal.dom.test.ts
├── api-helpers.test.ts
├── api-response.test.ts
├── base-service.test.ts
├── cn.test.ts
├── date.test.ts
├── html-sanitizer.test.ts
├── image-resize.dom.test.ts
├── image-variants.test.ts
├── image-variant-utils.test.ts
├── jwt.test.ts
├── pagination.test.ts
├── prisma-di.test.ts
├── r2-helpers.test.ts
├── r2-storage.test.ts
├── route-params.test.ts
└── shared-validators.test.ts
```

## 작성 규칙

- **DOM이 필요한 훅/컴포넌트 테스트**는 파일명에 `.dom.test` 를 포함해야 `pms-dom` project 에 편입됩니다.
- **Prisma 테스트**는 `prisma-di.test.ts` 처럼 `setPrismaClient` 로 mock 을 주입하는 패턴을 따르세요. 실제 DB 접근은 루트 `tests/03-integration/` 에서 수행합니다.
- **R2 네트워크 호출**은 `@aws-sdk/client-s3` 를 vi.mock 으로 대체합니다. 실제 업로드 검증은 루트 통합 스위트에서만.
- **토큰/시그니처**는 `jose` 를 실제 호출 (inline dep) — mock 하지 말 것.

## 공통 셋업 (`tests/setup.ts`)

- `process.env.RATE_LIMIT_ENABLED = 'false'` — rate limiter 비활성화
- 환경변수가 요구되는 테스트는 `vi.stubEnv` 사용 권장
- `setPrismaClient` 는 각 테스트 파일에서 필요 시 호출 (setup 에서 주입하면 mock 고착 위험)

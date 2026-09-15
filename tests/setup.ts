import { vi } from 'vitest';

process.env.NODE_ENV = 'test';

// docs/testing.md "공통 셋업": 스위트 전체의 기본 전제는 rate-limit 비활성이다.
// 명시한 값이 있으면 그 값을 존중한다. (이전에는 gitignore 대상 셋업 파일이
// 이 값을 지정해 새로 받은 체크아웃에서 스위트가 로드되지 않았다. TC-SM-005)
if (process.env.RATE_LIMIT_ENABLED === undefined) {
  process.env.RATE_LIMIT_ENABLED = 'false';
}

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

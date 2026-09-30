/**
 * Prisma 클라이언트 주입 (spec.md §4.3 / §4.7).
 *
 * cms-kit 은 소비자의 Prisma 스키마를 모르므로 클라이언트 타입을 고정할 수
 * 없다. 소비자는 모듈 보강으로 자신의 클라이언트 타입을 등록해 `prisma`/
 * `getPrisma()` 를 타입 있는 상태로 쓸 수 있다:
 *
 * ```ts
 * import type { PrismaClient } from '@prisma/client';
 * declare module '@withwiz/cms-kit/infrastructure/prisma' {
 *   interface CmsPrismaRegistry { client: PrismaClient }
 * }
 * ```
 *
 * 등록하지 않으면 이전 버전과 같이 타입 검사 없는 클라이언트로 취급한다
 * (`UntypedPrismaClient`). `getPrisma<T>()` 로 호출 지점에서 타입을 지정할 수도 있다.
 */

/** 소비자가 모듈 보강으로 `client` 타입을 등록하는 자리. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CmsPrismaRegistry {}

/**
 * 타입을 등록하지 않았을 때의 클라이언트 타입. 스키마를 모르는 상태에서
 * 기존 소비자 코드(`prisma.post.findMany(...)`)가 계속 컴파일되도록 둔다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedPrismaClient = any;

/** 등록된 Prisma 클라이언트 타입 (미등록 시 `UntypedPrismaClient`). */
export type CmsPrismaClient = CmsPrismaRegistry extends { client: infer C }
  ? C
  : UntypedPrismaClient;

let _prisma: object | null = null;

export function setPrismaClient<T extends object = CmsPrismaClient>(client: T): void {
  _prisma = client;
}

export function getPrisma<T = CmsPrismaClient>(): T {
  if (!_prisma) {
    throw new Error(
      '@withwiz/cms-kit: Prisma client not initialized. Call setPrismaClient() first.'
    );
  }
  return _prisma as T;
}

/** 첫 속성 접근 시점에 주입된 클라이언트로 위임하는 지연 프록시. */
export const prisma: CmsPrismaClient = new Proxy(
  {},
  {
    get(_target, prop) {
      return (getPrisma<Record<PropertyKey, unknown>>())[prop];
    },
  },
) as CmsPrismaClient;

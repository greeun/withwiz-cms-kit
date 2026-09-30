// CMS-TY 타입 픽스처: 모듈 보강으로 등록한 클라이언트 타입이 공개 접근자에 반영된다.
import { getPrisma, prisma, setPrismaClient } from '@withwiz/cms-kit/infrastructure/prisma';
import { prisma as prismaFromBarrel } from '@withwiz/cms-kit/infrastructure';

interface FakeClient {
  post: { count(): number };
}

declare module '@withwiz/cms-kit/infrastructure/prisma' {
  interface CmsPrismaRegistry {
    client: FakeClient;
  }
}

export const n: number = prisma.post.count();
export const m: number = prismaFromBarrel.post.count();
export const c: FakeClient = getPrisma();
// @ts-expect-error 등록한 클라이언트에 없는 모델은 타입 오류다
export const x = prisma.nope;
setPrismaClient({ post: { count: () => 1 } });

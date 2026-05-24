import { vi, beforeEach } from 'vitest';

// 각 테스트마다 모듈 상태를 초기화하기 위해 dynamic import 사용
describe('prisma DI 패턴', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('PMS-PR-01: 초기화 전 getPrisma() → Error throw', async () => {
    const { getPrisma } = await import('@withwiz/pms/infrastructure/prisma');
    expect(() => getPrisma()).toThrow('Prisma client not initialized');
  });

  it('PMS-PR-02: setPrismaClient() 후 getPrisma() → 동일 인스턴스', async () => {
    const { setPrismaClient, getPrisma } = await import('@withwiz/pms/infrastructure/prisma');
    const mockClient = { user: { findMany: vi.fn() } };
    setPrismaClient(mockClient);
    expect(getPrisma()).toBe(mockClient);
  });

  it('PMS-PR-03: prisma Proxy → 프로퍼티 접근 위임', async () => {
    const { setPrismaClient, prisma } = await import('@withwiz/pms/infrastructure/prisma');
    const mockClient = { user: { findMany: vi.fn().mockResolvedValue([]) } };
    setPrismaClient(mockClient);
    expect(prisma.user).toBe(mockClient.user);
  });

  it('PMS-PR-04: setPrismaClient 두 번 호출 → 마지막 인스턴스 사용', async () => {
    const { setPrismaClient, getPrisma } = await import('@withwiz/pms/infrastructure/prisma');
    const first = { id: 1 };
    const second = { id: 2 };
    setPrismaClient(first);
    setPrismaClient(second);
    expect(getPrisma()).toBe(second);
  });
});

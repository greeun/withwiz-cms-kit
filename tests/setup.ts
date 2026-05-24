import { vi } from 'vitest';

process.env.NODE_ENV = 'test';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

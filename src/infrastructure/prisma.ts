/* eslint-disable @typescript-eslint/no-explicit-any */

let _prisma: any = null;

export function setPrismaClient(client: any) {
  _prisma = client;
}

export function getPrisma(): any {
  if (!_prisma) {
    throw new Error(
      '@withwiz/cms-kit: Prisma client not initialized. Call setPrismaClient() first.'
    );
  }
  return _prisma;
}

export const prisma: any = new Proxy({}, {
  get(_target, prop) {
    return getPrisma()[prop];
  },
});

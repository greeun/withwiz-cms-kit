// CMS-TY 타입 픽스처: getPrisma<T>() 로 호출 지점에서 타입을 지정할 수 있다.
import { getPrisma } from '@withwiz/cms-kit/infrastructure/prisma';

interface Db {
  user: { find(id: string): { id: string } };
}

export const id: string = getPrisma<Db>().user.find('1').id;
// @ts-expect-error 지정한 타입에 없는 모델은 타입 오류다
getPrisma<Db>().post;

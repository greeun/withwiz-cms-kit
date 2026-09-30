// CMS-TY 타입 픽스처: 래퍼는 toolkit 의 TApiHandler 를 받고 route handler 를 돌려준다.
import { NextResponse, type NextRequest } from 'next/server';
import { withPublicApi, withCustomApi, type IApiContext } from '@withwiz/cms-kit/infrastructure/middleware/wrappers';

export const GET = withPublicApi(async (context: IApiContext) => NextResponse.json({ id: context.requestId }));
export const POST = withCustomApi(async () => NextResponse.json({}), (chain) => chain);
export const call: Promise<Response> = GET({} as NextRequest);

// @ts-expect-error 핸들러가 아닌 값은 받지 않는다
withPublicApi('not a handler');

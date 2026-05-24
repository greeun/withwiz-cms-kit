import { NextResponse } from 'next/server';

export class NextApiResponse {
  static success<T>(data: T, status: number = 200) {
    return NextResponse.json({ success: true, data }, { status });
  }

  static paginated<T>(
    items: T[],
    page: number,
    pageSize: number,
    total: number,
    dataKey: string = 'items',
  ) {
    const totalPages = Math.ceil(total / pageSize);
    return this.success({
      [dataKey]: items,
      pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages },
    });
  }

  static created<T>(data: T) {
    return this.success(data, 201);
  }

  static noContent() {
    return new NextResponse(null, { status: 204 });
  }

  static error(message: string, status: number = 400, code?: string) {
    return NextResponse.json(
      { success: false, error: { message, ...(code && { code }) } },
      { status },
    );
  }

  static notFound(message: string = 'Not Found') {
    return this.error(message, 404, 'NOT_FOUND');
  }

  static unauthorized(message: string = 'Unauthorized') {
    return this.error(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden') {
    return this.error(message, 403, 'FORBIDDEN');
  }

  static serverError(message: string = 'Internal Server Error') {
    return this.error(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

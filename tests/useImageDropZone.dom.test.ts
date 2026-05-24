import { vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@withwiz/pms/utils/admin-fetch', () => ({
  adminFetch: vi.fn(),
}));

vi.mock('@withwiz/pms/utils/image-resize', () => ({
  resizeImageIfNeeded: vi.fn(),
  validateImageSize: vi.fn().mockReturnValue(null),
}));

import { useImageDropZone } from '@withwiz/pms/hooks/useImageDropZone';
import { adminFetch } from '@withwiz/pms/utils/admin-fetch';
import { resizeImageIfNeeded } from '@withwiz/pms/utils/image-resize';

const mockAdminFetch = vi.mocked(adminFetch);
const mockResize = vi.mocked(resizeImageIfNeeded);

function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

function createFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
  } as unknown as FileList;
  for (let i = 0; i < files.length; i++) {
    (list as any)[i] = files[i];
  }
  return list;
}

describe('useImageDropZone 훅', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본 리사이즈 mock: 원본 그대로 반환
    mockResize.mockImplementation(async (file: File) => ({
      file,
      wasResized: false,
      originalSize: file.size,
      newSize: file.size,
    }));
  });

  it('PMS-UIDZ-01: 초기 상태 - isDragOver=false, isUploading=false, error=null', () => {
    const { result } = renderHook(() =>
      useImageDropZone({ onUpload: vi.fn() }),
    );
    expect(result.current.isDragOver).toBe(false);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.isResizing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('PMS-UIDZ-02: 유효한 이미지 파일 → onUpload 호출 (URL 포함)', async () => {
    const onUpload = vi.fn();
    const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

    mockAdminFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: { url: 'https://cdn.r2.dev/news/photo.jpg', key: 'news/photo.jpg', size: 1024 },
      }),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useImageDropZone({ onUpload }),
    );

    await act(async () => {
      await result.current.handleFileInput(createFileList([file]));
    });

    expect(onUpload).toHaveBeenCalledWith({
      url: 'https://cdn.r2.dev/news/photo.jpg',
      key: 'news/photo.jpg',
      size: 1024,
    });
  });

  it('PMS-UIDZ-03: 지원하지 않는 파일 형식 → error 설정', async () => {
    const file = createMockFile('doc.pdf', 1024, 'application/pdf');

    const { result } = renderHook(() =>
      useImageDropZone({ onUpload: vi.fn() }),
    );

    await act(async () => {
      await result.current.handleFileInput(createFileList([file]));
    });

    expect(result.current.error).toContain('지원하지 않는 파일 형식');
  });

  it('PMS-UIDZ-04: maxFiles 초과 시 잘라내기 후 처음 N개만 업로드', async () => {
    const onUpload = vi.fn();
    const files = [
      createMockFile('a.jpg', 1024, 'image/jpeg'),
      createMockFile('b.jpg', 1024, 'image/jpeg'),
      createMockFile('c.jpg', 1024, 'image/jpeg'),
    ];

    mockAdminFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: { url: 'https://cdn.r2.dev/news/a.jpg', key: 'news/a.jpg', size: 1024 },
      }),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useImageDropZone({ onUpload, multiple: true, maxFiles: 2 }),
    );

    await act(async () => {
      await result.current.handleFileInput(createFileList(files));
    });

    // maxFiles=2이므로 3개 중 2개만 업로드됨
    expect(onUpload).toHaveBeenCalledTimes(2);
    // adminFetch도 2번만 호출 (upload 2개)
    expect(mockAdminFetch).toHaveBeenCalledTimes(2);
  });

  it('PMS-UIDZ-05: disabled=true → handleFileInput 아무 동작 안 함', async () => {
    const onUpload = vi.fn();
    const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

    const { result } = renderHook(() =>
      useImageDropZone({ onUpload, disabled: true }),
    );

    await act(async () => {
      await result.current.handleFileInput(createFileList([file]));
    });

    expect(onUpload).not.toHaveBeenCalled();
    expect(mockAdminFetch).not.toHaveBeenCalled();
  });

  it('PMS-UIDZ-06: dragHandlers 존재 확인', () => {
    const { result } = renderHook(() =>
      useImageDropZone({ onUpload: vi.fn() }),
    );

    expect(result.current.dragHandlers).toBeDefined();
    expect(typeof result.current.dragHandlers.onDragEnter).toBe('function');
    expect(typeof result.current.dragHandlers.onDragOver).toBe('function');
    expect(typeof result.current.dragHandlers.onDragLeave).toBe('function');
    expect(typeof result.current.dragHandlers.onDrop).toBe('function');
  });

  it('PMS-UIDZ-07: configured upload endpoint used (§4.1 C2)', async () => {
    const { setPmsConfig, resetPmsConfig } = await import('@withwiz/pms/config');
    resetPmsConfig();
    setPmsConfig({ routes: { uploadEndpoint: '/custom/files/upload' } });

    const onUpload = vi.fn();
    const file = createMockFile('photo.jpg', 1024, 'image/jpeg');
    mockAdminFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: { url: 'https://cdn/x.jpg', key: 'x.jpg', size: 1024 },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useImageDropZone({ onUpload }));
    await act(async () => {
      await result.current.handleFileInput(createFileList([file]));
    });

    expect(mockAdminFetch).toHaveBeenCalled();
    const url = mockAdminFetch.mock.calls[0][0];
    expect(url).toBe('/custom/files/upload');
    expect(String(url)).not.toContain('/api/admin/upload');

    resetPmsConfig();
  });
});

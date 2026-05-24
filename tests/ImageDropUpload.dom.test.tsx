import { vi } from 'vitest';

vi.mock('@withwiz/pms/components/image-drop-zone.css', () => ({}));

// useImageDropZone mock - 상태를 외부에서 제어
const mockDragHandlers = {
  onDragEnter: vi.fn(),
  onDragOver: vi.fn(),
  onDragLeave: vi.fn(),
  onDrop: vi.fn(),
};

const defaultDropState = {
  isDragOver: false,
  isUploading: false,
  isResizing: false,
  error: null as string | null,
  dragHandlers: mockDragHandlers,
  handleFileInput: vi.fn(),
};

let dropState = { ...defaultDropState };

vi.mock('@withwiz/pms/hooks/useImageDropZone', () => ({
  useImageDropZone: () => dropState,
}));

import { render, screen } from '@testing-library/react';
import ImageDropUpload from '@withwiz/pms/components/ImageDropUpload';

describe('ImageDropUpload 컴포넌트', () => {
  beforeEach(() => {
    dropState = {
      isDragOver: false,
      isUploading: false,
      isResizing: false,
      error: null,
      dragHandlers: mockDragHandlers,
      handleFileInput: vi.fn(),
    };
  });

  it('PMS-IDU-01: src 제공 시 이미지 렌더링', () => {
    const { container } = render(
      <ImageDropUpload src="https://cdn.example.com/img.jpg" onUpload={vi.fn()} />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/img.jpg');
  });

  it('PMS-IDU-02: src 미제공 시 placeholder 표시', () => {
    const { container } = render(
      <ImageDropUpload src="" onUpload={vi.fn()} />,
    );
    const placeholder = container.querySelector('.dz-placeholder');
    expect(placeholder).not.toBeNull();
  });

  it('PMS-IDU-03: 드래그 오버 시 오버레이 표시', () => {
    dropState.isDragOver = true;
    const { container } = render(
      <ImageDropUpload src="" onUpload={vi.fn()} />,
    );
    const hint = container.querySelector('.dz-drag-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe('놓으세요');
  });

  it('PMS-IDU-04: 업로드 중 스피너 표시', () => {
    dropState.isUploading = true;
    const { container } = render(
      <ImageDropUpload src="" onUpload={vi.fn()} />,
    );
    const spinner = container.querySelector('.dz-upload-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.textContent).toBe('업로드 중...');
  });

  it('PMS-IDU-05: 에러 발생 시 에러 메시지 표시', () => {
    dropState.error = '파일 형식 오류';
    const { container } = render(
      <ImageDropUpload src="" onUpload={vi.fn()} />,
    );
    const errorEl = container.querySelector('.dz-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe('파일 형식 오류');
  });

  it('PMS-IDU-06: 리사이징 중 최적화 스피너 표시', () => {
    dropState.isResizing = true;
    const { container } = render(
      <ImageDropUpload src="" onUpload={vi.fn()} />,
    );
    const spinner = container.querySelector('.dz-upload-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.textContent).toBe('최적화 중...');
  });

  it('PMS-IDU-07: is-drag-over 클래스 적용', () => {
    dropState.isDragOver = true;
    const { container } = render(
      <ImageDropUpload src="" onUpload={vi.fn()} className="my-zone" />,
    );
    // 컨테이너 div의 className에 is-drag-over 포함
    const zone = container.querySelector('.is-drag-over');
    expect(zone).not.toBeNull();
  });
});

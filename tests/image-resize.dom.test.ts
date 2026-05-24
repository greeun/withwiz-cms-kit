import { validateImageSize, resizeImageIfNeeded } from '@withwiz/pms/utils/image-resize';

function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('validateImageSize', () => {
  it('PMS-IR-01: 50MB 초과 → 에러 메시지', () => {
    const file = createMockFile('big.jpg', 51 * 1024 * 1024, 'image/jpeg');
    const result = validateImageSize(file);
    expect(result).not.toBeNull();
    expect(result).toContain('50MB');
  });

  it('PMS-IR-02: GIF 5MB 초과 → 에러 메시지', () => {
    const file = createMockFile('anim.gif', 6 * 1024 * 1024, 'image/gif');
    const result = validateImageSize(file);
    expect(result).not.toBeNull();
    expect(result).toContain('GIF');
  });

  it('PMS-IR-03: 정상 파일 → null', () => {
    const file = createMockFile('ok.jpg', 1 * 1024 * 1024, 'image/jpeg');
    expect(validateImageSize(file)).toBeNull();
  });
});

describe('resizeImageIfNeeded', () => {
  it('PMS-IR-04: GIF → wasResized=false', async () => {
    const file = createMockFile('anim.gif', 100 * 1024, 'image/gif');
    const result = await resizeImageIfNeeded(file);
    expect(result.wasResized).toBe(false);
    expect(result.file).toBe(file);
  });

  it('PMS-IR-05: 500KB 이하 + 작은 이미지 → 리사이즈 스킵', async () => {
    // jsdom에서는 Image/Canvas가 제한적이므로 GIF 경로로 스킵 확인만
    // 실제 canvas 기반 리사이즈는 브라우저 환경에서 통합 테스트
    const file = createMockFile('small.gif', 100 * 1024, 'image/gif');
    const result = await resizeImageIfNeeded(file);
    expect(result.wasResized).toBe(false);
    expect(result.originalSize).toBe(file.size);
    expect(result.newSize).toBe(file.size);
  });
});

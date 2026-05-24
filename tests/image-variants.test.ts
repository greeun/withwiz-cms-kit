import { vi } from 'vitest';

const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from('variant-data'));
const mockWebp = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockResize = vi.fn().mockReturnValue({ webp: mockWebp });
const mockMetadata = vi.fn();
const mockSharpInstance = {
  metadata: mockMetadata,
  resize: mockResize,
  webp: mockWebp,
  toBuffer: mockToBuffer,
};

vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}));

import { generateImageVariants } from '@withwiz/pms/utils/image-variants';

describe('generateImageVariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PMS-IMV-01: GIF 입력 → 빈 배열 반환', async () => {
    const result = await generateImageVariants(Buffer.from('gif'), 'news/test', 'image/gif');
    expect(result).toEqual([]);
  });

  it('PMS-IMV-02: 정상 이미지 → lg/md/sm/thumb variant 생성', async () => {
    mockMetadata.mockResolvedValue({ width: 3000 });
    const result = await generateImageVariants(Buffer.from('img'), 'news/test', 'image/jpeg');
    const sizes = result.map((v) => v.size);
    expect(sizes).toContain('lg');
    expect(sizes).toContain('md');
    expect(sizes).toContain('sm');
    expect(sizes).toContain('thumb');
  });

  it('PMS-IMV-03: 원본보다 큰 사이즈 스킵 (thumb 제외)', async () => {
    // 원본 width=500 → lg(1920), md(960) 스킵, sm(480) 스킵 (480 < 500이므로 포함)
    // thumb(240)은 항상 생성
    mockMetadata.mockResolvedValue({ width: 500 });
    const result = await generateImageVariants(Buffer.from('img'), 'news/small', 'image/jpeg');
    const sizes = result.map((v) => v.size);
    expect(sizes).not.toContain('lg');
    expect(sizes).not.toContain('md');
    expect(sizes).toContain('thumb');
  });

  it('PMS-IMV-04: key 패턴 - {baseKey}-{size}.webp', async () => {
    mockMetadata.mockResolvedValue({ width: 3000 });
    const result = await generateImageVariants(Buffer.from('img'), 'news/photo', 'image/jpeg');
    for (const v of result) {
      expect(v.key).toMatch(new RegExp(`^news/photo-${v.size}\\.webp$`));
    }
  });

  it('PMS-IMV-05: contentType 항상 image/webp', async () => {
    mockMetadata.mockResolvedValue({ width: 3000 });
    const result = await generateImageVariants(Buffer.from('img'), 'news/photo', 'image/png');
    for (const v of result) {
      expect(v.contentType).toBe('image/webp');
    }
  });
});

import sharp from 'sharp';

export { IMAGE_VARIANT_SIZES } from './image-variant-utils';
export type { VariantSize } from './image-variant-utils';
import { IMAGE_VARIANT_SIZES, type VariantSize } from './image-variant-utils';

export interface ImageVariant {
  size: VariantSize;
  width: number;
  buffer: Buffer;
  key: string;
  contentType: string;
}

export async function generateImageVariants(
  buffer: Buffer,
  baseKey: string,
  contentType: string,
): Promise<ImageVariant[]> {
  if (contentType === 'image/gif') return [];

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const originalWidth = metadata.width || 0;

  const variants: ImageVariant[] = [];

  for (const [size, maxWidth] of Object.entries(IMAGE_VARIANT_SIZES) as [VariantSize, number][]) {
    if (maxWidth >= originalWidth && size !== 'thumb') continue;

    const resized = sharp(buffer)
      .resize(maxWidth, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 });

    const variantBuffer = await resized.toBuffer();
    const variantKey = `${baseKey}-${size}.webp`;

    variants.push({
      size,
      width: Math.min(maxWidth, originalWidth),
      buffer: variantBuffer,
      key: variantKey,
      contentType: 'image/webp',
    });
  }

  return variants;
}

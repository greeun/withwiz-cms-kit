import { z } from 'zod';

export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (lowercase, hyphens only)');

const safeUrl = z.url().refine(
  (url) => {
    const lower = url.toLowerCase().replace(/[\t\n\r]/g, '');
    return !lower.startsWith('file:') && !lower.startsWith('javascript:') && !lower.startsWith('data:');
  },
  { error: 'Unsafe URL protocol (file:, javascript:, data: not allowed)' },
);
export const optionalUrlSchema = safeUrl.optional().or(z.literal(''));

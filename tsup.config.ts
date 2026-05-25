import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ENTRIES = [
  'components/index',
  'hooks/index',
  'components/AdminManagerBase',
  'components/AdminShell',
  'components/JsonLd',
  'components/ResizableImage',
  'components/ToggleSwitch',
  'hooks/useImageDropZone',
  'hooks/useScrollReveal',
];

function addUseClientDirective() {
  for (const entry of CLIENT_ENTRIES) {
    for (const ext of ['.js', '.mjs']) {
      const filePath = resolve('dist', entry + ext);
      try {
        const content = readFileSync(filePath, 'utf-8');
        if (!content.startsWith('"use client"')) {
          writeFileSync(filePath, `"use client";\n${content}`);
        }
      } catch {}
    }
  }
}

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'components/index': 'src/components/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'infrastructure/index': 'src/infrastructure/index.ts',
    'infrastructure/middleware/index': 'src/infrastructure/middleware/index.ts',
    'services/index': 'src/services/index.ts',
    'types/index': 'src/types/index.ts',
    'utils/index': 'src/utils/index.ts',
    'validators/index': 'src/validators/index.ts',
    'components/AdminManagerBase': 'src/components/AdminManagerBase.tsx',
    'components/AdminManagerConfig': 'src/components/AdminManagerConfig.ts',
    'components/AdminShell': 'src/components/AdminShell.tsx',
    'components/JsonLd': 'src/components/JsonLd.tsx',
    'components/ResizableImage': 'src/components/ResizableImage.tsx',
    'components/ToggleSwitch': 'src/components/ToggleSwitch.tsx',
    'hooks/useImageDropZone': 'src/hooks/useImageDropZone.ts',
    'hooks/useScrollReveal': 'src/hooks/useScrollReveal.ts',
    'infrastructure/middleware/wrappers': 'src/infrastructure/middleware/wrappers.ts',
    'infrastructure/prisma': 'src/infrastructure/prisma.ts',
    'types/common': 'src/types/common.ts',
    'utils/admin-fetch': 'src/utils/admin-fetch.ts',
    'utils/api-helpers': 'src/utils/api-helpers.ts',
    'utils/date': 'src/utils/date.ts',
    'utils/html-sanitizer': 'src/utils/html-sanitizer.ts',
    'utils/image-variant-utils': 'src/utils/image-variant-utils.ts',
    'utils/image-variants': 'src/utils/image-variants.ts',
    'utils/jwt': 'src/utils/jwt.ts',
    'utils/r2-helpers': 'src/utils/r2-helpers.ts',
    'utils/r2-storage': 'src/utils/r2-storage.ts',
    'utils/route-params': 'src/utils/route-params.ts',
    'validators/shared': 'src/validators/shared.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: [
    /^react/,
    /^next/,
    /^@prisma\/client/,
    /^@aws-sdk\//,
    /^@withwiz\//,
    /^@tiptap\//,
    /^@tanstack\//,
    /^zod/,
    /^clsx/,
    /^sharp/,
    /^jose/,
    /^sonner/,
    /^tailwind-merge/,
    /\.css$/,
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  onSuccess: async () => {
    const srcDir = resolve('src', 'components');
    // CSS is `external` (not bundled). With `splitting: true` esbuild hoists
    // the CSS-importing components into root-level shared chunks
    // (dist/chunk-*.{js,mjs}); their preserved `import "./x.css"` resolves
    // against dist/ root, so the CSS must exist there too. The
    // dist/components/ copies stay for the package.json `exports` subpaths
    // ("./components/image-drop-zone.css", "./components/toggle-switch.css").
    const destDirs = [resolve('dist'), resolve('dist', 'components')];
    for (const destDir of destDirs) {
      mkdirSync(destDir, { recursive: true });
      for (const css of ['image-drop-zone.css', 'toggle-switch.css']) {
        try {
          copyFileSync(resolve(srcDir, css), resolve(destDir, css));
        } catch {}
      }
    }
    addUseClientDirective();
  },
});

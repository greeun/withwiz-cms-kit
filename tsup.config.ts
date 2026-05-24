import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ENTRIES = [
  'components/index',
  'hooks/index',
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

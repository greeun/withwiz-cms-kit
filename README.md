[English](./README.md) | [한국어](./README.ko.md)

# @withwiz/pms

**Performance Management System** — a CMS framework package for building web admin panels with Next.js and React.

`@withwiz/pms` consolidates the common admin layer (infrastructure, base services, shared UI components, hooks, utilities, and validators) used across Withwiz projects. Domain-specific code (news, performances, artists, etc.) stays in your application's `src/`, while this package provides the reusable scaffolding underneath.

## Features

- **AdminManagerBase** — three-pane (list / editor / preview) scaffold for admin pages
- **AdminShell** — complete admin shell with authentication, sidebar, and layout
- **Middleware wrappers** — `withPublicApi` / `withAuthApi` / `withAdminApi`, a Next.js–typed compatibility layer over `@withwiz/toolkit`
- **Base services** — Prisma dependency injection, pagination, HTML sanitizer, R2 key collection/deletion
- **Image pipeline** — automatic `lg` / `md` / `sm` / `thumb` WebP variant generation on R2 upload
- **Shared hooks** — `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal`
- **Security hardening** — DOMPurify-based sanitization, JSON-LD escaping, fail-fast JWT secret policy, safe rate-limit identity extraction
- **Config boundary** — explicit `setPmsConfig` injection for brand, routes, JWT, sanitizer, storage, and rate-limit identity

## Tech Stack

- TypeScript (strict) — `target: ES2022`, `module: ESNext`
- React 19 / Next.js 16 (peer dependencies, `>=18` / `>=15` supported)
- Tiptap 3 (rich text editing)
- Zod 4 (validation)
- tsup (build) + Vitest (test)
- Optional peers: `@aws-sdk/client-s3`, `sharp`, `isomorphic-dompurify`, `sonner`, `@tanstack/react-virtual`

## Installation

This package is typically consumed via the `file:` protocol from a monorepo root.

```json
{
  "dependencies": {
    "@withwiz/pms": "file:packages/pms"
  }
}
```

`@withwiz/toolkit` is pulled in transitively — no separate install required.

## Entry Points

| Path | Description |
|---|---|
| `@withwiz/pms` | Full barrel export |
| `@withwiz/pms/components` | `AdminShell`, `AdminManagerBase`, `ImageDropUpload`, `ToggleSwitch`, … |
| `@withwiz/pms/hooks` | `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal` |
| `@withwiz/pms/infrastructure` | Prisma proxy, middleware wrappers |
| `@withwiz/pms/infrastructure/middleware` | `withPublicApi` / `withAuthApi` / `withAdminApi` |
| `@withwiz/pms/services` | `base-service`, pagination |
| `@withwiz/pms/types` | `PaginatedResult`, `SortOrder` |
| `@withwiz/pms/utils` | `adminFetch`, `r2-storage`, `image-variants`, `jwt`, `date`, `html-sanitizer` |
| `@withwiz/pms/validators` | `slugSchema`, `optionalUrlSchema` |

## Usage

### 1. Inject the Prisma client

The package does not know your Prisma schema; inject the client during application bootstrap.

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { setPrismaClient } from '@withwiz/pms/infrastructure';

const prisma = new PrismaClient();
setPrismaClient(prisma);
export { prisma };
```

Calling the proxy before injection throws `Error('Prisma client not initialized')`.

### 2. Configure the package boundary

Consumer-specific values (brand, routes, JWT secret, trusted sanitizer origins, storage public URL, rate-limit identity) are injected — never hard-coded.

```ts
import { setPmsConfig } from '@withwiz/pms/utils';

setPmsConfig({
  brand: { brandLabel: 'ACME', navItems: [{ label: 'Home', href: '/x', glyph: 'H' }] },
  routes: { loginPath: '/signin', uploadEndpoint: '/files/upload' },
  jwt: { secret: process.env.MY_JWT_SECRET },
  sanitizer: { trustedIframeOrigins: ['https://www.loom.com/'] },
  storage: { publicBaseUrl: 'https://cdn.example.com' },
  rateLimit: { identityExtractor: (h) => myTrustedClientIp(h) },
});
```

Resolution order (uniform across all surfaces):

1. Explicit injection
2. Legacy environment variables (current names preserved)
3. Built-in defaults

Failures are lazy and surface at point of use, not on import. Missing JWT secret is a **fail-fast** error (no safe default for signing keys).

### 3. Build a manager page

Use `AdminManagerBase` plus the shared hooks to assemble a three-pane admin page with list, editor, and preview.

## Scripts

```bash
npm run build       # tsup build → dist/
npm test            # vitest run
npm run test:watch  # vitest in watch mode
```

## Dependency Rules

- `src/` (your app) → `@withwiz/pms/*` ✓
- `@withwiz/pms` → `@withwiz/toolkit/*` ✓
- `@withwiz/pms` → `src/` ✗ (keep the package independent)

See [docs/architecture.md](./docs/architecture.md) for the full layering diagram.

## Documentation

- [docs/architecture.md](./docs/architecture.md) — Package structure and module boundaries
- [docs/components.md](./docs/components.md) — UI component reference
- [docs/hooks.md](./docs/hooks.md) — React hooks reference
- [docs/services.md](./docs/services.md) — Base service and pagination
- [docs/infrastructure.md](./docs/infrastructure.md) — Middleware wrappers and Prisma DI
- [docs/utils.md](./docs/utils.md) — Utility function reference
- [docs/validators.md](./docs/validators.md) — Shared Zod schemas
- [docs/testing.md](./docs/testing.md) — Test strategy and execution
- [docs/plans/](./docs/plans/) — Package design and refactoring plans

## License

MIT

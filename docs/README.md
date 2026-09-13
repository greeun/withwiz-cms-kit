# @withwiz/cms-kit

A CMS framework package for Next.js + React based web admin panels.

This package bundles the common admin layer for Withwiz projects (infrastructure, base services, shared UI components, hooks, utilities, validators). It is designed so that domain-specific code (news, performances, artists, etc.) stays in the application's `src/`, while reusing the base building blocks this package provides.

## Key Features

- **AdminManagerBase**: Common scaffold for the three-pane (list / edit / preview) admin page
- **AdminShell**: Full admin shell including authentication, sidebar, and layout
- **Middleware wrappers**: `withPublicApi` / `withAuthApi` / `withAdminApi` — a Next.js type-compatible layer built on `@withwiz/toolkit`
- **Base service utils**: Prisma dependency injection + pagination + HTML sanitizer + R2 key collection/deletion
- **Image transformation pipeline**: Automatically generates lg/md/sm/thumb WebP variants on R2 upload
- **Shared hooks**: `useAdminList`, `useAdminForm`, `useImageDropZone`, `useScrollReveal`

## Installation

```bash
npm install @withwiz/cms-kit
# or
pnpm add @withwiz/cms-kit
```

`@withwiz/toolkit` is a peer dependency (`>=0.7.1`). It is usually installed together during dependency resolution, but depending on your environment you may need to install it explicitly.

```bash
npm install @withwiz/toolkit
```

For development inside a monorepo, the `file:` protocol is also supported.

```json
{
  "dependencies": {
    "@withwiz/cms-kit": "file:packages/cms-kit"
  }
}
```

## Entry Points (Exports)

| Path | Description |
|---|---|
| `@withwiz/cms-kit` | Full barrel export |
| `@withwiz/cms-kit/components` | AdminShell, AdminManagerBase, ImageDropUpload, ToggleSwitch, etc. |
| `@withwiz/cms-kit/hooks` | useAdminList, useAdminForm, useImageDropZone, useScrollReveal |
| `@withwiz/cms-kit/infrastructure` | prisma proxy, middleware wrappers |
| `@withwiz/cms-kit/infrastructure/middleware` | withPublicApi/withAuthApi/withAdminApi |
| `@withwiz/cms-kit/services` | base-service, pagination |
| `@withwiz/cms-kit/types` | PaginatedResult, SortOrder |
| `@withwiz/cms-kit/utils` | adminFetch, r2-storage, image-variants, jwt, date, html-sanitizer |
| `@withwiz/cms-kit/validators` | slugSchema, optionalUrlSchema |

## Dependency Rules

- `src/` → `@withwiz/cms-kit/*` (allowed)
- `@withwiz/cms-kit` → `@withwiz/toolkit/*` (allowed, downstream dependency)
- `@withwiz/cms-kit` → `src/` (forbidden — keeps the package independent)

For details, see [architecture.md](./architecture.md).

## Document List

- [architecture.md](./architecture.md) — Package structure and module boundaries
- [components.md](./components.md) — UI component reference
- [hooks.md](./hooks.md) — React hooks reference
- [services.md](./services.md) — Base services and pagination
- [infrastructure.md](./infrastructure.md) — Middleware wrappers and Prisma DI
- [utils.md](./utils.md) — Utility function reference
- [validators.md](./validators.md) — Common Zod schemas
- [testing.md](./testing.md) — Testing strategy and how to run tests
- [plans/](./plans/) — Package design/refactoring plan history

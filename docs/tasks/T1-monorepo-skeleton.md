---
id: T1
title: Monorepo skeleton
status: done
base: main
pr: ""
depends: []
---

## Goal
pnpm workspaces + Turborepo; apps/web moved in; packages/core with Vitest.

## Files
- package.json
- turbo.json
- packages/core/

## Done when
`pnpm build`, `pnpm test`, and `pnpm lint` pass.

## Verify
just check

## Decisions
- Convex lives inside apps/web/convex for now.
- Node 22+; `@dekko/core` is source-only with `transpilePackages`.
- TypeScript pinned at 5.9.3 because TS 7 is untested with Next 16.

## Outcome
Monorepo skeleton lands so every later ticket has a home. Risk: TypeScript pin at 5.9.3.

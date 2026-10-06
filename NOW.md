# NOW

Goal: F1, the comprehension loop, running on my own PRs by 2026-10-24.

Done:

- T1 Monorepo skeleton. `pnpm build`, `pnpm test`, `pnpm lint` pass. Why: gives every later ticket a home.
  Risk: TypeScript pinned at 5.9.3 because TS 7 is untested with Next 16.

Next (ONE task): T2 — ChangeModel schema in packages/core/src/schema.ts (Zod) + parse test.
Before starting: add Zod to packages/core (say why in one sentence).

Decisions made this week:

- Convex lives inside apps/web/convex for now; move to a package only if a second app needs it.
- Node 22+ (was 20+); `@dekko/core` is source-only with `transpilePackages`.

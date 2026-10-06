set shell := ["bash", "-euo", "pipefail", "-c"]

port := "3000"

# List recipes
default:
    @just --list

# Install dependencies
install:
    pnpm install

# Start the dev server(s)
run:
    pnpm dev

# Stop whatever is listening on the dev port
stop:
    -lsof -ti tcp:{{port}} | xargs kill 2>/dev/null && echo "stopped :{{port}}" || echo "nothing on :{{port}}"

# Stop, then start again
restart: stop run

# Run all tests (or one package: just test @dekko/core)
test pkg="":
    {{ if pkg == "" { "pnpm test" } else { "pnpm --filter " + pkg + " test" } }}

# Lint, typecheck and quiet tests
check:
    pnpm lint
    pnpm typecheck
    just test-q

# Quiet test run for agents: last 40 lines, flags truncation, keeps exit code
test-q pkg="@dekko/core":
    #!/usr/bin/env bash
    set -uo pipefail
    export CI=true
    out=$(pnpm --filter {{pkg}} exec vitest run --reporter=dot 2>&1); code=$?
    printf '%s\n' "$out" | tail -n 40
    n=$(printf '%s\n' "$out" | wc -l | tr -d ' ')
    [ "$n" -gt 40 ] && echo "TRUNCATED: $n lines, showing last 40"
    exit $code

lint:
    pnpm lint

typecheck:
    pnpm typecheck

build:
    pnpm build

format:
    pnpm format

# Save a PR diff as a fixture: just fixture <pr-url> <name>
fixture url name:
    mkdir -p packages/core/test/fixtures
    gh pr diff {{url}} > packages/core/test/fixtures/{{name}}.diff
    gh pr view {{url}} --json title,body,number,headRefName,baseRefName > packages/core/test/fixtures/{{name}}.meta.json
    @echo "saved packages/core/test/fixtures/{{name}}.diff and {{name}}.meta.json"

# Manual model call against a diff file (needs AI_PROVIDER + API key in the env)
analyze path:
    #!/usr/bin/env bash
    set -euo pipefail
    DIFF_PATH="{{path}}" pnpm --filter @dekko/core exec tsx -e '
    import { readFileSync } from "node:fs";
    import { parseDiff, analyze } from "./src/index.ts";
    const text = readFileSync(process.env.DIFF_PATH!, "utf8");
    const { hunks } = parseDiff(text);
    const result = await analyze({ hunks });
    console.log(JSON.stringify({
      model: result.model,
      attempts: result.attempts,
      usage: result.usage,
      truncated: result.truncated,
      omittedFiles: result.omittedFiles,
      summary: result.changeModel.summary,
    }, null, 2));
    '

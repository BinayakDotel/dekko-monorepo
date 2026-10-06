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

# Lint, typecheck and test
check:
    pnpm lint
    pnpm typecheck
    pnpm test

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
    mkdir -p fixtures
    gh pr diff {{url}} > fixtures/{{name}}.diff
    gh pr view {{url}} --json title,body,number,headRefName,baseRefName > fixtures/{{name}}.meta.json
    @echo "saved fixtures/{{name}}.diff and fixtures/{{name}}.meta.json"

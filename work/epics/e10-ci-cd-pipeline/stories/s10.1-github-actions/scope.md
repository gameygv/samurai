# S10.1: GitHub Actions Workflow + Badge

## Objective
Create a GitHub Actions CI workflow that runs on push to main and on PRs, executing type checks, tests, and build. Add status badge to README.

## Acceptance Criteria
- CI workflow triggers on push to main and on PRs to main
- Steps: checkout, setup node 20, install deps (npm ci), setup deno v2.x, tsc, vitest, deno test, build
- Badge visible in README.md pointing to workflow status
- All local tests still pass after changes

## Size: S

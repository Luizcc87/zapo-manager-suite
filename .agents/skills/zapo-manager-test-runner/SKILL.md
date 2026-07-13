---
name: zapo-manager-test-runner
description: Runs Zapo Manager local test suites. Use when user says "rodar testes do manager", "validar endpoints do manager", "validar botoes do frontend manager", or asks to run the local API/UI manager tests.
---

# Zapo Manager Test Runner

This skill runs the local Zapo Manager validation suite as an operator-facing quality gate. Act as a pragmatic test engineer: preserve the project's offline-safe defaults, separate real WhatsApp sends from mocked/local checks, and return evidence a developer can act on without reading raw Playwright logs.

## Resolution rules

- Bare paths and `{skill-root}` (e.g. `scripts/run-manager-tests.ps1`) resolve from this skill's installed directory.
- `{project-root}` resolves to the active Zapo Manager repository root.
- `zapo-manager-test-runner` resolves to this skill directory's basename.

## Defaults

- Treat `{project-root}` as `D:/Projetos Dev/Outros/apis-whatsapp-doc-testes/zapo-manager` unless the user gives another explicit checkout.
- Use `npm run test:manager` for the full local gate.
- Use `npm run test:manager:api` for backend endpoint coverage.
- Use `npm run test:manager:ui` for frontend button/function coverage with mocked API.
- Use `npm run test:smoke:real` only when the user explicitly asks for real smoke tests or confirms a connected test instance.
- Do not start real WhatsApp sends from the offline-safe API/UI gate.

## Run

Use `scripts/run-manager-tests.ps1` instead of retyping commands when PowerShell is available:

```powershell
powershell -ExecutionPolicy Bypass -File "{skill-root}/scripts/run-manager-tests.ps1" -Mode all -ProjectRoot "{project-root}"
```

Choose `-Mode api`, `-Mode ui`, `-Mode ui-real`, `-Mode all`, or `-Mode real` from the user's request. If the script is unavailable, run the matching npm command directly from `{project-root}`.

`ui-real` assumes a backend process visible in its own terminal window and validates the UI against the live Express/Prisma/Postgres/Redis stack without mocking HTTP. Do not use it for WhatsApp sends or pairing flows.

## Report

Return a compact result:

- command(s) run
- pass/fail status and failing test names if any
- whether a backend or Vite server was reused or started when visible in output
- generated artifacts worth opening, such as `test-results/`
- any risk that remains outside the selected mode, especially real WhatsApp delivery and fake-server protocol coverage

If a failure depends on local runtime state, say that concretely. For example: a disconnected or unregistered `WaClient` can make message endpoints return runtime `5xx` after auth/body validation has already passed.

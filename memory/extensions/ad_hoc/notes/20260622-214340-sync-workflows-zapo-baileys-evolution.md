# Sync workflows for upstream validation

- Standard sync triage now uses `scripts/zapo-release-triage.mjs`.
- Supported modes:
  - `zapo` for `vinikjkkj/zapo`
  - `baileys` for `WhiskeySockets/Baileys`
  - `evolution` for `evolution-foundation/evolution-manager-v2`
- `auto` mode should infer the upstream from the release URL when possible.
- `--evolution-api` adds local contract validation against `docs/openapi.yaml` and the exposed API surface.
- Output should include release summary, implementation checklist, test checklist, suggested CHANGELOG update, mode-specific review, and next actions.
- Use the mode-specific touchpoints:
  - zapo: backend message, instance, and device/version handling
  - baileys: primary registration and credential mapping
  - evolution: frontend subtree, backend UI envelopes, and OpenAPI contract

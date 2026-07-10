# 0020 Use Persisted Media Generation Specs And Separate Media Import

Date: 2026-05-26

Status: accepted

## Context

Renku Studio needs AI-generated media that is grounded in project context and
user choices. For Lookbook Images, the important choices include model, prompt,
take count, seed, image frame, detail, output format, and title.

Those choices must not live only in an agent prompt or transient CLI arguments.
They need to be persisted before estimate and execution so the user can inspect
what will run, approve cost, and understand later outputs.

## Decision

Media generation uses persisted generation specs and durable generation runs.

For the first implemented slice, the supported purpose is `lookbook.image`.
Renku exposes generic command names, but core implements the Lookbook Image
slice directly:

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose lookbook.image --target lookbook:<id> --json
renku generation spec create --file <spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approve-live-provider-run --json
renku media import --purpose lookbook.image --target lookbook:<id> --source <path> --json
```

The generation spec is the persisted, user-editable source of truth. Agents
must not override binding fields after the user selects them.

Generation runs store snapshots of the spec, provider payload, estimate,
simulation flag, status, diagnostics, and outputs. This makes a run
understandable even after the spec is edited.

Core builds the final provider payload from the persisted spec and current
Lookbook context. Engines validates the final payload against the real provider
model JSON Schema before estimate or execution. Model schema validation checks
the executable provider payload; it does not design the product API, infer model
support, or create UI controls.

Import remains separate from generation. A generated output is not attached to
a Lookbook, cast member, scene, or other domain object until `renku media
import` succeeds. The same import command can attach a Renku-generated file, a
manual upload, or a downloaded file.

## Consequences

- Users and agents can review a saved spec before spending money.
- Estimate and live execution use the same persisted spec and provider-payload
  construction path.
- Generated files stay staged outputs until an explicit import attaches them to
  project metadata.
- A Lookbook Image's section placement is based on post-generation inspection,
  not blindly copied from `focusSections`.
- Future media purposes should follow the persisted-spec and separate-import
  pattern unless a new ADR accepts a different contract.

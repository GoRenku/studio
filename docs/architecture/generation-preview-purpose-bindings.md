# Generation Preview Resource

Date: 2026-07-12

Status: current

Role: architecture reference

## Purpose

Generation Preview lets the user inspect and edit one exact generic
`GenerationSpec` before estimate or execution. Decision `0047` supersedes the
former purpose-specific preview-binding architecture.

## Ownership

Core owns the experience resource under:

```text
packages/core/src/server/generation-preview-resource/
  projection.ts
  prompt.ts
  references.ts
  configuration.ts
  estimate.ts
  update.ts
```

The resource projects:

- purpose, exact target, title, and saved spec id;
- selected direct provider/model endpoint;
- authored prompt and optional negative prompt fields identified by Engines
  semantics;
- ordered exact references and editable selection ids;
- schema-derived configuration controls;
- the direct estimate for the selected model and pricing settings;
- safe provider payload preview data;
- structured diagnostics.

Core projects a draft preview and a saved preview through the same path. A
saved preview can update prompt text and reference inclusion together through
the generic spec command. An unsaved preview remains read-only.

## Layer Boundaries

Engines owns provider field schemas, semantics, payload assembly, validation,
and pricing. Core owns target context, exact file resolution, generic spec
persistence, and the Preview resource. The Studio server adds browser-safe file
URLs and translates structured errors. React owns only draft interaction state,
request ordering, and rendering.

No Studio route or feature may:

- choose a purpose-specific prompt field;
- classify reference eligibility;
- insert provider defaults;
- estimate candidate or downstream work;
- construct child specs;
- semantically validate prompt or media contents.

## Update Semantics

Preview updates are latest-request-wins in the browser. A stale response cannot
replace a newer draft. Structured update failure leaves the dialog open and
preserves the authored draft so the user can correct or retry it.

Only the selected model and its pricing settings receive an estimate. Prompts,
reference availability, and execution readiness do not gate that estimate.
Reference provenance is display context; it is never traversed for cost or
execution planning.

## Verification

Keep the existing Prompt, References, Config, diagnostics, negative-prompt,
footer-estimate, saved/editable, unsaved/read-only, pending, failure, and
latest-response-wins assertions. The locked desktop Playwright compatibility
suite verifies that the current resource replacement does not change the
dialog experience.

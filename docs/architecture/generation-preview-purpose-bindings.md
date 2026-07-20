# Generation Preview Resource
Date: 2026-07-15

Status: current

Role: architecture reference

## Purpose

Generation Preview lets the user inspect and edit one exact, possibly
incomplete `GenerationSpec`. Decision `0051` separates trustworthy typed-slot
presentation from provider execution validity.

## Ownership

Core owns the experience resource under:

```text
packages/core/src/server/generation-preview-resource/
  authoring.ts
  projection.ts
  prompt.ts
  references.ts
  configuration.ts
  estimate.ts
  update.ts
```

The resource projects exact persisted current choices separately from optional
typed candidates supplied by the active purpose guide. No Shot or Take-specific
slot family exists in the current generation contract.

Each Draft typed slot has `current: null` or one exact persisted choice plus
subject-filtered eligible candidates. In an editable Preview, a sole candidate
is visible but unchecked when current is null. Read-only Preview surfaces show
only exact current references; they do not present unselected candidates as if
the request uses them. Purpose guides may add empty suggestions and candidate
facts; they cannot erase an exact persisted selection. An unavailable selection
is shown as unavailable without substitution.

Generic references are a separate ordered collection authored through the
agent/CLI `GenerationSpec` contract. Generation Preview displays exact attached
generic references in their own read-only section. Studio does not expose an
Add Media action, generic project-media browser, or generic-reference mutation
path. Typed reference controls use focused domain relationships only.

## Update Semantics

A focused nullable typed-slot selection command sets or clears one exact
choice. A sole eligible candidate renders directly as the shared selectable
media card; it does not open a picker dialog or expose a `None` button.
Agent-authored generic references remain unchanged when Studio updates the
saved request. Both AI Production and Generation Preview persist through the
same spec state.

Saved Preview updates may change the selected purpose-compatible model and the
non-media provider inputs projected from Core model descriptors. Current
authored values remain authored. Purpose recommendations become authored when a
user switches models and accepts the displayed recommended controls. Untouched
provider defaults remain absent.

Generation Request inspection reuses the shared prompt, reference-display, and
configuration composition in read-only mode. It projects only the exact
references selected in the saved managed run snapshot or frozen external source
spec. It exposes no candidates, authoring controls, model changes, estimate, or
execution action.

Core validates the selected model and configurable field names against the
purpose context. When an exact reference has no valid provider assignment and
the selected model exposes exactly one compatible media field, the focused
Preview update command assigns that field. Ambiguous or unsupported mappings
remain unassigned for structured execution diagnostics. Core does not validate
creative suitability.

Configuration controls project authored values, purpose recommendations, and
provider defaults distinctly. Provider defaults are display-only until the
user changes that control. Estimate uses only pricing facts; payload preview
and run separately resolve exact files and invoke Engines request assembly.

Preview updates remain latest-request-wins in the browser. Failure leaves the
dialog open and preserves authored state for correction.

## Layer Boundaries

Engines owns provider schemas, payload assembly, validation, and pricing. Core
owns target context, safe exact-reference projection, model/control projection,
spec persistence, focused typed candidate queries, and focused Preview update
rules. The Studio server parses the HTTP envelope, adds browser-safe media URLs,
and translates structured errors. React owns temporary draft interaction state
and rendering.

No route or React feature may choose references, insert defaults, infer typed
ownership, classify provider compatibility, or semantically inspect prompts or
media.

## Verification

Keep Prompt, References, Config, diagnostics, estimate, saved/editable,
unsaved/read-only, pending, failure, latest-response-wins, typed-slot,
unchecked-sole-candidate, inline singleton selection, read-only generic
references, model/input authoring, fixed image-edit source, and exact-only
read-only reference coverage.

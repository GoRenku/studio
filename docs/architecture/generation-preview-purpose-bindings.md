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

Each Draft typed slot carries its media kind and has `current: null` or one
exact persisted choice plus subject-filtered eligible candidates. In an
editable Preview, eligible candidates render directly as media cards and remain
unchecked when current is null. There is no slot-local `Choose` button or
generic picker step. Read-only Preview surfaces show only exact current
references; they do not present unselected candidates as if the request uses
them. Purpose guides may add empty suggestions and candidate facts; they cannot
erase an exact persisted selection. An unavailable selection is shown as
unavailable without substitution.

Generic references are a separate ordered collection authored through the
agent/CLI `GenerationSpec` contract. Generation Preview displays exact attached
generic references in their own read-only section. Studio does not expose an
Add Media action, generic project-media browser, or generic-reference mutation
path. Typed reference controls use focused domain relationships only.

## Update Semantics

A focused nullable typed-slot selection command sets or clears one exact
choice. Eligible candidates render directly as shared selectable media cards;
the card opens media inspection and its separate selection control changes the
slot. Agent-authored generic references remain unchanged when Studio updates
the saved request. Both AI Production and Generation Preview persist through
the same spec state.

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

Video authoring uses the same Preview resource with an explicit `video`
authoring discriminant. A focused video strategy projects input modes,
catalog-backed families, and schema-backed controls; image and none strategies
remain separate. The strategy registry is keyed by output media kind, not
purpose or provider. Exact image/video/audio prompt mentions are displayed
without scanning or rewriting prompt text.

The editable video Config tab keeps three desktop panes in the order Model,
Input, Setup. Setup contains only schema-backed controls; prompt content is
displayed and edited exclusively in the Prompt tab.

For `shot-plan.video-generation`, Core filters optional guide slots before the
resource reaches React:

- text-only shows no unselected typed reference slots;
- first-frame shows only the first-frame slot;
- first-last-frame shows only first-frame and last-frame slots;
- reference mode shows compatible available storyboard, lookbook, and dialogue
  media, plus one named Character Sheet and Location Sheet slot for each Scene
  subject so missing subject media has an explicit placeholder.

Empty Dialogue Audio slots are not projected. Persisted exact selections and
Additional Media remain visible even when a later input-mode change leaves them
unassigned, so the user can remove them and structured execution diagnostics
remain actionable.

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
  projection.ts
  prompt.ts
  references.ts
  configuration.ts
  estimate.ts
  update.ts
```

The resource projects exact persisted current choices separately from optional
typed candidates. For a Draft Shot Video Take, Character Sheet and Location
Sheet slots come from the complete Scene context, one Production Lookbook slot
is always present, and First Frame, Last Frame, and Video Prompt Image slots are
always present regardless of selected-model fields.

Each Draft typed slot has `current: null` or one exact persisted choice plus
subject-filtered eligible candidates. A sole candidate is visible but unchecked
when current is null. Purpose guides may add empty suggestions and candidate
facts; they cannot erase an exact persisted selection. An unavailable selection
is shown as unavailable without substitution.

Generic references are a separate ordered collection. Their catalog is
searchable, paginated, and media-generic across image, audio, and video,
including imported/external assets. Typed pickers use focused domain
relationships and never use this all-project catalog.

Completed Take References use only the successful materializing run's immutable
`specSnapshot`. They do not query current candidates, show empty suggestion
slots, or expose editing controls.

## Update Semantics

A focused nullable typed-slot selection command sets or clears one exact
choice. Ordered generic-reference authoring updates the separate collection.
Both AI Production and Generation Preview persist through the same spec state;
Image Revision uses the same contracts rather than parallel defaults or a
no-op picker.

Core validates safe envelope structure and Draft lifecycle only. It does not
validate guide placement, candidate membership, typed ownership, provider-field
compatibility, creative suitability, or readiness. Exact optional
`providerField` strings are preserved as authored.

Configuration controls project absence as `Unspecified`. They do not write
provider defaults, including duration. Estimate uses only pricing facts; payload
preview and run separately resolve exact files and invoke Engines request
assembly.

Preview updates remain latest-request-wins in the browser. Failure leaves the
dialog open and preserves authored state for correction.

## Layer Boundaries

Engines owns provider schemas, payload assembly, validation, and pricing. Core
owns target context, safe exact-reference projection, spec persistence, and
focused typed candidate queries. The Studio server adds browser-safe media URLs
and translates structured errors. React owns temporary draft interaction state
and rendering.

No route or feature may choose references, insert defaults, infer typed
ownership, classify provider compatibility, or semantically inspect prompts or
media.

## Verification

Keep Prompt, References, Config, diagnostics, estimate, saved/editable,
unsaved/read-only, pending, failure, and latest-response-wins coverage. Desktop
coverage must also prove complete-Scene Draft slots, fixed supporting slots,
unchecked sole candidates, exact successful-snapshot Completed references, and
absence of completed-Take editing controls.

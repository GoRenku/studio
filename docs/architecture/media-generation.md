# Media Generation Architecture

Date: 2026-07-12

Status: current

Role: topic overview

## Current Architecture

Decision `0047` replaces the old generation dependency, lifecycle, purpose
provider, preview-binding, recursive-cost, and Shot route/input-mode backend
with a context-first, provider-valid foundation.

Plans `0134` and `0136` completed the coordinated replacement across Engines,
Core, CLI, Studio server, React, and Studio Skills. There is no compatibility
API, second runtime, dependency planner, or purpose-specific lifecycle.

The resolved cutover inventory is recorded in
`reference/context-first-generation-caller-handoff.md`.

## Ownership

`packages/core` owns:

- the generic purpose, target, context, reference-guide, spec, preview,
  estimate, and run contracts;
- exact reference catalog queries and project-file resolution;
- partial spec persistence without provider-readiness validation;
- execution-readiness orchestration and structured diagnostics;
- exact-request approval identity and immutable run persistence.

`packages/engines` owns:

- provider/model discovery and provider JSON schemas;
- provider field descriptors, including media type/cardinality and
  aspect-ratio/quality classification;
- full payload assembly from authored values and provider-assigned exact files;
- provider payload validation, pricing, uploads, execution, outputs, and
  receipts.

Core owns one purpose descriptor tree. Purpose descriptors provide context,
reference guides, candidate queries, product settings, and model presentation.
Generic provider validation does not interpret guide slots as requirements.

Focused Core resources compose that generic lifecycle for the existing Studio
experiences:

- `generation-preview-resource` projects and updates the saved or draft
  Preview experience;
- `image-revision-workflow` owns Regenerate/Edit source ownership, generic
  `image.edit` execution, and destination attachment;
- `scene-dialogue-audio-workspace` owns dialogue setup, generic audio
  generation, takes, playback metadata, and recoverable deletion;
- `shot-video-take-workspace` owns take design/lifecycle separately from its
  active generic `shot.video-take` generation request.

## Generic Lifecycle

A `GenerationSpec` is the one saved editing and execution shape. It can be
incomplete. Create and update validate its durable JSON envelope, immutable
purpose/target identity, structurally readable slot placement, and owning Take
lifecycle. They do not validate current guide placement, candidate membership,
typed ownership, provider readiness, insert defaults, assign media fields,
select references, or repair authored values.

An estimate consumes pricing inputs only: provider, model, output media kind,
explicitly authored pricing settings, provider-owned pricing defaults where
available, and intended input-media counts. Estimation does not resolve files,
require prompts or references, assemble an executable payload, or invoke
execution validation. Duration is an ordinary optional provider value: absent
means `Unspecified`, and Studio never writes `Auto`, an enum choice, a schema
minimum, or another default.

Before preview with a provider payload or run:

1. Core resolves every exact selected file without substitution.
2. Engines reads the selected provider/model endpoint.
3. Engines combines authored provider fields with ordered exact media
   assignments.
4. Engines validates the complete logical payload against the provider schema.
5. Run repeats readiness validation immediately before execution.

The approval token approves the provider/model price returned from pricing
inputs. Changing creative prompt text or file contents does not invalidate an
unchanged price approval. Run compares the current estimate first, then performs
full execution validation as a separate operation.

References without a provider assignment remain valid editing state. Presence
in `GenerationSpec.references` means inclusion; inactive alternatives are not
persisted. Unassigned references do not enter the provider payload.

Every run has immediate inputs and outputs only. There is no dependency graph,
recursive estimate, automatic child generation, provider fallback, value
clamping, semantic retry, or automatic import.

## Context And Guidance

A `GenerationReferenceGuide` is Draft presentation guidance. Sections and slots
carry placement, subject, label, exact eligible candidates, and optional
guidance copy. Every slot is one nullable UI choice. Guides never carry
provider roles/fields, hard provider requirements, generation purposes, cost,
or provider rules, and they never validate saved selections.

All purposes can expose separate ordered Additional References. Generic catalog
search is media-generic, while typed pickers list only explicitly registered
assets for their exact domain subject. A generic reference is never promoted
into a typed slot automatically. Creative prompts and media remain opaque under
Decision `0041`.

Draft Shot Video Take typed slots use complete Scene Cast/Location context, one
Production Lookbook slot, and three fixed supporting-media slots. Completed
Takes show only exact references from their successful immutable run snapshot.

## Persistence

`media_generation_spec` stores purpose, target, nullable provider/model,
title, authored values JSON, ordered references JSON, and timestamps. It does
not store a mirrored complete spec JSON blob.

`media_generation_run` stores the immutable spec snapshot, exact provider
payload, estimate and approval token, outputs, receipt, diagnostics, status, and
timestamps.

The generation-42 migration was generated from the Drizzle TypeScript schema and
contains a documented custom one-way data step. It deletes obsolete spec/run
rows and their provenance links, preserves imported assets/files, converts
unambiguous explicit Shot selections into generic spec references, strips
retired generation state from takes, and fails before migration when an exact
selection is ambiguous. The real Urban Basilica database was backed up and
migrated from generation 41 to generation 42. It contains 13 migrated Shot
specs with 31 exact selections; SQLite `quick_check` is `ok` and
`foreign_key_check` returns no rows. The same migration was replayed
successfully against a copy of the verified pre-migration backup.

Current schema changes continue to use Drizzle Kit's code-first generation and
backup-gated migration flow. The accepted current schema adds explicit Shot
generic-reference ownership, removes persisted Take lineage, and constrains one
successful materializing run per Take.

The generated `0053_drop-obsolete-shot-media-inputs.sql` migration then removes
the two obsolete Shot media-input tables and updates the take-state default to
version 3. It was replayed together with generation 42 from the verified
generation-41 backup and applied to the real project. Both databases retain 13
Shot specs, 31 exact selections, and 30 version-3 takes; `quick_check` remains
`ok`, `foreign_key_check` remains empty, and neither obsolete table exists. The
transaction-safe custom portion of the migration also preserves all 35
Take-to-Shot membership rows and all four final-video rows while rebuilding the
parent Take table.

## Public Foundation

The accepted Core contract is
`packages/core/src/client/generation.ts`. The accepted Core services are the
focused modules in `packages/core/src/server/generation`:

- `buildGenerationContext`;
- `listGenerationReferences`;
- `listGenerationModels`;
- `createGenerationSpec`, `updateGenerationSpec`,
  `readGenerationSpec`, and `listGenerationSpecs`;
- `validateGenerationSpec`;
- `buildGenerationPreview`;
- `estimateGenerationCost` and `estimateGeneration`;
- `runGeneration` and `readGenerationRun`.

The Core server entrypoint also exports focused Preview, Image Revision,
Dialogue Audio, Shot Video Take, and attachment commands. CLI and HTTP callers
remain thin projections of these Core-owned contracts.

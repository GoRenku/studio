# Media Generation Architecture

Date: 2026-08-06

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
- exact-request approval identity and immutable run persistence;
- Project Settings validation and the resolved generation workflow policy
  projected in Generation Context.

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
- `asset-file-generation-request` projects the exact saved request for one
  AssetFile into the shared read-only inspector resource;
- `generation/image-edit-attachment` owns the narrow rule that an accepted
  agent-owned `image.edit` output may return to the current owner of its exact
  locked source AssetFile;
- `scene-dialogue-audio-workspace` owns dialogue setup, generic audio
  generation, takes, playback metadata, and recoverable deletion;
- `scene-beats` owns Beat history, active selection, storyboard status,
  and storyboard-image attachment separately from generic generation.

## Generic Lifecycle

A `GenerationSpec` is the one saved editing and execution shape. It can be
incomplete. Create and update validate its durable JSON envelope, immutable
purpose/target identity, optional structurally valid `authoredFrom` context,
structurally readable slot placement, and owning Take lifecycle. They do not
validate current guide placement, candidate membership, typed ownership,
provider readiness, insert defaults, assign media fields, select references, or
repair authored values.

A saved spec is mutable only while `frozenAt` is null. Live managed submission
conditionally freezes the exact saved revision before Engines is called;
agent-external execution uses the focused freeze command immediately before the
external tool call. Estimate and simulation do not freeze. Frozen specs remain
readable, previewable, retryable unchanged, and attachable, but every mutation
is rejected by Core.

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

## Project Workflow Policy

Generation Context includes the Core-resolved Project workflow policy for the
requested output media kind. It reports whether Preview should open
automatically, the preferred execution path, the additional per-run
confirmation preference, and each lane's effective concurrency limit. When
concurrency is disabled, the effective limit is `1` without changing the saved
maximum.

Execution-path precedence is explicit user direction, an execution path
already authored on the saved GenerationSpec, then Project policy. Codex
built-in image generation remains an agent-external capability identified as
`codex.gpt-image-2`; it is not a Renku provider and is never added to Engines.
If the current harness lacks that capability, the agent asks for a path rather
than silently falling back to a paid Renku run. Audio and video remain
Renku-managed.

`displayPreview` controls only automatic display. Explicit Preview access and
Preview revalidation remain available. `requirePerRunConfirmation` controls an
additional conversational pause; every Renku-managed run still validates the
saved spec, gets the exact current estimate and approval token, and passes that
token unchanged. Concurrency is agent-owned scheduling of independent
requests, not a durable queue or execution graph.

## Context And Guidance

A `GenerationReferenceGuide` is Draft presentation guidance. Sections and slots
carry placement, subject, label, exact eligible candidates, and optional
guidance copy. Every slot is one nullable UI choice. Guides never carry
provider roles/fields, hard provider requirements, generation purposes, cost,
or provider rules, and they never validate saved selections.

All purposes can carry separate ordered Additional References authored by an
agent or CLI caller. Generation Preview displays those exact references but
does not provide a generic Add Media action or project-media picker. Typed
controls list only explicitly registered assets for their exact domain subject.
A generic reference is never promoted into a typed slot automatically. Creative
prompts and media remain opaque under Decision `0041`.

Studio currently exposes no product video-generation purpose. Engines retains
generic video descriptors, schemas, validation, pricing, simulation, and
provider adapters independently from the Studio purpose registry.

A Spec may retain information-only
`authoredFrom: { kind: 'shotPlan', id }` context. Core does not resolve that
value into purpose facts or use it as a target, owner, foreign key, lifecycle
rule, or execution requirement. Shot Plans contain no GenerationSpec state;
copy and Trash behavior never read, copy, or mutate generation records.

## Persistence

`media_generation_spec` stores purpose, target, nullable provider/model,
title, authored values JSON, ordered references JSON, optional soft Shot Plan
authoring context, `frozen_at`, and timestamps. It does not store a mirrored
complete spec JSON blob.

`media_generation_run` stores the immutable spec snapshot, exact provider
payload, estimate and approval token, outputs, receipt, diagnostics, status, and
timestamps.

Migration `0059_scene_beats_and_shot_authoring_reset.sql` historically converted every Scene
Shot List revision into the then-current Scene Beats shape, preserved active
revision selection and suitable storyboard image relationships, recomputes
content fingerprints, and removes all retired Shot Video Take, Shot membership,
Take media, Take generation, and Take asset records. It also removes the retired
tables and advances the project database to generation 46. The migration fails
on invalid non-retired ownership rather than guessing how to repair it.

## Public Foundation

The accepted Core contract is
`packages/core/src/client/generation.ts`. The accepted Core services are the
focused modules in `packages/core/src/server/generation`:

- `buildGenerationContext`;
- `listGenerationReferences`;
- `listGenerationModels`;
- `createGenerationSpec`, `updateGenerationSpec`, `freezeGenerationSpec`,
  `readGenerationSpec`, and `listGenerationSpecs`;
- `validateGenerationSpec`;
- `buildGenerationPreview`;
- `estimateGenerationCost` and `estimateGeneration`;
- `runGeneration` and `readGenerationRun`.

The Core server entrypoint also exports focused Preview, exact AssetFile
Generation Request inspection, Dialogue Audio, Scene Beats, and storyboard
attachment commands. CLI and HTTP callers remain thin projections of these
Core-owned contracts.

Generation Request inspection reads the immutable managed run snapshot or exact
frozen external source spec recorded for the displayed AssetFile. It reuses the
Generation Preview resource to show the exact prompt, selected references, and
saved configuration as read-only data. Project-file paths remain Core/server
data and are projected to authenticated browser URLs.

Image editing is agent-owned through a new generic `image.edit` spec with the
exact source AssetFile locked in `source/source-image`. Preview reviews the
request; a managed receipt or frozen external source spec proves execution; and
the accepted result is imported through the source owner's real focused
destination. Studio inspection never edits, executes, or attaches output.

## Prop generation

`prop.sheet` and `prop.hero` target one durable Prop. Core projects Prop facts
and active Prop Design guidance without interpreting creative prompt or image
contents. Prior same-Prop Sheets are optional explicit reference candidates;
Core never selects one automatically. Attachments create exclusively Prop-owned
`prop_sheet` or `prop_hero` Assets. Only a Hero may be selected canonically.

## Shot Plan video generation

`shot-plan.video-generation` targets Project, carries a weak Shot Plan source,
and requires an explicit text-only, first-frame, first-last-frame, or reference
input mode. Core owns exact catalog route selection, schema-backed values,
reference routing, provenance, and attachment. The three auxiliary Shot Plan
video image purposes follow the same weak source contract. Prompts and media
remain opaque.

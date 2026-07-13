# 0135 Generation Purpose Guides And Product Integration

Status: superseded by Plan `0136`
Date: 2026-07-12

Plan `0136` is accepted as the sole implementation and checklist authority for
all retained work. This document has no independent implementation phase;
conflicting UI directions are rejected by Plan `0136`.

## Summary

Complete the product-facing half of the context-first generation refactor after
the provider-valid Engines/Core replacement in
`plans/active/0134-context-first-generation-simplification.md` is complete.

This plan owns purpose definitions, reference guidance, curated model
presentation, fixed and recommended product settings, Studio dialogs, AI
Production, Shot authoring, CLI agent context, audio-purpose migration, Skills,
real-project migration, and restoration of a complete runnable product.

Plans `0134` and `0135` are two review documents for one replacement program.
They are sequential implementation checkpoints, not independently deployable
old/new systems. Plan `0134` has already replaced the Engines/Core contracts and
schema and deleted the old backend. The workspace may begin this plan with CLI,
Studio, and Skill imports intentionally broken. This plan updates those
consumers directly, adds the accepted purpose descriptor tree, applies the
migration to the real project, and restores all root build/test/runtime gates.

There is no compatibility interval and no requirement to move callers before
backend deletion. Do not recreate the old backend, add aliases, introduce a dual
schema, or build temporary adapters to make intermediate slices runnable. The
only required fully runnable boundary is completion of Plan `0135`.

## Context

This plan is constrained by:

- `plans/active/0134-context-first-generation-simplification.md` for the generic
  `GenerationSpec`, provider payload validation, persistence, estimate, approval,
  and run contracts;
- `plans/active/0134-generation-purpose-reference-guide-template.md` for accepted
  product guidance;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md` for opaque prompt
  and media contents;
- `docs/architecture/front-end-guidelines.md` and the local shadcn-only UI rule;
- `docs/architecture/shot-video-take-owned-media.md` for take-owned media;
- current desktop Studio behavior as the regression baseline;
- `$HOME/renku-movies/urban-basilica` as the real migration and manual test
  project.

ADR `0047-use-context-first-provider-valid-generation.md` must cover both plans
and distinguish deleted dependency/planning policy from retained Studio
interaction behavior.

## Starting State And Completion Boundary

Plan `0135` starts only after Plan `0134` provides:

- passing focused Engines/Core build, typecheck, lint, architecture, persistence,
  migration-on-copy, and runtime tests;
- the new Drizzle schema and generated migration;
- the generic Core client/server contracts and commands;
- physical deletion of the old Engines/Core generation backend;
- a checked-in inventory of every remaining broken CLI, Studio server, React,
  test-fixture, documentation, and Skill caller;
- the desktop behavior inventory and baseline manifest.

The checked-in caller inventory is
`docs/architecture/reference/context-first-generation-caller-handoff.md`.
It is the required file-by-file work queue for this plan; every listed caller
must be replaced or deliberately deleted before the root gates are restored.

Failures caused solely by those removed public contracts are expected at the
starting boundary. Unrelated build or test failures are not accepted handoff
state.

Plan `0135` is complete only when:

- every handoff caller is updated or deliberately deleted;
- the new purpose descriptor/reference-guide tree is the only product policy
  source;
- the real project migration is applied and verified;
- all focused and root build/test/lint/check commands pass;
- the desktop Studio and CLI workflows in this plan are runnable end to end;
- the combined code-reduction and architecture-shape review passes.

## Accepted Product Requirements

### Settings And Provider Defaults

- Provider-schema defaults are provider-owned. If the user or agent does not
  author a value, Renku omits it and lets the external provider apply its
  default.
- A purpose may declare a **fixed Studio setting** when changing it would break
  Studio presentation or a deterministic product workflow. Users and agents
  cannot change fixed settings.
- A purpose may declare a **recommended setting** and use it as the initial UI
  value. Users and agents may change it.
- Once the UI initializes and saves a recommended value, it is authored Studio
  state. CLI/spec creation does not insert recommendations automatically; agents
  receive them as guidance and explicitly author the values they choose.
- An authored recommended value is distinct from an untouched provider-schema
  default.
- The generic binder must use Engines-owned model field metadata to apply fixed
  settings and UI-chosen recommended settings to actual provider fields. Studio,
  CLI, and purpose files do not guess provider field names.

### Curated Models

Image dropdowns use an explicit allowlist instead of showing every Engines
catalog entry. The allowlist is global product availability metadata, not a
purpose-specific provider validator.

This iteration includes:

- GPT Image 2;
- Nano Banana 2;
- Nano Banana Pro, which must be added;
- xAI Grok Imagine Image 1.5.

Seedream 5 Pro is deferred. Existing obsolete catalog models are not removed in
this plan; they are simply absent from the selectable allowlist. Generate uses
allowed text-to-image or reference-to-image endpoints as appropriate. Edit uses
allowed edit/reference endpoints. Video model options remain unchanged.
Recommended models initialize the Studio dropdown; CLI context exposes them as
guidance and never silently inserts a model into an agent-authored spec.

### References And Attachments

- Typed purpose references remain visible guidance slots in Studio and CLI
  context. Slot occupancy is not a dependency or execution rule.
- If a slot has multiple exact candidates, clicking it opens the shared
  alternate-selection dialog filtered to the correct subject and reference type.
- Cast Profile and Location Hero initialize with the first matching sheet. The
  user or agent may replace it through the same slot picker.
- Generic `image.create` has no named typed slots.
- Every generation supports Additional References.
- Media generated through `image.create` has its own generation spec and is
  explicitly attached as a later exact reference.
- User-supplied or externally generated media has no Renku generation spec. It
  is attached directly as opaque target-owned media through the focused Core
  attachment boundary.
- Externally attached media is not assigned synthetic provenance and is not
  exposed as reusable project catalog media unless the user separately imports
  it into such a domain.
- No reference contents are interpreted, scored, repaired, or validated.

### Estimates And AI Production

- Estimate only the current validated provider request with immediate inputs
  already resolved.
- Never walk reference provenance or dependency trees and never estimate missing
  creative work.
- Remove pricing tags/badges from generation, model, reference, and dependency
  cards.
- AI Production model selection has exactly **Model** and **Duration** columns.
  Remove Status, `input-required`, production-plan, graph-total, and preflight
  projections.

### Storyboard Sheet Golden Workflow

`scene.storyboard-sheet` remains the one accepted deterministic composite
workflow:

- keep the current 2x2 prompt/composite behavior;
- keep the overall 4:3 sheet and project-aspect shot panels;
- keep high quality fixed;
- initialize GPT Image 2 as the recommended model;
- initialize the first available Storyboard Lookbook Sheet;
- show a non-blocking notice when no Storyboard Lookbook Sheet exists;
- retain the existing agent/Skill instructions that split the generated sheet;
- do not add an image-splitting library, Core splitter, Engines splitter, or
  Studio auto-split path.

The current agent-owned splitting workflow is the golden tested behavior.

### Shot Video Guidance

Shot Video Take guidance includes:

- First Frame;
- Last Frame;
- Video Prompt Sheet;
- general reference images;
- video Lookbook Sheets;
- video Character Sheets, repeated for each Cast Member available from Scene
  context;
- Location Sheets, repeated for each Location available from Scene context;
- dialogue audio, as today;
- Additional References.

First/last-frame requirements come only from the selected provider schema. A
reference-mode request with no general references gets a non-blocking guidance
notice unless the selected provider schema makes an input mandatory.

### Stable Guide Placement Identifiers

Guide placement ids are persisted public contract values and are fixed before
Plan `0134` writes the Shot selection migration. Labels and guidance copy may
change without changing these ids.

| Purpose | Section id | Slot id | Cardinality | Scope | Subject |
| --- | --- | --- | --- | --- | --- |
| `image.edit` | `source` | `source-image` | `one` | none | none |
| `image.edit` | `cast` | `character-sheet` | `one` | none | Cast Member |
| `image.edit` | `location` | `location-sheet` | `one` | none | Location |
| `image.edit` | `lookbook` | `video-lookbook-sheet` | `many` | none | none |
| `image.edit` | `lookbook` | `storyboard-lookbook-sheet` | `many` | none | none |
| `cast.profile` | `source` | `video-character-sheet` | `one` | none | none |
| `location.hero` | `source` | `location-sheet` | `one` | none | none |
| `scene.storyboard-sheet` | `visual-language` | `storyboard-lookbook-sheet` | `one` | none | none |
| `shot.video-take` | `shot` | `first-frame` | `one` | Shot when direction is per-Shot | none |
| `shot.video-take` | `shot` | `last-frame` | `one` | Shot when direction is per-Shot | none |
| `shot.video-take` | `shot` | `video-prompt-sheet` | `one` | Shot when direction is per-Shot | none |
| `shot.video-take` | `shot` | `general-reference` | `many` | Shot when direction is per-Shot | none |
| `shot.video-take` | `lookbook` | `video-lookbook-sheet` | `many` | Shot when direction is per-Shot | none |
| `shot.video-take` | `cast` | `video-character-sheet` | `one` | Shot when direction is per-Shot | Cast Member |
| `shot.video-take` | `location` | `location-sheet` | `one` | Shot when direction is per-Shot | Location |
| `shot.video-take` | `dialogue` | `dialogue-audio` | `one` | Shot when direction is per-Shot | Scene Dialogue |

Purposes absent from this table have no accepted named slot in this iteration;
they use the universal `{ kind: 'additional' }` placement only. Repeated subject
slots reuse the listed section/slot ids. `scope` identifies the optional Shot
direction while `subject` identifies the Cast Member, Location, or Scene
Dialogue represented inside that direction. Do not create ids dynamically from
labels or asset roles.

## Purpose Inventory

All purposes use the generic contract from Plan `0134`:

| Purpose | Target | Output | Product behavior |
| --- | --- | --- | --- |
| `image.create` | Project | Image | Generic creation; no named slots; Additional References only |
| `image.edit` | Asset | Image | Existing image selected as source; optional Character, Location, Lookbook, future Prop, and Additional References |
| `lookbook.image` | Lookbook | Image | Project-ratio initial setting; medium quality and Nano Banana 2 initial values |
| `lookbook.video-sheet` | Lookbook | Image | Global multiple sheets; 4:3, high quality, GPT Image 2 initial values |
| `lookbook.storyboard-sheet` | Lookbook | Image | Global multiple sheets; 4:3, high quality, GPT Image 2 initial values |
| `cast.video-character-sheet` | Cast Member | Image | Multiple sheets; 16:9, high quality, GPT Image 2 initial values |
| `cast.storyboard-character-sheet` | Cast Member | Image | Multiple sheets; 16:9, high quality, GPT Image 2 initial values |
| `cast.profile` | Cast Member | Image | Fixed 1:1; medium/Nano Banana 2 initial values; first video Character Sheet initially selected |
| `cast.voice-sample` | Cast Member | Audio | Migrate current behavior without new product requirements |
| `scene.dialogue-audio` | Scene Dialogue | Audio | Migrate current behavior without new product requirements |
| `location.sheet` | Location | Image | Multiple sheets; 16:9, high quality, GPT Image 2 initial values |
| `location.hero` | Location | Image | Fixed 16:9; otherwise Profile-equivalent behavior using the first Location Sheet initially |
| `scene.storyboard-sheet` | Scene | Image | Golden deterministic composite and agent-owned split workflow |
| `shot.video-take` | Scene Shot Video Take | Video | Typed Shot/Lookbook/Cast/Location/dialogue guidance and explicit provider request |

Generation and attachment remain separate for every purpose. Outputs from
external tools can be attached through focused domain commands without creating
fake generation runs.

## Architecture Shape Gate

### Ownership

`packages/core` owns:

- one purpose descriptor per purpose;
- target/output identity;
- fixed and recommended product settings;
- context and reference-guide projection;
- curated model listing obtained from Engines availability metadata;
- exact selection and focused external-media attachment commands;
- non-blocking guide notices distinct from provider validation diagnostics.

`packages/engines` owns:

- provider/model schemas and actual field names;
- model field semantic metadata used by the generic settings binder;
- the selectable model allowlist/availability metadata;
- media field capabilities and provider payload validation;
- the Nano Banana Pro model/route definition.

`packages/studio` renders Core projections and sends user intent. It does not
declare a second purpose guide, model allowlist, fixed setting, candidate query,
or provider requirement.

`packages/cli` serializes the same Core context, guide, models, notices, and
specs used by Studio. Skills explain the workflow but do not redefine runtime
rules.

### Intended Module Shape

```text
packages/core/src/server/generation/
  purposes.ts
  purpose-settings.ts
  context.ts
  references.ts
  attachments.ts
  purposes/
    image-create.ts
    image-edit.ts
    lookbook-image.ts
    lookbook-video-sheet.ts
    lookbook-storyboard-sheet.ts
    cast-video-character-sheet.ts
    cast-storyboard-character-sheet.ts
    cast-profile.ts
    cast-voice-sample.ts
    scene-dialogue-audio.ts
    location-sheet.ts
    location-hero.ts
    scene-storyboard-sheet.ts
    shot-video-take.ts

packages/engines/src/generation/
  studio-model-availability.ts
  setting-fields.ts

packages/studio/src/features/generation-preview/
  generation-reference-guide.tsx
  generation-reference-slot.tsx
  generation-reference-picker-dialog.tsx
  generation-additional-references.tsx
```

Existing focused feature folders for Image Revision and Scene Shot authoring stay
in place and consume the shared generation-preview primitives. Do not move them
into a new catch-all generation feature.

`purposes.ts` is a typed registry only. It must not contain purpose bodies,
provider switches, candidate queries, or UI copy. `index.ts` files remain thin
public entrypoints.

### Stop Conditions

Stop and redesign if implementation introduces:

- a second purpose/guide map in Studio, CLI, or Skills;
- provider field names or model schemas in Core/Studio;
- a generic relationship rules language for candidate discovery;
- a purpose-to-model switchboard instead of Engines availability metadata;
- automatic dependency traversal, prerequisite generation, or recursive price;
- creative-content inspection;
- automatic Storyboard Sheet splitting;
- generic state patching instead of focused Core commands;
- raw HTML controls in Studio feature code;
- a monolithic purpose registry, editor component, route, or CLI dispatcher.

## Contracts

Plan `0134` owns `GenerationSpec`, validation, estimate, approval, and run. This
plan adds product projection fields without changing provider validation:

```ts
interface GenerationPurposeDescriptor {
  purpose: GenerationPurpose;
  targetKind: GenerationTarget['kind'];
  outputMediaKind: 'image' | 'audio' | 'video';
  settings: GenerationPurposeSettings;
  buildContext(input: BuildGenerationContextInput): Promise<GenerationContext>;
  buildReferenceGuide(
    input: BuildGenerationReferenceGuideInput,
  ): Promise<GenerationReferenceGuide>;
}

interface GenerationPurposeSettings {
  fixed: GenerationProductSetting[];
  recommended: GenerationProductSetting[];
  recommendedModel?: GenerationModelIdentity;
}

interface GenerationProductSetting {
  kind: 'aspect-ratio' | 'quality';
  value: JsonValue;
}

interface GenerationReferenceGuide {
  sections: GenerationReferenceGuideSection[];
  additionalReferences: GenerationReferenceSelection[];
  notices: GenerationGuideNotice[];
}
```

Engines model descriptors identify which actual provider field implements each
supported `GenerationProductSetting.kind`. The generic binder applies fixed and
explicitly chosen settings without purpose/provider branches. If an allowed
model cannot represent a fixed setting, it is mechanically unavailable for that
purpose and the context reports a structured configuration error.

Fixed settings cannot be removed or changed in authored state. Recommended
settings become ordinary editable authored values only when the UI initializes
them or an agent explicitly chooses them. Provider defaults are not materialized
by either path.

`GenerationGuideNotice` is presentation/agent guidance, not a validation issue.
It may describe a missing recommended Storyboard Lookbook or an empty
reference-mode Shot request. It cannot make a request invalid.

Focused attachment commands accept exact safe media identity, validate target
ownership and media envelope, and never create generation provenance for an
external file.

## UI Preservation And Intentional Changes

Capture desktop screenshots and characterization tests before replacing current
code. Preserve:

- Generation Preview Prompt/References/Config tabs, diagnostics, schema-derived
  controls, preview, estimate, approval, run, and dialog behavior;
- Regenerate/Edit modes and explicit source-image context;
- Shot References section order, cards, subject grouping, alternate pickers,
  preview/revision actions, per-Shot scope, and save feedback;
- Shot dialogue selection and playback;
- AI Production tabs, take context, run progress, output review, and explicit
  import;
- Lookbook, Cast, Location, Storyboard, dialogue, and generic-image entry points;
- incomplete spec save/reopen behavior.

Intentional changes:

- use one shared typed-slot and alternate-picker interaction across Preview,
  Regenerate/Edit, and AI Production References;
- rename Lookbook and Location **Visual Content** tabs to **Assets**;
- remove pricing tags/badges;
- remove required/default/dependency/planned-generation badges that came from
  dependency policy;
- reduce AI Production model columns to Model and Duration;
- show non-blocking guide notices separately from provider diagnostics;
- expose only allowed models and initialize approved recommended settings.

No other layout, card, playback, selection, saving, or dialog change is implied.

## CLI And Skill Behavior

Keep the generic commands from Plan `0134`, including:

```text
generation context
generation reference list
generation model list
generation validate
generation spec create
generation spec update
generation spec show
generation spec list
generation preview show
generation estimate
generation run
generation run show
```

`generation context` returns named sections, slots, subjects, candidates,
selections, fixed/recommended settings, and guide notices. `generation reference
list` returns reusable catalog media only. Target-owned external attachments are
visible in their owning context/spec but do not become globally reusable.

Update Studio Skills to:

- use context and typed guide slots;
- create separate `image.create` specs for Renku-generated ad-hoc images;
- attach external media without inventing a generation spec;
- keep Scene Storyboard Sheet splitting agent-owned;
- use explicit validation before estimate/run;
- avoid dependency planning or creative-content validation.

## Implementation Slices

### Slice 1: Accept Purpose Contracts And Model Availability

- accept every purpose name, target, output kind, fixed/recommended setting, and
  recommended model;
- add Engines model availability and semantic setting-field metadata;
- add Nano Banana Pro;
- prove obsolete catalog models remain cataloged but unselectable;
- keep Seedream 5 Pro deferred.

Exit: model and setting presentation is schema-backed and has no Studio-local
allowlist or provider-field guessing.

### Slice 2: Purpose Context And Reference Guides

- implement one focused purpose file per inventory row;
- migrate both audio purposes without changing their product behavior;
- project Scene Cast Members, Locations, and dialogue audio for Shot guidance;
- implement exact candidates and shared Additional References;
- implement Profile/Hero initial first-sheet selection;
- implement Storyboard and Shot non-blocking guide notices;
- implement focused external-media attachment.

Exit: Studio and CLI can consume one complete Core projection for every purpose.

### Slice 3: Shared Preview And Revision UI

- build shared shadcn typed-slot, picker-dialog, and Additional References
  components;
- migrate Generation Preview and Regenerate/Edit;
- apply fixed settings and initialize editable recommended settings;
- filter model dropdowns through the Engines/Core allowlist;
- preserve incomplete editing and explicit validation behavior.

Exit: image-purpose dialogs use the generic contract without duplicated purpose
or provider rules.

### Slice 4: Lookbook, Cast, Location, Storyboard, And Audio Surfaces

- migrate all purpose entry points and focused imports;
- rename Lookbook/Location Visual Content to Assets;
- preserve Cast/Location multiple-sheet behavior;
- preserve Scene Storyboard Sheet prompt/composite and Skill-owned split flow;
- preserve current voice sample and dialogue audio product behavior.

Exit: every non-Shot purpose uses the generic runtime.

### Slice 5: Shot References And AI Production

- replace dependency/reference policy with exact guide-placed selections;
- retain General, Lookbook, Cast, Location, and dialogue organization;
- add the non-blocking empty-reference notice;
- carry included exact selections into a generic spec;
- require explicit actual provider-field assignment before validation;
- remove production plan, graph estimate, pricing badges, Status column, and
  `input-required` projection;
- retain focused final-video import and take-owned media behavior.

Exit: Shot generation is one explicit provider-valid request with no graph or
automatic mapping.

### Slice 6: CLI, Skills, Migration, And Runtime Restoration

- migrate CLI context/model/spec/preview/validate/estimate/run commands;
- update Studio Skills, including golden Storyboard splitting;
- apply the accepted one-way database migration;
- migrate unambiguous explicit Shot selections;
- update every remaining HTTP/CLI/Studio caller from the Plan `0134` handoff
  inventory;
- delete obsolete purpose-specific commands, routes, hooks, UI state, and
  adapter modules with no aliases or compatibility readers;
- restore root build, test, lint, check, and desktop runtime verification.

Exit: only the generic runtime is publicly reachable.

### Slice 7: Final Complexity Review

- compare the combined `0134` + `0135` baseline/final manifests;
- inspect all large changed files and entrypoints;
- verify the result is a very significant reduction in code and conceptual
  complexity without a numeric quota;
- reject moved or consolidated dependency policy.

## Tests And Guardrails

### Purpose And Settings

- every purpose has exactly one descriptor;
- fixed settings cannot be changed or removed;
- recommended settings initialize editable UI state but are only inserted into
  CLI specs when the agent explicitly authors them;
- untouched provider defaults remain absent;
- allowed model lists exclude obsolete catalog models;
- Nano Banana Pro is selectable; Seedream 5 Pro is not introduced;
- audio purposes round-trip through the generic contract.

### References And Guidance

- typed slots match the accepted guide and repeat for exact subjects;
- multiple candidates open the filtered shared picker;
- Profile/Hero initially select the first matching sheet and allow replacement;
- generic `image.create` has no named typed slots;
- externally attached media has no generation spec/provenance and remains
  target-owned;
- Renku-generated reference media retains its own earlier spec;
- Shot context includes dialogue audio;
- guide notices are non-blocking and never become provider diagnostics;
- provider-required first/last/reference fields still fail validation.

### Storyboard Golden Path

- current 2x2 prompt/composite behavior is unchanged;
- 4:3 sheet and project-aspect panel intent are preserved;
- first Storyboard Lookbook Sheet initializes when available;
- missing Storyboard Lookbook produces a non-blocking notice;
- no runtime splitter library/module exists;
- agent Skill still performs the split and focused attachment.

### Studio And CLI

- all retained desktop characterization states pass;
- only allowed models appear;
- pricing tags/badges are absent;
- AI Production has only Model and Duration columns;
- Studio and CLI return the same guide/settings/notices;
- Lookbook and Location tabs say Assets;
- no raw HTML interactive controls are added.

### Architecture

- Studio/CLI do not declare purpose guides or provider rules;
- Core purpose files do not import provider SDKs;
- Engines does not import Studio UI or domain target code;
- architecture tests protect import/capability boundaries, not implementation
  names or inventories;
- obsolete public routes/commands are absent after product integration.

## Documentation

- complete ADR `0047` for the combined program;
- update current generation architecture, Studio workflow, CLI, test-strategy,
  and model-catalog documentation;
- update Studio Skills and Storyboard split instructions;
- update directly conflicting active plans without editing historical plans for
  naming sweeps.

## Final Verification

Run:

```bash
pnpm build:core
pnpm test:engines
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm build
pnpm test
pnpm lint
pnpm check
```

With `urban-basilica`:

1. Exercise every image purpose through Preview Generation.
2. Exercise Regenerate/Edit with source and optional references.
3. Verify fixed settings cannot be changed and recommended settings can.
4. Verify Profile/Hero first-sheet initialization and alternate selection.
5. Generate a Scene Storyboard Sheet and complete the existing agent-owned split
   workflow without any runtime splitter.
6. Verify voice sample and dialogue audio behavior after generic migration.
7. Verify Shot First/Last/Prompt/Lookbook/Cast/Location/dialogue guidance in
   Studio and CLI.
8. Verify a missing optional Shot reference notice is non-blocking.
9. Verify provider-required missing inputs block estimate/run.
10. Attach one Renku-generated image and one external image as references and
    confirm their provenance/ownership differ correctly.
11. Verify AI Production columns, model allowlist, estimate, run, review, and
    explicit import.

Review the complete combined diff, manifests, deleted trees, all large files,
and thin `index.ts` entrypoints. Confirm no behavior was restored by recreating
the removed backend or moving its policy elsewhere.

## Completion Checklist

### Review Area

- [ ] Confirm Plans `0134` and `0135` form one replacement with an explicitly
      non-runnable intermediate checkpoint.
- [ ] Confirm no public dual runtime or compatibility layer exists.
- [ ] Confirm Plan `0135` starts from the new Engines/Core contracts and does
      not restore removed backend APIs for old callers.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.
- [ ] Confirm centralized ownership did not become a monolithic implementation.
- [ ] Confirm the combined result is a very significant simplification without
      using a numeric code quota.

### Plan 0134 Handoff

- [ ] Confirm focused Engines/Core gates passed at the Plan `0134` checkpoint.
- [ ] Confirm the new Drizzle schema and generated migration are present and
      verified on copied project data.
- [ ] Confirm the old Engines/Core backend and client contract families are
      physically absent.
- [ ] Review and own every remaining broken caller in the checked-in handoff
      inventory.
- [ ] Confirm no unrelated failure is mislabeled as expected intermediate
      breakage.

### Architecture And Contracts

- [ ] Implement one purpose descriptor per purpose.
- [ ] Keep provider field metadata and model availability in Engines.
- [ ] Keep purpose context/settings/guides and attachment rules in Core.
- [ ] Keep Studio and CLI as projection consumers.
- [ ] Keep package-boundary diagnostics structured.
- [ ] Add no provider-field guessing, dependency graph, or generic state patch.

### Implementation Slices

- [ ] Complete purpose/model contracts, guides, shared UI, non-Shot surfaces,
      Shot conversion, CLI/Skills/migration integration, and final complexity
      review.
- [ ] Update every caller in the Plan `0134` broken-caller handoff inventory.
- [ ] Split purpose, UI, route, and command modules before they collect unrelated
      branches or side effects.

### Product Settings And Models

- [ ] Keep untouched provider defaults omitted.
- [ ] Enforce fixed Studio settings.
- [ ] Initialize recommended settings as editable UI values and expose them as
      agent guidance without auto-inserting them into CLI specs.
- [ ] Implement the explicit image model allowlist.
- [ ] Add Nano Banana Pro and defer Seedream 5 Pro.
- [ ] Keep obsolete catalog models present but unselectable.

### Purpose And Reference Guides

- [ ] Migrate every purpose in the inventory, including both audio purposes.
- [ ] Implement accepted purpose renames/splits directly with no aliases.
- [ ] Implement named typed slots, subject repetition, exact candidates, and
      Additional References.
- [ ] Use the accepted stable section/slot ids exactly and verify migrated Shot
      selections resolve against the implemented guides.
- [ ] Keep generic `image.create` free of named slots.
- [ ] Initialize Profile/Hero first-sheet selections and allow replacement.
- [ ] Include Shot dialogue audio.
- [ ] Keep guide notices non-blocking.

### Attachments And Provenance

- [ ] Attach Renku-generated media using its real earlier spec/provenance.
- [ ] Attach external media without a synthetic generation spec or provenance.
- [ ] Keep external attachments target-owned and out of reusable catalogs.
- [ ] Preserve take-owned media copy/delete behavior.

### Storyboard Sheet

- [ ] Preserve the current 2x2 deterministic prompt/composite workflow.
- [ ] Preserve 4:3 sheet and project-aspect panel intent.
- [ ] Initialize the first Storyboard Lookbook Sheet when available.
- [ ] Show a non-blocking notice when it is absent.
- [ ] Keep splitting in the agent/Skill workflow.
- [ ] Add no runtime image-splitting library or auto-split module.

### Studio UI

- [ ] Capture and pass desktop characterization baselines.
- [ ] Reuse one shadcn typed-slot and alternate-picker interaction.
- [ ] Preserve Preview and Regenerate/Edit behavior.
- [ ] Preserve Shot section order, cards, pickers, playback, scope, and saving.
- [ ] Remove pricing tags/badges.
- [ ] Keep exactly Model and Duration in AI Production model selection.
- [ ] Rename Lookbook and Location Visual Content tabs to Assets.
- [ ] Obtain explicit review for any other UI change.

### CLI, Server, Skills, And Runtime Restoration

- [ ] Return the same context/settings/guide/notices through CLI and Studio.
- [ ] Keep HTTP and CLI adapters thin.
- [ ] Update Skills without duplicating runtime rules.
- [ ] Preserve the golden agent-owned Storyboard split instructions.
- [ ] Apply the one-way migration and inspect `urban-basilica`.
- [ ] Update all callers, delete obsolete public paths, and restore the complete
      runnable product.
- [ ] Add no aliases, compatibility readers, or fallback routes.

### Tests And Documentation

- [ ] Add all behavior and architecture tests listed above.
- [ ] Keep architecture tests free of private implementation names/inventories.
- [ ] Add ADR `0047` and update current architecture/CLI/UI/test/Skill docs.
- [ ] Leave historical plans and ADRs unchanged.

### Final Verification

- [ ] Run focused and root build/test/lint/check commands.
- [ ] Complete every `urban-basilica` scenario.
- [ ] Review complete combined diff and baseline/final manifests.
- [ ] Inspect every new or heavily modified large file.
- [ ] Confirm `index.ts` files remain thin.
- [ ] Confirm no dependency/planning/pricing complexity moved elsewhere.
- [ ] Confirm no checklist item relies on unreviewable code structure.
- [ ] Only then mark the plan complete.

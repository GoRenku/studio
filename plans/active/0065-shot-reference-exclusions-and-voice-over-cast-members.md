# 0065 Shot Reference Exclusions And Voice-Over Cast Members

Status: planned
Date: 2026-06-12

## Summary

The primary bug is that the shot References tab shows dependency-backed
reference cards, but users cannot exclude references that are not required by
the selected generation route.

The behavior is visible across cards such as:

- General `First Frame`;
- General `Last Frame`;
- General `Multi-Shot Storyboard Reference (N shots)` for multi-shot groups;
- Lookbook sheets;
- Cast Character Sheets;
- Location Sheets And Views.

These cards should keep defaulting to the generated shot dependencies. The user
must then be able to override those defaults by excluding optional references
with explicit consent. Required references must remain included and
non-excludable. For example, `First Frame` is required for a first-frame
generation intent, and `Last Frame` is required for a first-and-last-frame
generation intent; those cards must be locked in those states.

The related narrator bug is that Studio currently treats every Cast Member as a
visual subject. That breaks down for a voice-over narrator:

- the Cast Member detail page shows a large empty profile-image frame that will
  never be filled;
- the Cast Member can still appear in shot `Cast Character Sheets`;
- the dependency graph can still treat the narrator as a character-sheet visual
  reference candidate.

This plan adds two related product concepts:

1. Explicit, user-controlled shot reference inclusion overrides for every
   dependency-backed Reference tab card.
2. A first-class Cast Member `isVoiceOver` property.

Defaults remain generated from the shot's narrative and production dependency
graph. Users can then opt optional references in or out without changing who is
in the shot, changing the screenplay, or deleting generated dependency
information.

## Skill And Design Context

This plan uses the `build-web-apps:frontend-app-builder` skill for the UI
placement critique and verification expectations.

This is a targeted change inside an existing Studio product surface, not a new
app or redesign. Therefore no new Image Gen concept is required. The
implementation should preserve the current dark Studio chrome, existing
typography, existing reference-card visual system, and local shadcn-style UI
primitives from `packages/studio/src/ui`.

## References Consulted

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/reference/domain-vocabulary.md`
- Official Drizzle Kit `generate` docs:
  `https://orm.drizzle.team/docs/drizzle-kit-generate`
- Official Drizzle Kit `migrate` docs:
  `https://orm.drizzle.team/docs/drizzle-kit-migrate`

The Drizzle docs still describe the code-first migration flow: generate SQL from
the TypeScript schema with `drizzle-kit generate`, then apply SQL migrations
with `drizzle-kit migrate`. The repo-specific workflow remains the authority
for paths and package commands.

## Current State Audit

### Cast Member Contract

`packages/core/src/client/cast-members.ts` exposes:

```ts
export interface CastMember {
  id: string;
  handle: string;
  name: string;
  role?: string;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  voiceNotes?: string;
  description?: string;
}
```

There is no durable way to say that a Cast Member is a voice-over narrator or
audio-only performer. Existing values such as `role: "historical voice-over"`
are descriptive copy, not a reliable capability flag.

### Cast Member Database Shape

`packages/core/src/server/schema/cast-members.ts` has no voice-over column in
`cast_member`.

The implementation also has a loose `kind`/`shortDescription` mapping in
`packages/core/src/server/database/access/cast-members.ts`:

- `kind` is derived from `role`;
- `shortDescription` is derived from `description`;
- neither is persisted as a first-class Cast Member capability.

The new field must not be inferred from role text such as "voiceover",
"voice-over", or "narrator". It needs to be explicit, typed, and persisted.

### Cast Member Detail UI

`packages/studio/src/features/movie-studio/cast/cast-member-details-tab.tsx`
always renders `CastFeatureImage` at the top of the details page.

For a narrator with no visual identity, the current result is a large profile
placeholder with "No profile image yet". This is visually loud and misleading:
it implies the profile image is missing work rather than intentionally
inapplicable.

### Shot References UI

`packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx`
renders these sections:

- General
- Lookbook
- Cast Character Sheets
- Location Sheets And Views

The General section is part of the bug because it contains dependency-backed
cards whose requiredness changes with the current generation intent. `First
Frame` is required when the selected input mode is `first-frame` or
`first-last-frame`. `Last Frame` is required when the selected input mode is
`first-last-frame`.

For a multi-shot production group, the General section should always include a
planned `Multi-Shot Storyboard Reference (N shots)` reference card, regardless
of whether the current input mode is text-only, first-frame,
first-and-last-frame, or reference. That card represents optional generated
multi-shot reference material. It should default to included, because it is a
useful generated shot dependency for multi-shot continuity, but users may
exclude it. When no generated sheet exists yet, it should render as a planned
placeholder with the dependency generation estimate, just like other missing
generated references.

Do not label this card `Storyboard sheet (N shots)`. That name is too easy to
confuse with `scene.storyboard-sheet`, the temporary composite sheet generated
for scene storyboard slicing.

The underlying media purpose is `shot.multi-shot-storyboard-sheet`. It is a
durable shot-video input purpose, not the temporary `scene.storyboard-sheet`
workflow. It should be generated and imported as a permanent reference asset for
the ordered production group, then used to feed `shot.video-take`.

The media-producer reference document is:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-multi-shot-storyboard-sheet.md
```

The generated image should match that reference: one readable planning sheet,
one panel per shot in exact order, with compact metadata under or beside each
image. The metadata should include available shot/composition/motion/lens/action
facts, dialogue or VO only when known, audio/SFX/music only when known,
transition only when provided, and a model-facing note. This is closer to the
attached example than to a plain storyboard contact sheet.

Custom `reference-image` cards are not required just because the selected
intent is reference-image. In this product surface, character sheets, location
sheets, lookbook sheets, frames, storyboard sheets, and custom user images are
all reference material. The `reference-image` input kind represents additional
custom user-provided images, not the one required source of reference context.

The UI must therefore not hardcode excludability by section or label. It must
read the dependency's required/optional state from core.

The Cast Character Sheets section uses
`SceneShotCastReferenceCard`. Its check control currently represents a mixture
of:

- whether the cast member is selected for the shot; and
- whether the selected character sheet asset is active.

That is the wrong model for the requested behavior. If a user unchecks an
optional visual reference, they should not necessarily remove the cast member
from the shot. They are only saying:

> Do not include this optional reference in the generation context.

The same rule applies to General, Lookbook, and Location reference cards. The
toggle must mean "include this dependency-backed reference", not "delete this
input", "remove this cast member from the shot", or "change the selected asset
alternative".

### Shot Reference Data Model

`packages/core/src/client/scene-shot-list.ts` already stores shot-level
reference overrides inside `shotSpecs`:

- `castReferences.castMemberIds`
- `castReferences.characterSheetAssetIds`
- `location.locationId`
- `location.environmentSheetAssetId`
- `location.viewIds`
- `lookbookReference.lookbookSheetId`
- `referenceImages.customReferenceInputIds`

This is the right persistence area for user reference overrides because it is
shot-specific, validated as part of the Scene Shot List document, and already
used by the Reference tab.

However, there is no dedicated representation for:

- "this default optional reference is intentionally excluded";
- "this user chose to include a reference that was optional by default";
- "this generated default still applies because the user did not override it".

### Dependency Resolver

`packages/core/src/server/media-generation/shot-video-take/dependency-slots.ts`
declares route-required inputs and contextual references. The important existing
rule is:

- frame inputs are required for input modes that explicitly need them;
- multi-shot storyboard/reference sheet inputs are optional generated context
  whenever the production group contains more than one shot;
- lookbook/cast/location context references are optional when not required by
  the selected route.
- custom `reference-image` inputs are optional user-provided reference material,
  not a mandatory dependency by themselves.

`packages/core/src/server/media-generation/shot-video-take/reference-sections.ts`
projects this into the Reference tab.

The current resolver is close to the desired model, but it needs explicit
user-consent override data so optional reference cards can be unselected while
generated defaults remain available.

## Product Rules

### Voice-Over Cast Members

A Cast Member with `isVoiceOver: true` is an audio-only cast subject.

Rules:

- It can still appear in Cast navigation and Cast detail pages.
- It can still have voice records and voice samples.
- It can still appear in screenplay dialogue/audio workflows when relevant.
- It does not require a Cast Profile image.
- It does not require Cast Character Sheets.
- It must not appear in the shot References tab's `Cast Character Sheets`
  section.
- It must not create or satisfy `cast-character-sheet` dependency slots for shot
  video takes.
- It must not be silently inferred from `role`, `name`, or `handle`.

### Optional Reference Exclusions

Generated defaults remain the baseline.

If the user has never touched a reference card, Studio must keep using the
generated/default dependency set derived from the shot, scene narrative scope,
active Lookbook, selected location, production group, input mode, requested
inputs, and dependency graph.

If the user changes a reference card, Studio should persist an explicit
inclusion override:

- include this optional reference;
- exclude this optional reference;
- clear the override and return to generated defaults.

Required references cannot be excluded. If a route requires a reference, the UI
should communicate that it is required and core should fail fast with structured
diagnostics if a request tries to exclude it.

Do not add a hard "at least one reference image" validator for reference-image
intent in this slice. A reference-image intent with no reference material is a
poor user choice, but it is obvious in the Reference tab and awkward to explain
as a cross-card validation rule. The UI should make included references visible;
it should not block the workflow with a special aggregate rule.

This applies to every dependency-backed Reference tab card whose dependency is
not required:

- General `first-frame`, `last-frame`, `reference-image`, and
  `multi-shot-storyboard-sheet` cards;
- Lookbook cards;
- Cast Character Sheet cards;
- Location Sheet cards.

The same card kind can be excludable in one production setup and locked in
another. The source of truth is the dependency graph line's `required` state,
not the visual section, card label, media kind, or dependency kind.

Location view cards are a separate asset-subselection inside an included
Location Sheet reference. They should keep using `location.viewIds`; they are
not the top-level include/exclude switch for the dependency.

### Shot Cast Versus Visual Reference Inclusion

Do not overload `castReferences.castMemberIds`.

That field represents the shot's effective cast reference scope. It should not
also mean "include this character sheet image as optional generation context".

The plan must preserve this distinction:

- shot cast membership answers "who/what is part of this shot";
- reference inclusion answers "which optional visual references are sent into
  generation".

## Proposed Data Contracts

### Cast Member

Add:

```ts
export interface CastMember {
  // existing fields...
  isVoiceOver: boolean;
}
```

Use `isVoiceOver`, not `voiceOver`, `vo`, `audioOnly`, `kind`, or
`castMemberType`.

Reason:

- it is a plain boolean product property;
- it uses the product phrase "voice-over" while following TypeScript boolean
  naming;
- it does not collapse all future non-visual cast-member types into a vague
  generic type field.

### Database

Add a non-null boolean-style column to `cast_member`:

```ts
isVoiceOver: integer('is_voice_over', { mode: 'boolean' }).notNull().default(false)
```

This must be generated through Drizzle Kit from
`packages/core/src/server/schema/cast-members.ts`.

Migration expectations:

- generated migration lives in `packages/core/drizzle/`;
- generated meta snapshot and journal updates are committed with the SQL;
- existing rows receive `false` through the column default;
- no runtime migration should run from Studio HTTP handlers or browser paths.

This is a project-store schema generation change because current runtime reads
will require `cast_member.is_voice_over` from every Cast Member projection.
Increment the core runtime schema generation constant and add
`PRAGMA user_version = <new generation>;` to the migration.

### Cast Operation Input

Add `isVoiceOver?: boolean` to:

- `CastMemberInput`
- `castMemberInputSchema`
- cast operation validation
- cast add/update serialization

Normalize absent values to `false` when persisting.

Unknown fields must continue to be rejected for department JSON because this is
not import YAML.

### Shot Reference Inclusion Overrides

Add a focused shot-spec shape for dependency-backed reference inclusion:

```ts
export type ShotReferenceInclusion = 'include' | 'exclude';

export type ShotReferenceInclusionSpecs = Record<
  string,
  ShotReferenceInclusion
>;
```

Add this under `ShotSpecs` as:

```ts
referenceInclusions?: ShotReferenceInclusionSpecs;
```

The naming is intentionally explicit:

- `referenceInclusions` describes user consent for references.
- The map key is the dependency id shown by the current media-generation
  dependency graph.
- The values avoid ambiguous booleans where `false` could mean absent,
  defaulted, unset, or excluded.
- One representation covers General, Lookbook, Cast Character Sheet, and
  Location Sheet cards.
- Asset-choice overrides remain in the existing focused fields such as
  `castReferences.characterSheetAssetIds`, `location.environmentSheetAssetId`,
  `location.viewIds`, `lookbookReference.lookbookSheetId`, and
  `referenceImages.customReferenceInputIds`.

Example:

```json
{
  "referenceInclusions": {
    "lookbook-sheet:lookbook_imperial_wound": "exclude",
    "cast-character-sheet:cast_urban": "include"
  }
}
```

The exact dependency id strings are owned by the current dependency identifier
helpers. The implementation must use those helpers rather than reconstructing
ids in React.

## Resolver Behavior

### Effective Inclusion

For each candidate optional reference, derive:

1. `defaultIncluded`: generated from current shot dependency defaults.
2. `dependencyId`: read from the dependency graph line/card projection.
3. `inclusionOverride`: read from
   `shotSpecs.referenceInclusions[dependencyId]`.
4. `included`: override wins when present; otherwise use `defaultIncluded`.

Expose these in the Reference tab report with clear names:

```ts
defaultIncluded: boolean;
included: boolean;
required: boolean;
dependencyId: string;
inclusionOverride: 'include' | 'exclude' | null;
```

Existing `selected` fields can remain for asset-choice state only if they are
still accurate. For inclusion state, use `included`, `defaultIncluded`,
`required`, and `inclusionOverride`. Do not add compatibility aliases.

### Required References

Required references must not accept exclusion overrides.

Core should return a structured diagnostic for invalid exclusion attempts, for
example:

- code prefix: `CORE_SHOT_REFERENCE_...` or `PROJECT_DATA...`, depending on
  which boundary validates the request;
- location: the shot id, dependency id, and `shotSpecs.referenceInclusions`;
- suggestion: explain that the selected video route requires that reference.

Required and optional General examples:

- `first-frame` is non-excludable when `inputModeId` is `first-frame`.
- `first-frame` and `last-frame` are non-excludable when `inputModeId` is
  `first-last-frame`.
- `multi-shot-storyboard-sheet` is shown for every input mode when the active
  production group contains more than one shot.
- `multi-shot-storyboard-sheet` is individually optional and user-excludable.

Custom `reference-image` dependencies remain individually optional. Do not add a
special aggregate validator that checks whether at least one reference card
remains included for reference-image intent.

### Voice-Over Filtering

Filter `isVoiceOver` Cast Members before declaring or projecting
`cast-character-sheet` references.

The filter should happen in core, not only in React:

- dependency declaration must not create character-sheet slots for voice-over
  Cast Members;
- Reference tab projection must not show them;
- cost estimates must not include generated character sheets for them.

Studio can additionally guard the UI, but React must not be the only place this
rule lives.

## Studio UI Plan

### Cast Member Details Placement

The proposed placement from the request is sound with one refinement:

- keep the role pill above the Cast Member name;
- place the voice-over toggle in the same top metadata row, aligned to the far
  right when horizontal space allows;
- wrap the row cleanly when the content area narrows;
- keep the toggle visually quieter than the name and description.

This works because the voice-over property is identity metadata, not a body
fact. It belongs near the role pill rather than buried in the fact grid.

Recommended visual structure:

```text
[role pill]                                      [Voice-over  Toggle]

Narrator                         [voice sample button, when available]

description...
```

Use local shadcn controls only:

- `Switch` from `packages/studio/src/ui/switch.tsx` for the binary
  `Voice-over` setting;
- `Button`, `Tooltip`, and existing local primitives for any actions;
- no raw `<button>`, `<input>`, `<select>`, `<textarea>`, or other browser
  controls in feature code.

The visible label should be intentional and concise:

- `Voice-over`

Avoid extra explanatory UI copy in the page. The layout itself should make the
state clear.

### Voice-Over Detail Page Layout

When `castMember.isVoiceOver` is true:

- do not render the large `CastFeatureImage` placeholder;
- do not reserve the profile-image column;
- keep the content aligned with the current detail panel rhythm;
- keep voice sample playback near the name, as it is the primary media affordance
  for an audio-only Cast Member;
- continue to show role, want, need, arc, and voice notes when present.

When `castMember.isVoiceOver` is false:

- preserve the current visual layout;
- keep profile image preview behavior unchanged.

### Reference Tab Controls

The Reference tab cards should distinguish:

- choosing an asset alternative;
- including or excluding a reference from generation.

For optional references:

- the bottom-right control should toggle `included`;
- the card border/check state should represent included/excluded;
- the card should still be openable for preview or sheet selection;
- if the card is excluded, cost badges should not contribute as active selected
  generation context.

For required references:

- do not let the user exclude them;
- show the control as locked/disabled or omit the toggle while preserving the
  selected state;
- keep the required cost badge visible when generation is still planned.

Use the current `ImageSelectionControl` for optional reference inclusion state,
with labels that describe inclusion rather than asset selection. Continue to use
the existing sheet/view dialogs for choosing asset alternatives.

## Server And API Plan

Add a focused Reference tab endpoint:

- `PATCH /screenplay/scenes/:sceneId/shots/:shotId/reference-inclusions`
- request body:

```json
{
  "dependencyId": "cast-character-sheet:cast_urban",
  "inclusion": "include"
}
```

or:

```json
{
  "dependencyId": "lookbook-sheet:lookbook_imperial_wound",
  "inclusion": "exclude"
}
```

Allow a deliberate way to clear the override and return to defaults:

```json
{
  "dependencyId": "cast-character-sheet:cast_urban",
  "inclusion": null
}
```

The request must not mutate shot cast membership just to exclude an optional
reference.

Add request parsing in
`packages/studio/server/http/scene-shot-video-take-production-request.ts` with
structured `STUDIO_SERVER...` diagnostics.

Add core mutation in the scene storyboard/shot specs resource area, most likely
near:

- `updateSceneShotCastReferences`
- `updateSceneShotCastCharacterSheetReference`
- `updateSceneShotLookbookReference`
- `updateSceneShotLocationReference`

Name the new core mutation `updateSceneShotReferenceInclusion`. It should:

- read the active shot list;
- find the target shot;
- validate the dependency id against the current shot-video production plan or
  dependency projection;
- reject `exclude` when the dependency is required;
- write or clear `shotSpecs.referenceInclusions[dependencyId]`;
- preserve all existing asset-choice fields.

Keep exported route handlers thin and focused.

Add a focused Cast Member endpoint for the voice-over toggle:

- `PATCH /screenplay/cast/:castMemberId/voice-over`
- request body:

```json
{
  "isVoiceOver": true
}
```

Add request parsing in `packages/studio/server/http/cast-member-request.ts`,
with structured `STUDIO_SERVER...` diagnostics.

Add a core mutation named `updateCastMemberVoiceOverStatus` and expose it
through the project data service used by Studio. This mutation should update the
Cast Member row directly, return the refreshed Cast Member resource, and emit
cast navigation plus Cast Member surface resource keys.

## CLI And Agent Surface Plan

Update `renku cast` operation JSON to accept `isVoiceOver`.

The CLI does not need a separate convenience command in this slice unless an
existing cast edit command already supports field-specific updates. The durable
contract is the cast operation document.

Agent-facing behavior:

- Casting agents can mark narrator-style members with `isVoiceOver: true`.
- Media-generation agents should read the cast context and avoid requesting
  character sheets or profiles for voice-over Cast Members.
- Scene-shot agents should not include voice-over Cast Members in visual
  character-sheet references.

Do not infer this from role text. Agents must write/read the explicit field.

## Implementation Slices

### Slice 1: Cast Member Voice-Over Schema And Contracts

- Add `isVoiceOver` to the Cast Member client contract.
- Add `isVoiceOver` to Cast Member input/update contracts.
- Add `is_voice_over` to the Drizzle schema.
- Generate a Drizzle migration from `packages/core`.
- Increment the project-store schema generation and add the matching
  `PRAGMA user_version` statement.
- Update Cast Member database access reads/writes.
- Update cast operation validation and normalization.
- Update sample/project seed data where the Narrator is authored so it is
  explicitly `isVoiceOver: true`.

### Slice 2: Voice-Over Core Behavior

- Ensure cast context/read/list resources expose `isVoiceOver`.
- Ensure Cast Voice flows continue to work for voice-over Cast Members.
- Prevent cast profile and cast character-sheet generation readiness from
  suggesting visual generation for voice-over Cast Members.
- Filter voice-over Cast Members out of `cast-character-sheet` dependency
  declarations for shot video takes.
- Filter voice-over Cast Members out of Reference tab projection in core.

### Slice 3: Shot Reference Inclusion Contract

- Add `ShotReferenceInclusion` and `ShotReferenceInclusionSpecs` to the
  Scene Shot List client contract.
- Add JSON Schema validation for `shotSpecs.referenceInclusions`.
- Add normalization in `normalizeShotSpecs`.
- Add `updateSceneShotReferenceInclusion` for one dependency-id inclusion
  override.
- Add Studio server request parser and route.
- Add Studio browser service function.

### Slice 4: Dependency And Reference Projection

- Declare and project `multi-shot-storyboard-sheet` for every production group
  with more than one shot, regardless of input mode.
- Mark `multi-shot-storyboard-sheet` as `required: false` in this slice.
- Set `defaultIncluded: true` for `multi-shot-storyboard-sheet` when the
  production group has more than one shot, unless the user has an explicit
  exclusion override.
- Update dependency declaration to honor `referenceInclusions`.
- Preserve generated defaults when no override exists.
- Refuse exclusion for required references with structured diagnostics.
- Expose `dependencyId`, `included`, `defaultIncluded`, `required`, and
  `inclusionOverride` in the shot Reference tab report for General, Lookbook,
  Cast Character Sheet, and Location Sheet cards.
- Ensure excluded optional references do not contribute dependency pricing as
  active selected references.
- Ensure included optional references still generate or reuse their planned
  dependency as before.

### Slice 5: Cast Detail UI

- Add a small cast-member metadata row above the name.
- Place the role pill on the left and `Voice-over` shadcn toggle on the right.
- Persist toggle changes through
  `PATCH /screenplay/cast/:castMemberId/voice-over`.
- Remove the large profile placeholder for `isVoiceOver` Cast Members.
- Keep existing profile image layout for visual Cast Members.
- Keep voice sample playback accessible near the Cast Member name.

### Slice 6: Reference Tab UI

- Update Cast Character Sheets so voice-over Cast Members do not render.
- Ensure multi-shot groups show a General
  `Multi-Shot Storyboard Reference (N shots)` planned placeholder card for
  text-only, first-frame, first-and-last-frame, and reference input modes.
- Update General, Lookbook, Cast Character Sheet, and Location Sheet card
  inclusion controls so optional references can be excluded without changing
  shot cast, location, asset-choice, or prepared-input membership.
- Ensure required references cannot be excluded.
- Keep all interactive controls local shadcn primitives.

### Slice 7: Verification

- Run focused core tests for cast operations, shot-list schema validation, and
  dependency graph/reference projection.
- Run focused Studio tests for Cast Member detail and Reference tab behavior.
- Run package typecheck/lint for touched packages.
- Start or reuse `pnpm dev:studio`.
- Verify the desktop app in Browser/IAB at the current desktop viewport.
- Do not perform mobile verification unless explicitly requested.

## Test Plan

### Core Tests

Add or update tests proving:

- Cast Member add/update accepts `isVoiceOver`.
- Cast Member list/read returns `isVoiceOver`.
- Existing Cast Members default to `isVoiceOver: false` after migration.
- Narrator fixture/sample data is explicitly `isVoiceOver: true`.
- Voice-over Cast Members are not included in `cast-character-sheet` dependency
  slots.
- Voice-over Cast Members are not projected in Reference tab Cast Character
  Sheets.
- Shot reference inclusion defaults match generated dependency defaults.
- Multi-shot production groups project an optional
  `multi-shot-storyboard-sheet` dependency for text-only, first-frame,
  first-and-last-frame, and reference input modes.
- Multi-shot storyboard sheet references default included and can be excluded
  without changing production group shot membership.
- Excluding an optional General dependency removes it from the effective
  reference set without deleting available inputs.
- `first-frame` exclusion is rejected when `inputModeId` is `first-frame`.
- `first-frame` and `last-frame` exclusion is rejected when `inputModeId` is
  `first-last-frame`.
- custom `reference-image` dependencies can be excluded in reference-image
  intent.
- reference-image intent does not enforce a special "at least one included
  reference" rule.
- Excluding an optional cast character-sheet reference removes it from the
  effective reference set without changing shot cast membership.
- Excluding an optional Lookbook reference removes it from the effective
  reference set without changing the active Lookbook or selected Lookbook sheet.
- Excluding an optional Location Sheet reference removes it from the effective
  reference set without changing shot location membership or selected view ids.
- Excluding a required reference returns structured diagnostics.

### Studio Server Tests

Add or update tests proving:

- the reference inclusion route parses valid include/exclude/clear requests;
- the reference inclusion route requires `dependencyId` and accepts only
  `include`, `exclude`, or `null` for `inclusion`;
- invalid request fields produce structured `STUDIO_SERVER...` diagnostics;
- route handlers delegate to core without embedding business logic;
- responses include refreshed Scene Shot List resource keys.

### Studio UI Tests

Add or update tests proving:

- a voice-over Cast Member detail page does not render the profile placeholder;
- a visual Cast Member detail page still renders the profile area;
- the Voice-over control uses a local UI primitive and triggers persistence;
- Narrator does not appear in Cast Character Sheets when marked voice-over;
- required General `First Frame` and `Last Frame` cards are visibly locked for
  the intents that require them;
- multi-shot groups show a General
  `Multi-Shot Storyboard Reference (N shots)` placeholder for every input mode,
  including first-frame and first-and-last-frame;
- the `Multi-Shot Storyboard Reference (N shots)` card can be unchecked and
  stays unchecked after resource refresh;
- optional General cards can be unchecked and stay unchecked after resource
  refresh;
- optional Lookbook, Cast Character Sheet, and Location Sheet cards can be
  unchecked and stay unchecked after resource refresh;
- unchecking a cast reference does not mutate `castMemberIds` for the shot;
- unchecking a General reference does not delete the available/generated input;
- required references are not user-excludable.

### Migration Verification

Run:

```bash
pnpm drizzle-kit generate --config drizzle.config.ts --name cast-member-voice-over
```

from:

```text
packages/core
```

Apply to the active development project with:

```bash
renku project migrate urban-basilica
```

or the current project name used in the workspace.

If a direct database path is needed:

```bash
RENKU_PROJECT_DATABASE_PATH=/absolute/path/to/project.sqlite \
  pnpm drizzle-kit migrate --config drizzle.project-migrate.config.ts
```

Do not run migrations from Studio request handlers.

## Design QA Checklist

- The Voice-over toggle sits in the metadata row above the Cast Member name.
- The role pill and Voice-over control share one row without crowding the name.
- The toggle does not look like a major call to action.
- The voice sample button remains close to the name.
- The voice-over detail page does not show a profile-image empty state.
- The visual Cast Member detail page keeps the existing profile image treatment.
- The Reference tab has no Narrator card under Cast Character Sheets when
  Narrator is marked voice-over.
- Optional reference cards communicate included versus excluded state clearly.
- Multi-shot groups show a General
  `Multi-Shot Storyboard Reference (N shots)` placeholder even when the selected
  input mode is not Reference.
- The `Multi-Shot Storyboard Reference (N shots)` placeholder is visibly
  optional, not locked.
- The card title and surrounding copy do not confuse
  `shot.multi-shot-storyboard-sheet` with the temporary
  `scene.storyboard-sheet` slicing workflow.
- General cards use the same inclusion-state contract as Lookbook, Cast
  Character Sheet, and Location Sheet cards.
- Required First Frame and Last Frame cards are visibly non-excludable for the
  intents that require them.
- Required reference cards cannot be unchecked.
- Reference card copy stays intentional and does not expose raw ids, filenames,
  or fallback labels.

## Completion Checklist

### Review Area

- [x] Confirm the active sample project name for development migration
      verification.

### Architecture And Contracts

- [x] Update `CastMember` public contract with `isVoiceOver`.
- [x] Update `CastMemberInput` and cast operation schemas.
- [x] Update Scene Shot List contracts with explicit reference inclusion
      overrides keyed by dependency id.
- [x] Update Scene Shot List JSON Schema validation.
- [x] Add structured diagnostics for invalid required-reference exclusions.
- [x] Keep shot cast membership separate from optional reference inclusion.
- [x] Avoid role-text inference and compatibility aliases.

### Database And Migration

- [x] Add `is_voice_over` to the Drizzle `cast_member` schema.
- [x] Generate SQL with Drizzle Kit from `packages/core`.
- [x] Commit generated SQL, snapshot, and journal updates together.
- [x] Increment the core runtime schema generation constant.
- [x] Add the matching `PRAGMA user_version` statement to the migration.
- [x] Apply migration to the active development project.
- [x] Verify existing Cast Members default to `false`.
- [x] Mark Narrator fixture/sample authoring data explicitly as voice-over.

### Core Implementation

- [x] Persist `isVoiceOver` through cast add/update/import paths.
- [x] Return `isVoiceOver` from cast list/read/context resources.
- [x] Suppress visual generation readiness for voice-over Cast Members.
- [x] Exclude voice-over Cast Members from shot video character-sheet
      dependency declarations.
- [x] Exclude voice-over Cast Members from Reference tab Cast Character Sheets.
- [x] Implement effective reference inclusion resolution.
- [x] Declare `multi-shot-storyboard-sheet` for every production group with
      more than one shot, regardless of input mode.
- [x] Mark `multi-shot-storyboard-sheet` as optional in this slice.
- [x] Default `multi-shot-storyboard-sheet` to included for multi-shot groups
      until the user excludes it.
- [x] Include General first-frame, last-frame, reference-image, and
      multi-shot-storyboard-sheet dependencies in the inclusion resolver.
- [x] Include Lookbook, Cast Character Sheet, and Location Sheet dependencies in
      the inclusion resolver.
- [x] Use the dependency graph line's `required` state as the only source of
      truth for whether a Reference tab card can be excluded.
- [x] Preserve generated defaults when no user override exists.
- [x] Prevent required references from being excluded.
- [x] Do not add an aggregate "at least one included reference" validator for
      reference-image intent.

### Studio Server And Services

- [x] Add request parser for dependency-id reference inclusion mutations.
- [x] Add thin Studio route handler.
- [x] Add browser service function for reference inclusion mutations.
- [x] Ensure mutation responses return refreshed Scene Shot List resources and
      resource keys.
- [x] Keep route parsing and core business rules separated.

### Studio UI

- [x] Add the Cast Member Voice-over control using local shadcn UI primitives.
- [x] Persist Voice-over toggle changes.
- [x] Hide the profile placeholder for voice-over Cast Members.
- [x] Preserve visual Cast Member profile layout.
- [x] Update Reference tab inclusion toggles for optional General references.
- [x] Update Reference tab inclusion toggles for optional Lookbook, Cast
      Character Sheet, and Location Sheet references.
- [x] Ensure required references are visibly non-excludable.
- [x] Ensure First Frame is visibly non-excludable for `first-frame` and
      `first-last-frame` input modes.
- [x] Ensure Last Frame is visibly non-excludable for `first-last-frame` input
      mode.
- [x] Ensure multi-shot groups show
      `Multi-Shot Storyboard Reference (N shots)` for text-only, first-frame,
      first-and-last-frame, and reference input modes.
- [x] Ensure `Multi-Shot Storyboard Reference (N shots)` is optional and
      user-excludable in all input modes.
- [x] Ensure the generated asset uses purpose
      `shot.multi-shot-storyboard-sheet`, not `scene.storyboard-sheet`.
- [x] Ensure the generated asset is imported as a durable shot-video input
      reference, not discarded after slicing.
- [x] Ensure custom reference-image cards remain individually optional in
      reference-image intent.
- [x] Ensure unchecking optional Cast Character Sheets does not remove cast from
      the shot.
- [x] Ensure unchecking optional General references does not delete available
      inputs.
- [x] Keep all feature-code controls shadcn-based.

### Tests

- [x] Add focused cast operation tests for `isVoiceOver`.
- [x] Add migration/schema projection coverage.
- [x] Add dependency declaration tests for voice-over exclusion.
- [x] Add reference inclusion resolver tests.
- [x] Add optional General dependency exclusion tests.
- [x] Add multi-shot storyboard sheet projection tests for text-only,
      first-frame, first-and-last-frame, and reference input modes.
- [x] Add multi-shot storyboard sheet default-included and user-excluded tests.
- [x] Add required First Frame and Last Frame exclusion rejection tests.
- [x] Add reference-image intent coverage proving custom reference-image cards
      remain optional.
- [x] Add coverage proving reference-image intent does not enforce a special
      "at least one included reference" rule.
- [x] Add Lookbook, Cast Character Sheet, and Location Sheet optional exclusion
      tests.
- [x] Add required-reference exclusion diagnostic tests.
- [x] Add Studio server request/route tests.
- [x] Add Cast Member detail UI tests.
- [x] Add Reference tab UI tests for optional uncheck behavior.

### Desktop Verification

- [x] Run focused core tests.
- [x] Run focused Studio tests.
- [x] Run relevant package typecheck and lint.
- [x] Start or reuse the Studio dev server.
- [x] Verify Cast Member page for Narrator at desktop viewport.
- [x] Verify Cast Member page for a visual member at desktop viewport.
- [x] Verify shot References tab no longer shows Narrator under Cast Character
      Sheets.
- [x] Verify required General First Frame and Last Frame references are locked
      for the intents that require them.
- [x] Verify multi-shot `Multi-Shot Storyboard Reference (N shots)` appears in
      General for first-frame and first-and-last-frame input modes.
- [x] Verify multi-shot `Multi-Shot Storyboard Reference (N shots)` appears in
      General for text-only and reference input modes.
- [x] Verify multi-shot `Multi-Shot Storyboard Reference (N shots)` can be
      excluded and restored.
- [x] Verify optional General references can be excluded and restored.
- [x] Verify custom reference-image cards can be excluded in reference-image
      intent.
- [x] Verify optional Lookbook, Cast Character Sheet, and Location Sheet
      references can be excluded and restored.
- [x] Verify required references cannot be excluded.
- [ ] Capture Browser/IAB screenshots for the changed desktop surfaces.
  Browser screenshot capture timed out twice, including in a fresh tab. The
  OS-level fallback was not used because the approval reviewer rejected desktop
  capture as a privacy risk without explicit user approval.

### Documentation

- [x] Update architecture docs if `isVoiceOver` becomes part of the accepted
      Cast Member data model.
- [x] Update any user-facing command examples that create narrator Cast Members.
- [x] Record any schema-generation decision in the relevant architecture or ADR
      note if it changes project-open behavior.

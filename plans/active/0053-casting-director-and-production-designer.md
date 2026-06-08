# 0053 Casting Director And Production Designer

Status: implemented
Date: 2026-06-07

## Summary

Plan `0052` defines the top-level `movie-director` skill and its read-only
director context command. This plan defines the next layer down:

- a `casting-director` skill;
- a `production-designer` skill;
- first-class CLI and core backing for cast authoring, cast design, location
  authoring, and location production design.

The current Studio architecture can already read cast and locations, generate
cast and location media, and mutate cast/location records through screenplay
operations. That is enough for early screenplay work, but it is not enough for
department-level movie making.

The goal of this plan is to stop treating casting and production design as
side-effects of screenplay drafting. Screenplay remains the narrative source of
truth, but casting and production design need their own durable, validated,
agent-readable project data.

## Relationship To 0052

`plans/active/0052-movie-director-skill-and-department-workflows.md` now fixes
these decisions:

- the top-level orchestrator skill is `movie-director`;
- the director context command is `renku director context --json`;
- the casting specialist is `casting-director`;
- the production design specialist is `production-designer`;
- voice casting stays under `casting-director`;
- cast and production-design mutation commands are planned here, not inside the
  first `movie-director` slice.

The `movie-director` skill should use these specialist skills after this plan is
implemented. Before this plan is implemented, it should use the documented
fallbacks:

- `screenplay-drafter` for durable cast/location facts;
- `media-producer` for existing cast/location media generation purposes;
- `scene-shot-designer` for shot-list and coverage work.

## Existing State

### Cast Facts

Current `CastMember` fields are:

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

Current CLI read coverage:

```bash
renku screenplay cast list --json
renku screenplay cast show <cast-member-id> --json
```

Current mutation coverage is through:

```bash
renku screenplay apply --file <screenplay-operations-json> --json
```

with operations:

- `castMember.add`
- `castMember.update`
- `castMember.delete`
- `castMember.move`

Current media generation coverage:

```bash
renku generation context --purpose cast.character-sheet --target cast:<id> --json
renku generation context --purpose cast.profile --target cast:<id> --json
renku media import --purpose cast.character-sheet --target cast:<id> --source <path> --json
renku media import --purpose cast.profile --target cast:<id> --source <path> --json
```

### Location Facts

Current `Location` fields are:

```ts
export interface Location {
  id: string;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}
```

Current CLI read coverage:

```bash
renku screenplay location list --json
renku screenplay location show <location-id> --json
```

Current mutation coverage is through:

```bash
renku screenplay apply --file <screenplay-operations-json> --json
```

with operations:

- `location.add`
- `location.update`
- `location.delete`
- `location.move`

Current media generation coverage:

```bash
renku generation context --purpose location.environment-sheet --target location:<id> --json
renku media import --purpose location.environment-sheet --target location:<id> --file <import-json> --json
```

### Read Resources Already Exist

The core and Studio app already have useful read models:

- `readCastDesignResource`
- `readCastMemberResource`
- `readLocationResource`
- `readStudioSelectionContext`
- `readSceneShotListContext`
- media-generation contexts for cast, location, storyboard, and shot video.

This plan should reuse those ideas but add durable department authoring
contracts. It should not create wrapper modules or compatibility command paths.

## Problems To Solve

### Cast Is Both Narrative And Design

The screenplay needs cast facts such as name, role, want, need, and arc.

Casting also needs department design that is not always screenplay text:

- interpretation and performance direction;
- physical presence;
- face, posture, movement, and age read;
- wardrobe and costume continuity;
- costume variants scoped to sequences or scenes;
- visual references and anti-references;
- voice casting, voice samples, and locale-specific voice variants;
- readiness for character sheets, profiles, and future costume/voice media.

Putting all of that into screenplay `description` or `voiceNotes` would make the
screenplay carry too much department-specific state.

### Locations Are Not Production Design

The screenplay needs location facts such as name, time period, description, and
visual notes.

Production design needs more:

- architecture and spatial grammar;
- set dressing and surface materials;
- props and recurring objects;
- signage, graphics, atmosphere, clutter, damage, and cleanliness;
- environment-sheet readiness;
- scene-specific stage configurations;
- blocking constraints and handoff notes for shot design;
- continuity risks across scenes.

Putting all of this into `Location.visualNotes` would flatten production design
into a single paragraph and make it hard for agents to update safely.

### Current CLI Forces Department Work Through Screenplay Operations

The existing fallback works, but it has bad ergonomics:

- a casting agent must understand full screenplay operation documents;
- a production design agent must update location facts through a screenplay
  workflow;
- users cannot ask for "casting context" or "production design context" as a
  department surface;
- department-specific validation and diagnostics do not exist;
- future skills would be tempted to mutate `.renku/project.sqlite` directly.

### Dual Authoring Paths Would Break The Architecture

The new cast, location, Cast Design, and Location Design contracts must not
coexist with old authoring paths that mutate the same durable state.

Once this plan adds first-class cast and location commands, the existing
screenplay-routed cast/location mutation mechanisms must be cleaned up:

- remove `castMember.*` operations from `screenplayOperations`;
- remove `location.*` operations from `screenplayOperations`;
- update `screenplay-drafter` so it no longer authors cast or location records
  through screenplay JSON;
- update existing screenplay JSON contracts, validators, samples, and tests so
  screenplay commands reference durable cast/location records instead of
  creating or updating them;
- update CLI help and docs so users see one canonical cast authoring path and
  one canonical location authoring path;
- update core command code so package-boundary validation cannot accept both
  the old screenplay mutation path and the new department mutation path.

For a new movie, the user-facing agent workflow can still feel like one
creative act. The agent should sequence commands behind the scenes:

1. create or update Cast Members through `renku cast`;
2. create or update Locations through `renku location`;
3. create or update screenplay acts, sequences, scenes, and blocks through
   `renku screenplay`;
4. reference cast and locations by durable ids in scene settings and dialogue.

This matches the repository's pre-customer rule: when the contract changes,
update callers directly and delete the obsolete path in the same implementation
slice. Do not keep aliases, shims, fallbacks, wrapper commands, or tests whose
only purpose is to preserve the old format.

## Goals

1. Add first-class cast authoring commands for cast facts.
2. Add first-class location authoring commands for location facts.
3. Add durable Cast Design documents with history and one active design per cast
   member.
4. Add durable Location Design documents with history and one active design per
   location.
5. Keep voice casting under Cast Design.
6. Keep production design under the `production-designer` skill.
7. Let `media-producer` keep owning actual media generation and import.
8. Give `movie-director` and the specialist skills clear preflight context.
9. Use structured diagnostics and fail-fast behavior for missing screenplay,
    cast, location, scene, Lookbook, media, or design prerequisites.
10. Remove obsolete screenplay-routed cast and location mutation paths once the
    new cast/location commands exist.
11. Update existing skills, CLI docs, validators, samples, and tests so there is
    one canonical authoring path for each durable concept.

## Non-Goals

- Do not replace the screenplay as the narrative source of truth.
- Do not hide existing screenplay operations behind compatibility aliases.
- Do not add thin command wrappers whose only purpose is to avoid fixing callers.
- Do not keep dual ways to create or update Cast Members, Locations, Cast
  Design, or Location Design.
- Do not keep `screenplay-drafter` as a fallback authoring path for cast or
  location records after the new command contracts ship.
- Do not create a generic "department document" table.
- Do not create a generic "world bible" bucket.
- Do not implement full sound, music, editing, final assembly, or localization.
- Do not add paid generation behavior to casting or production-design commands.
- Do not run media generation without `media-producer`, persisted specs,
  estimates, approval tokens, and separate import.
- Do not add mobile UI work.

## Domain Model Direction

### Narrative Facts

Cast and location facts remain plain screenplay-owned concepts:

- `CastMember`
- `Location`

The new `renku cast` and `renku location` command families should mutate these
facts through focused core commands. They may share persistence rules with the
existing screenplay operation implementation, but their public contracts must be
real cast/location contracts with their own validation reports, diagnostics, and
resource keys.

After the focused command families exist, screenplay commands should only
reference cast and location records. They should not create, update, delete, or
move them. Any existing screenplay create/apply input shape that embeds
cast/location creation must be replaced by an orchestrated workflow where the
agent creates the department records first and then writes screenplay scenes
against durable ids.

### Cast Design

Add a durable Cast Design document for one cast member.

Proposed stored document:

```ts
export interface CastDesignDocument {
  kind: 'castDesign';
  castMemberId: string;
  design: {
    interpretation: CastInterpretation;
    appearance: CastAppearanceDesign;
    performance: CastPerformanceDesign;
    costume: CastCostumeDesign;
    voiceCasting?: CastVoiceCastingDesign;
    continuity: CastContinuityGuidance;
    generationGuidance: CastGenerationGuidance;
  };
  openQuestions?: string[];
}
```

Important sections:

- `interpretation`: how the role should be understood, what the audience should
  read, and what contradictions matter.
- `appearance`: age read, build, face, posture, movement, grooming, and
  silhouette.
- `performance`: behavioral pressure, stillness, gesture, status shifts, and
  scene energy.
- `costume`: base wardrobe logic plus scoped costume variants.
- `voiceCasting`: voice identity, accent, tempo, texture, emotional range, and
  locale notes.
- `continuity`: what must remain consistent across scenes and what can change.
- `generationGuidance`: positive/negative prompt guidance for character sheets,
  profiles, and future costume or voice media.

Costume variants should support scope:

```ts
export type CastDesignScope =
  | { kind: 'project' }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string };
```

The first Cast Design implementation can store costume variants inside the Cast
Design JSON. If variant-specific media becomes a requirement, add a later slice
with explicit costume variant IDs and asset relationships. Do not fake variant
ownership with filenames or role strings alone.

### Location Design

Add a durable Location Design document for one screenplay location.

Proposed stored document:

```ts
export interface LocationDesignDocument {
  kind: 'locationDesign';
  locationId: string;
  design: {
    spatialThesis: string;
    architecture: string[];
    setDressing: string[];
    materialsAndSurfaces: string[];
    atmosphere: string[];
    propsAndRecurringObjects: ProductionDesignProp[];
    continuity: string[];
    environmentSheetGuidance: string[];
    generationGuidance: string[];
  };
  openQuestions?: string[];
}
```

This document is location-level production design. It should not include shot
lists or final video directions. It can include production design guidance that
shot design later uses.

## Proposed CLI Surface

### Cast Fact Commands

Add:

```bash
renku cast list --json
renku cast show <cast-member-id> --json
renku cast context --cast <cast-member-id> --json
renku cast validate --file <cast-operations-json> --json
renku cast apply --file <cast-operations-json> --json
```

Proposed operation document:

```json
{
  "kind": "castOperations",
  "operations": [
    {
      "operation": "castMember.update",
      "castMember": {
        "id": "cast_ada",
        "handle": "ada",
        "name": "Ada",
        "role": "protagonist"
      }
    }
  ]
}
```

Rules:

- New cast members use `key`, not `id`.
- Existing cast members use durable `id`.
- Handles stay lower-case, stable, and unique across cast and locations.
- `cast apply` must not mutate scenes except for required referential cleanup
  when deleting a cast member, and that cleanup must be explicit in the report.
- `cast apply --dry-run` should report generated IDs, reference impacts, and
  Studio resource keys without mutating.

### Cast Design Commands

Add:

```bash
renku cast design context --cast <cast-member-id> --json
renku cast design list --cast <cast-member-id> --json
renku cast design show --active --cast <cast-member-id> --json
renku cast design show --design <cast-design-id> --json
renku cast design validate --file <cast-design-json> --json
renku cast design write --file <cast-design-json> --json
renku cast design set-active --cast <cast-member-id> --design <cast-design-id> --json
```

Context should include:

- project information and languages;
- screenplay summary and dramatic signals;
- target cast member facts;
- active Cast Design when present;
- scenes and sequences where the cast member appears;
- active Lookbook summary;
- selected character sheet and profile media;
- existing cast asset role counts;
- generation context readiness for `cast.character-sheet` and `cast.profile`;
- voice notes from the cast member record and active Cast Design.

### Location Fact Commands

Add:

```bash
renku location list --json
renku location show <location-id> --json
renku location context --location <location-id> --json
renku location validate --file <location-operations-json> --json
renku location apply --file <location-operations-json> --json
```

Proposed operation document:

```json
{
  "kind": "locationOperations",
  "operations": [
    {
      "operation": "location.update",
      "location": {
        "id": "location_control_room",
        "handle": "control-room",
        "name": "Control Room",
        "timePeriod": "Late 1970s",
        "description": "A cramped civic control room under budget pressure."
      }
    }
  ]
}
```

Rules:

- New locations use `key`, not `id`.
- Existing locations use durable `id`.
- Handles stay lower-case, stable, and unique across cast and locations.
- `location apply` must not rewrite scene blocks.
- Deleting a location must report affected scenes and either reject deletion
  when references remain or require an explicit reference cleanup operation.

### Production Design Location Commands

Add:

```bash
renku production-design location context --location <location-id> --json
renku production-design location list --location <location-id> --json
renku production-design location show --active --location <location-id> --json
renku production-design location show --design <location-design-id> --json
renku production-design location validate --file <location-design-json> --json
renku production-design location write --file <location-design-json> --json
renku production-design location set-active --location <location-id> --design <location-design-id> --json
```

Context should include:

- project information;
- target location facts;
- active Location Design when present;
- scenes that use the location;
- active Lookbook summary;
- selected environment sheet and azimuth views;
- selected location assets and role counts;
- generation readiness for `location.environment-sheet`.

## Core Backing

### Database Tables

Use Drizzle TypeScript schema as the source of truth and generate migrations
with Drizzle Kit.

Add tables:

```text
cast_design
cast_design_state
location_design
location_design_state
```

Each history table should store:

- durable id;
- owner id, such as `cast_member_id` or `location_id`;
- validated JSON text;
- short title or summary when useful for UI lists;
- created timestamp;
- source metadata when useful for agent-authored writes.

Each state table should store:

- owner id;
- active design id;
- update timestamp.

Rules:

- Do not store absolute paths in these documents.
- Store rich generated media as Assets, not inside design JSON.
- Validate JSON before writes and after reads.
- Unknown fields in these agent-authored stored JSON documents should be
  rejected unless a future architecture decision deliberately allows warnings.

### Core Commands

Add focused core command modules:

```text
packages/core/src/server/commands/cast-commands.ts
packages/core/src/server/commands/cast-design-commands.ts
packages/core/src/server/commands/location-commands.ts
packages/core/src/server/commands/production-design-commands.ts
```

These modules should stay shallow and purpose-specific. Do not add a giant
multi-department dispatcher.

### JSON Validators

Add JSON Schema and validators for:

- `castOperations`;
- `castDesign`;
- `locationOperations`;
- `locationDesign`.

Validation must check:

- required owner ids;
- owner existence;
- cast/location handle uniqueness;
- duplicate costume variant labels within one Cast Design;
- duplicate prop names within one Location Design when they would confuse
  downstream references.

### Project Data Service

Add project data service methods for:

- list/read/validate/apply cast operations;
- read cast design context;
- list/read/validate/write/set-active Cast Design;
- list/read/validate/apply location operations;
- read production-design location context;
- list/read/validate/write/set-active Location Design.

### Resource Keys And Studio Events

Emit resource keys for successful mutations:

- `navigation:cast`
- `surface:castMember:<cast-member-id>`
- `surface:castDesign:<cast-member-id>`
- `navigation:locations`
- `surface:location:<location-id>`
- `surface:locationDesign:<location-id>`

The exact resource key names should be reviewed against existing Studio
coordination conventions during implementation.

## Media Generation Relationship

Existing purposes remain:

```text
cast.character-sheet
cast.profile
location.environment-sheet
```

The new skills should hand off media generation to `media-producer`.

Do not add a new media purpose in the first implementation unless the design
contract already has a stable target. In particular:

- Costume-variant media needs durable costume variant identity before a purpose
  such as `cast.costume-sheet` can be reliable.
- Voice media needs a separate audio generation and locale contract before a
  purpose such as `cast.voice-sample` can be reliable.
- Prop or set-dressing media needs a first-class continuity reference or
  production design target before a purpose such as `production-design.prop`
  can be reliable.

The first skills can still use the existing `cast.character-sheet`,
`cast.profile`, and `location.environment-sheet` purposes to create useful
visual references.

## Skill Design

### Casting Director Skill

Create:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director
```

Use `skill-creator/scripts/init_skill.py` with `--resources references`.

The skill should:

- read cast context;
- create and revise cast facts;
- write Cast Design documents;
- manage costume and voice casting notes under Cast Design;
- check character-sheet/profile readiness;
- hand off to `media-producer` for cast media;
- report when costume-variant or voice-media generation is not first-class yet;
- tell `movie-director` when cast work changes shot or production-design needs.

### Production Designer Skill

Create:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/production-designer
```

Use `skill-creator/scripts/init_skill.py` with `--resources references`.

The skill should:

- read location and scene production-design context;
- create and revise location facts;
- write Location Design documents;
- check environment-sheet readiness;
- hand off to `media-producer` for location environment sheets;
- avoid storing shot lists, generated image paths, or final edit timing in
  production-design documents.

## Implementation Slices

### Slice 1: Cast And Location Fact Commands

Add `renku cast` and `renku location` command families for facts.

This gives specialist skills a narrow mutation surface before adding richer
design documents.

In the same implementation slice, remove the old screenplay-owned cast/location
mutation path. This includes:

- removing `castMember.add/update/delete/move` from screenplay operation
  validation and application;
- removing `location.add/update/delete/move` from screenplay operation
  validation and application;
- revising `screenplayCreate` if it currently creates cast/location records;
- updating screenplay JSON Schema exports and generated schemas;
- updating `screenplay-drafter` references and samples so cast/location records
  are created through `casting-director` or `production-designer` workflows;
- updating tests so they describe only the new intended behavior.

The goal is one authoring path, not a new path plus a legacy path.

### Slice 2: Cast Design Data And CLI

Add Cast Design tables, schema, validators, project-data service methods, CLI
commands, and tests.

Update media generation context for `cast.character-sheet` and `cast.profile`
to include active Cast Design summaries when present.

### Slice 3: Location Design Data And CLI

Add Location Design tables, schema, validators, project-data service methods,
CLI commands, and tests.

Update `location.environment-sheet` context to include active Location Design
summaries when present.

### Slice 4: Specialist Skills

Create `casting-director` and `production-designer` after their CLI contracts
exist or after the first accepted subset exists.

If a skill is created before every command exists, it must say exactly which
commands are available and which parts are not first-class yet. Once the new
commands exist, remove fallback instructions from existing skills rather than
keeping "old screenplay way" and "new department way" side by side.

### Slice 5: Director Context Integration

Update the `renku director context --json` projection from plan `0052` so it
uses:

- active Cast Design state;
- active Location Design state;
- cast visual readiness;
- production-design visual readiness.

## Expected Workflows

### Cast Refinement

User intent:

```text
Make Ada older, severe, and less polished. Give her a costume direction for the
council sequence.
```

Expected workflow:

1. `casting-director` reads `renku cast design context --cast <id> --json`.
2. It decides whether cast facts need to change.
3. It writes a Cast Design with updated appearance and costume variant.
4. It hands off to `media-producer` for a new character sheet only if the user
   wants media generation.
5. It reports that voice notes remain under casting and voice media generation
   is future work unless implemented.

### Location Production Design

User intent:

```text
Make the control room cramped, ceremonial, and full of obsolete civic machinery.
```

Expected workflow:

1. `production-designer` reads
   `renku production-design location context --location <id> --json`.
2. It writes or revises the active Location Design.
3. It recommends a new environment sheet if the selected one no longer matches.
4. It hands off to `media-producer` for `location.environment-sheet` only after
   the user approves generation.

## Risks

### Department Documents Become Vague Buckets

Risk:

Cast Design and Location Design could become generic bags of notes.

Mitigation:

- Use explicit JSON Schemas.
- Keep sections named after real department responsibilities.
- Reject unknown fields in stored design JSON.
- Keep screenplay facts separate from department design.

### Cast And Location Commands Become Aliases

Risk:

`renku cast apply` and `renku location apply` could become thin wrappers around
`screenplay apply`.

Mitigation:

- Give them dedicated JSON document kinds.
- Give them dedicated validators and reports.
- Emit department-specific resource keys.
- Share internal persistence only after validation has produced a deliberate
  cast/location command report.

### Costume Variant Media Has No Stable Target

Risk:

Agents may want sequence-specific costume sheets before there is durable costume
variant identity.

Mitigation:

- Store costume variants as authored Cast Design content first.
- Do not add `cast.costume-sheet` until a stable variant target and import
  relationship exist.
- Tell users when only general character sheets are currently supported.

### Production Design Overlaps Shot Design

Risk:

Production Design could start writing shot lists.

Mitigation:

- Scene Shot Lists store camera coverage.
- `production-designer` should not author shot lists or coverage documents.

### Voice Work Expands Too Early

Risk:

Voice casting could pull in audio generation, localization, and dubbing before
those contracts exist.

Mitigation:

- Keep voice casting under Cast Design as notes and future readiness.
- Do not add voice media generation until audio and locale contracts exist.

## Completion Checklist

### Review Area

- [x] Confirm that `casting-director` and `production-designer` are the accepted
  skill names.
- [x] Confirm that future voice casting remains under `casting-director`.
- [x] Confirm that `production-designer` owns location production design, while
  `scene-shot-designer` owns shot lists.
- [x] Confirm whether cast/location fact commands should ship before design
  document commands.
- [x] Confirm that costume-variant media and voice media are deferred until
  stable targets exist.

### Architecture And Contracts

- [x] Define the single-authoring-path rule for Cast Members.
- [x] Define the single-authoring-path rule for Locations.
- [x] Define how `screenplayCreate` references existing cast/location records
  after cast/location creation moves out of screenplay JSON.
- [x] Define how `screenplayOperations` behaves after `castMember.*` and
  `location.*` operations are removed.
- [x] Define `castOperations` JSON Schema.
- [x] Define `castDesign` JSON Schema.
- [x] Define `locationOperations` JSON Schema.
- [x] Define `locationDesign` JSON Schema.
- [x] Define Cast Design read/write/list/set-active reports.
- [x] Define Location Design read/write/list/set-active reports.
- [x] Define cast design context report.
- [x] Define production-design location context report.
- [x] Define structured diagnostics for missing cast, location, scene,
  sequence, Lookbook, design, and media prerequisites.

### Database And Core

- [x] Add Drizzle schema for `cast_design`.
- [x] Add Drizzle schema for `cast_design_state`.
- [x] Add Drizzle schema for `location_design`.
- [x] Add Drizzle schema for `location_design_state`.
- [x] Generate SQL migrations with Drizzle Kit.
- [x] Add database access modules for Cast Design.
- [x] Add database access modules for Location Design.
- [x] Add core command module for cast facts.
- [x] Add core command module for Cast Design.
- [x] Add core command module for location facts.
- [x] Add core command module for Production Design.
- [x] Add project-data service methods for every new command.
- [x] Remove screenplay operation handling for `castMember.*`.
- [x] Remove screenplay operation handling for `location.*`.
- [x] Remove screenplay create handling that creates cast/location records, or
  replace it with durable-id references only.
- [x] Emit Studio resource events after successful mutations.

### CLI

- [x] Add `renku cast list`.
- [x] Add `renku cast show`.
- [x] Add `renku cast context`.
- [x] Add `renku cast validate`.
- [x] Add `renku cast apply`.
- [x] Add `renku cast design context`.
- [x] Add `renku cast design list`.
- [x] Add `renku cast design show`.
- [x] Add `renku cast design validate`.
- [x] Add `renku cast design write`.
- [x] Add `renku cast design set-active`.
- [x] Add `renku location list`.
- [x] Add `renku location show`.
- [x] Add `renku location context`.
- [x] Add `renku location validate`.
- [x] Add `renku location apply`.
- [x] Add `renku production-design location context/list/show/validate/write/set-active`.
- [x] Keep command handlers thin and structured.
- [x] Avoid nested multi-purpose command bodies.
- [x] Remove CLI docs/help that present screenplay commands as the way to create
  or update cast/location records.

### Media Context Integration

- [x] Include active Cast Design summary in `cast.character-sheet` context.
- [x] Include active Cast Design summary in `cast.profile` context.
- [x] Include active Location Design summary in `location.environment-sheet`
  context.
- [x] Confirm no new media purpose is added without a stable target and import
  contract.

### Specialist Skills

- [x] Create `casting-director` with `skill-creator`.
- [x] Add casting department map/reference files.
- [x] Add cast authoring and Cast Design workflow references.
- [x] Add cast media handoff references.
- [x] Add voice casting notes under casting references.
- [x] Validate `casting-director` with `quick_validate.py`.
- [x] Create `production-designer` with `skill-creator`.
- [x] Add production design department map/reference files.
- [x] Add location design workflow references.
- [x] Add location media handoff references.
- [x] Validate `production-designer` with `quick_validate.py`.
- [x] Update `screenplay-drafter` so it no longer creates or updates cast and
  location records directly after the new commands ship.
- [x] Update `movie-director` so it routes cast work to `casting-director` and
  production-design/location work to `production-designer`.
- [x] Remove fallback language from skills once the new command path is
  implemented.

### Tests

- [x] Add core validation tests for `castOperations`.
- [x] Add core validation tests for `castDesign`.
- [x] Add core validation tests for `locationOperations`.
- [x] Add core validation tests for `locationDesign`.
- [x] Add command tests for `renku cast`.
- [x] Add command tests for `renku cast design`.
- [x] Add command tests for `renku location`.
- [x] Add command tests for `renku production-design location`.
- [x] Remove tests whose only purpose is to preserve cast/location mutation
  through screenplay operation documents.
- [x] Add tests proving screenplay operation documents reject `castMember.*`
  and `location.*` after the new commands ship.
- [x] Add tests proving screenplay scene/block references use existing durable
  cast/location ids.
- [x] Add resource event tests for each mutation family.
- [x] Add media context tests proving active design summaries appear when
  present and are absent when not present.

### Documentation

- [x] Update `docs/architecture/reference/domain-vocabulary.md`.
- [x] Update `docs/architecture/data-model-and-storage.md`.
- [x] Update `docs/architecture/reference/media-generation.md` if media context
  inputs change.
- [x] Update `docs/architecture/reference/studio-skills.md`.
- [x] Update CLI command docs.
- [x] Update `screenplay-drafter` JSON contract references and samples.
- [x] Update any existing skill docs that mention screenplay-routed
  cast/location mutation as an authoring path.
- [x] Add ADR documentation if the new department design documents become
  accepted architecture.

### Final Verification

- [x] Run focused core tests.
- [x] Run focused CLI tests.
- [x] Run `pnpm build:core` if core contracts changed.
- [x] Run `pnpm test:cli` if CLI commands changed.
- [x] Run skill validation for `casting-director` and `production-designer`.
- [x] Forward-test `casting-director` with a cast refinement prompt.
- [x] Forward-test `casting-director` with a costume variant prompt.
- [x] Forward-test `production-designer` with a location design prompt.
- [x] Confirm no paid generation runs without `media-producer`, an estimate, and
  approval.
- [x] Confirm no compatibility aliases, re-export stubs, or direct SQLite writes
  were added.
- [x] Confirm there is no remaining dual authoring path for Cast Members or
  Locations.

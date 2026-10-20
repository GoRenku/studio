# 0239 Cast, Location And Prop Detail Pages With Sectioned Descriptions

Status: implemented
Date: 2026-10-20

## Decisions

The user accepted every recommendation on the review page on 2026-10-20.

- **Fonts (extended by the user on 2026-10-20 to all of Studio):**
  - Studio bundles its three faces under `packages/studio/src/assets/fonts/`,
    each folder with its OFL licence, and declares them in
    `packages/studio/src/styles/fonts.css`, which `index.css` imports. That
    covers the main app and every Codex panel.
  - **Montserrat** (variable, 400–800) is used for all regular text.
  - **JetBrains Mono** (variable, 400–700) is used for all monospace text:
    `--font-mono` and `--dd-font-mono`.
  - **Courier Prime** (400, 700) is used for screenplay text
    (`--dd-font-script`).
  - Latin and Latin Extended subsets only. No npm package.
- **Location layout:** the wide hero band; Props use the left column.
- **Description sections:** exactly the key lists in Contracts.
- **Existing descriptions:** they migrate into `overview`. The implementer
  re-runs the updated skills on the local Sintel and Urban Basilica projects
  during verification.

## Summary

The Details pages for Cast Members, Locations and Props have several problems:

- They put 3,000 characters of bold intro text before the short, useful
  fields.
- They drop the line breaks in Cast descriptions.
- They leave a 1,000px empty column under the image.
- They show a large grey box when a profile is empty.

The descriptions themselves have no structure contract, so agents improvise
headings in capital letters inside free text.

This plan does three things:

- Redesigns the three Details tabs, using design-study Option A for Cast and
  Props and the wide-hero layout for Locations.
- Turns `description` into a small sectioned JSON document with a Core-owned
  JSON Schema.
- Updates the casting-director and production-designer skills to write it.

## Context

- Design study (published privately): the user chose Option A for Cast on
  2026-10-20. The Location and Prop layouts come from the study's "Locations
  and props" section and still need confirmation (Decision 4).
- `docs/architecture/json-storage-validation.md`: every JSON stored in SQLite
  has a JSON Schema, AJV on write and read, and structured diagnostics.
- `docs/architecture/reference/drizzle-migrations.md`: Drizzle Kit workflow;
  the custom migration via `drizzle-kit generate --custom`.
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`: profile text
  is authored domain text. Studio validates the envelope (section keys,
  non-empty strings) and never the content.
- `docs/architecture/reference/front-end-guidelines.md`, and the AGENTS.md rules on
  shadcn controls and UI copy.
- Sister repo `studio-skills`:
  - `skills/casting-director` (`references/cast-authoring.md`)
  - `skills/production-designer` (`references/location-authoring.md`,
    `references/prop-authoring.md`)
  - `skills/movie-director/references/workflow-playbooks.md`
- Real projects for verification:
  - `~/renku-movies/sintel`: long sectioned text, voice sample, images.
  - `~/renku-movies/big-fish`: 37 empty Cast Members.
  - `~/renku-movies/urban-basilica`.
- Plan 0240 (Character Arcs) adds the Arc tab next to Details. It touches the
  Cast panel tabs, but not the Details tab built here.

## Product Behavior

### Cast Details tab

**Layout.** The grid has a 280px left column and a flexible right column, with
48px between them. The page padding is 28px top and 32px sides.

**Left column** (sticky, top 24px):

- The square profile image (existing `ContinuityFeatureImage`); clicking it
  opens the preview.
- With no image, the placeholder shows a person icon and "No profile image
  yet", at the same size.
- When Voice-over is on, the image is not shown.
- Below the image, separated by a rule:
  - "Play voice sample" (play/pause Button), only when a default voice
    sample exists;
  - the Voice-over setting: "Voice-over only" with the helper line and a
    Switch.

**Right column** (text is at most about 68 characters wide):

1. Name: `h1`, 40px, weight 800, `text-wrap: balance`.
2. Role line: 15px, muted. When age is set, it reads "Role · Age 61". With no
   role and no age, the line is omitted.
3. Story box: rows for Want, Need and Arc, each with a small uppercase label
   column. Only filled fields appear, and the box is omitted when all three
   are empty.
4. Description sections in the Cast order:
   - Overview with no heading.
   - Every other section under a 16px semibold heading.
   - Paragraphs come from blank-line breaks in the stored text. This is
     presentation-only splitting; the text is shown exactly as stored.
5. Voice section: heading "Voice", with the voice notes.
6. Source footnote: a small muted line, label "Source", from the
   `sourceNotes` section.
7. Missing-fields line: "Not written yet:" followed by the empty items among
   Want, Need, Arc, Description and Voice notes. It is omitted when nothing
   is missing.

### Location Details tab

- **Hero band.** The selected hero image fills the full width at 380px tall,
  cropped from the center, and opens the preview on click. With no selected
  hero, the band is not rendered.
- **Below the band** is a grid: the main column, then a 300px side column
  with 48px between them.
  - **Main column:**
    - the name (same title style as Cast);
    - the time period as a muted line when set;
    - the description sections in the Location order;
    - the Source footnote;
    - the missing-fields line (Description, Visual notes).
  - **Side column:** a sticky "Visual notes" card, omitted when empty.

### Prop Details tab

- **Layout.** A 340px left column, then the main column, with 44px between
  them.
- **Left column (sticky):**
  - the 16:9 hero image (preview on click);
  - with no hero, a quiet placeholder at the same aspect ratio reading "No
    prop hero image yet";
  - under the image, the Visual notes card.
- **Main column:**
  - the name;
  - the description sections in the Prop order;
  - the Source footnote;
  - the missing-fields line.
- The tab label "AssetFiles" becomes "Assets".

### Overview cards

Unchanged. The Cast, Location and Prop overview panels never render
descriptions; they show role and time period only.

## Worked Examples

These are real records from the local sample projects. They show exactly
what is stored and what is shown. Sintel and Big Fish are only examples:
the same rules apply to every project.

### Sintel, after the updated casting skill rewrites her description

Stored `cast_member.description` (Overview omitted because the skill did not
write one):

```json
{
  "appearance": "The screenplay introduces Sintel as a young girl, slender and clad in leather, scavenging empty carts in an alley near the market. Her exact age, original hair colour, eye colour and ancestry are not specified. She says she has been alone for as long as she can remember. Hunger is visible in her stomach growling when she encounters the injured baby dragon, and her desperate eyes establish her precarious life.",
  "behavior": "She is alert, agile and accustomed to defending herself: she draws a knife at a sound, vaults onto a roof, spins and parries with a spear, and leaps from the ziggurat towards the city wall. She initially approaches the baby creature armed, then lowers her knife on seeing its pleading eyes and injured wing. She bandages it carefully, offers meagre crumbs, strokes its head and sleeps with her arm over its wing. This care develops into companionship with Pup. She laughs, runs and cheers during his hunting and flying, while anxiety about his safety quickly surfaces. His abduction transforms her affection into a relentless search. The Shaman shelters and redirects her after she collapses.",
  "wardrobe": "Young Sintel wears leather; she later wears a cloak at the ziggurat. On her quest she carries a heavy cloak, backpack and walking stick, uses a hunting knife from her belt and fights with a spear. In the opening fight she takes a gatekeeper's double-bladed staff. In the lair the script also calls her weapon a sword; that terminology should remain an unresolved weapon-continuity detail rather than a new character fact. At the climax her reflected appearance reveals completely white hair, an ashen, scarred face, deep fight wounds, a burnt arm, developed muscles, brown weather-aged skin and threadbare clothing after fifteen bitter years. This is the same woman, not a separate older character. Earlier subjective impressions of apparently unharmed skin must not erase the final reveal. In the ending her athletic figure is bent, her movement slow, and she drops armour and tool belts behind her.",
  "performance": "Her progression includes guarded hunger, tentative tenderness, shared joy, terror at separation, grim resolve, exhaustion, despair, explosive anger and devastated recognition. She is panting and limping after the gatekeeper fight, collapses in the snow, and admits to the Shaman that she is lost and has failed. She fights through predators, hostile weather and difficult terrain. In the cave her rage drives the fatal throat strike; eye contact and the familiar wing scar reveal that her supposed enemy is grown Pup. Her reflection then forces recognition of the time and damage consumed by her quest. The final baby dragon follows her; the screenplay ends on their encounter without showing an explicit adoption or reconciliation.",
  "sourceNotes": "Scenes 1–14. All physical facts above come from the imported screenplay; motivation and dramatic need below are interpretive readings of those actions."
}
```

The Details tab shows:

- the rail: portrait, "Play voice sample", "Voice-over only" (off);
- the name "Sintel";
- the role line "Human protagonist; solitary survivor, caregiver and dragon
  hunter";
- the Story box with Want, Need and Arc;
- four headed sections, in order: Identity and appearance, Behavior and
  relationships, Clothing and physical continuity, Performance and story
  continuity;
- Voice;
- the Source note "Scenes 1–14. All physical facts…";
- no missing-fields line.

### Sintel, right after the migration (before any skill re-run)

```json
{ "overview": "IDENTITY AND APPEARANCE\nThe screenplay introduces Sintel… (the full original text, unchanged)" }
```

The Details tab shows it as five paragraphs with no headings. Each paragraph
still begins with its old capital-letter line, as plain text.

### Shaman (migrated; no headings in the original)

```json
{ "overview": "A blind man with a wrinkled face, living in a dark mountain hut. His candle-lit face appears in dreamlike flashes as Sin… (three paragraphs separated by blank lines)" }
```

The Details tab shows three plain paragraphs. The missing-fields line reads
"Not written yet: Need".

### Edward Bloom (Big Fish, all fields empty)

`description` is SQL `NULL`. The Details tab shows:

- the rail with a "No profile image yet" placeholder and the Voice-over
  setting;
- the name and the role line "protagonist";
- "Not written yet: Want · Need · Arc · Description · Voice notes".

### Dragon Lair Cavern (Location)

```json
{
  "storyUse": "A huge cavern at the heart of the volcano cave, reached from Scene 12 and used for the nighttime climax in Scene 13. Grown Pup moves ominously in the dark. A sleeping baby dragon lies in a nest in the far corner. Sintel attempts to circle behind the adult and approach the nest. A stalagmite provides cover before the adult smashes it; other rocks and cover allow evasive movement. The baby later hides behind a rock. Sintel is thrown against a cave wall, then fights close to the nest and dragon.",
  "spaceAndLayout": "The cavern must contain the adult's wings and body, nest, traversable ground, successive cover positions and route back to the exit. Distances, orientations, rock type, exact plan and nest construction are unspecified. The dragon's eyes reflect Sintel's aged appearance; a pool of its blood gathers during the fatal encounter. This is an effect and surface condition, not an invented mirror prop.",
  "statesAndChanges": "After Pup dies, loosened stones and then larger boulders roll down, threatening the entrance. A last ray of light points Sintel towards escape as fire and smoke spread and the cave crumbles. She scrambles over rocks, leaving his body behind; collapse follows her. Maintain intact, combat-damaged and collapsing states. Fire is explicitly from the dragon and spreading aftermath; no visible lava lake is authored.",
  "sourceNotes": "Scenes 12–13."
}
```

### Gatekeeper Double-bladed Staff and Medallion (Prop)

```json
{
  "storyUse": "A double-bladed staff taken by Sintel from an attacker during Scene 1. In Scene 10 the Shaman picks up this same captured weapon, described as pilfered from the Gatekeepers. At its centre is an iron medallion. He rubs grime from the blade and reveals the medallion and its imagery.",
  "formAndMaterials": "The emblem combines a dragon insignia with an emblematic map: a curious tree with snake-like branches sits below a volcano, and a cave entrance lies beside the tree. This supplies the route to the dragon blood tree and is the object's explicit narrative function. The screenplay does not say the medallion detaches, is magical, or proves the attackers' allegiance. Keep it as an integral part of the staff rather than a separate loose map or pendant.",
  "statesAndContinuity": "Its physical continuity runs from enemy weapon to captured object to grimy clue to readable map. No overall length, shaft material, blade profile, engraving technique or colour beyond iron is stated. The script does not explicitly identify this staff as every weapon used in the lair.",
  "sourceNotes": "Scenes 1 and 10."
}
```

## Architecture Shape Gate

### Ownership

- **Core** owns:
  - the section keys and their order for each subject;
  - the JSON Schemas;
  - AJV validation on write and read;
  - the data migration.
- **The CLI** stays thin: it reads the operation files, calls Core, and
  prints the result.
- **The Studio server** is unchanged apart from serializing the new shape
  (the routes already pass the resources through).
- **Studio React** only renders: section headings (UI copy), splitting
  paragraphs for display, and layout.
- **studio-skills** owns the authoring guidance for what goes in each
  section.

### File layout

**Core, browser-safe** (`packages/core/src/client/`):

- `profile-descriptions/model.ts`:
  - the `CastMemberDescription`, `LocationDescription` and `PropDescription`
    types;
  - the readonly key-order constants `CAST_MEMBER_DESCRIPTION_SECTION_KEYS`,
    `LOCATION_DESCRIPTION_SECTION_KEYS` and `PROP_DESCRIPTION_SECTION_KEYS`.
- `profile-descriptions/schemas.ts`: `castMemberDescriptionSchema`,
  `locationDescriptionSchema` and `propDescriptionSchema`, as plain JSON
  Schema objects (`$id` `https://schemas.gorenku.com/studio/<name>.schema.json`).
- `client/index.ts` exports the types and key constants. This is the existing
  public entrypoint; no new barrel.
- `department-design-json-schemas.ts` (existing): `castMemberInputSchema`,
  `locationInputSchema` and `propInputSchema` reference the new description
  schemas by `$ref`.

**Core, server** (`packages/core/src/server/`):

- `profile-descriptions/validator.ts`: one cached AJV 2020 instance with the
  three schemas registered once.
  - `parseStoredCastMemberDescription`, `parseStoredLocationDescription`
    and `parseStoredPropDescription` for read-back; they parse JSON text and
    throw structured diagnostics.
  - `serializeProfileDescription` for writes.
- `database/access/cast-members.ts`, `locations.ts` and `props.ts`: these
  serialize on write and parse and validate on read through the validator
  above. No other module parses the column.
- Existing readers (`resources/continuity-subjects.ts`,
  `media-generation-context/scene-context.ts`,
  `screenplay-analysis/context.ts`, `screenplay/context/scene-beats.ts`,
  `location-worlds/*`, `commands/*-commands.ts`, `commands/*-design-commands.ts`)
  pass the typed object through. Their only change is the type.

**Migration:** `packages/core/drizzle/<next>_sectioned_profile_descriptions.sql`,
generated with `pnpm drizzle-kit generate --config drizzle.config.ts --custom
--name sectioned_profile_descriptions`. It contains three `UPDATE` statements
plus `PRAGMA user_version = <next>`.

**Studio** (`packages/studio/src/features/movie-studio/`):

- `continuity/profile-description-sections.tsx` renders a description, given
  an ordered list of `{ key, heading }` for the subject. It handles the
  heading-less overview, paragraph splitting and the source footnote.
- `continuity/profile-description-headings.ts` holds the heading copy for
  each subject (UI copy only).
- `continuity/profile-missing-fields.tsx` renders the "Not written yet:" line.
- `cast/cast-member-details-tab.tsx` becomes a thin layout composing:
  - `cast/cast-member-profile-rail.tsx`: image, voice sample, Voice-over
    setting.
  - `cast/cast-member-story-summary.tsx`: the Want/Need/Arc box.
  - `cast/use-cast-voice-sample-player.ts`: the voice sample's audio
    play/pause state, moved out of the tab component.
- `locations/location-details-tab.tsx` holds the hero band, main column and
  side card.
- `props/prop-details-tab.tsx` holds the rail and main column.

**Shared side card.** The sticky "Visual notes" card is
`continuity/profile-side-note.tsx`, used by the Location and Prop tabs.

### Bounded branches

- Choosing sections per subject is data (a heading list passed in), not a
  `switch`.
- No component branches on subject kind beyond choosing which heading list
  to pass.

### Forbidden shapes

- No parsing of capital-letter headings or any guessing of sections from
  existing text, in runtime code or in the migration.
- No legacy-string fallback when reading `description`: every stored value
  must pass the schema, or the read fails with a structured diagnostic.
- No `dangerouslySetInnerHTML`, no Markdown rendering, and no raw HTML
  controls in feature code (use `Button`, `Switch` and the local `src/ui`
  primitives).
- No new barrel or re-export files.
- `cast-member-details-tab.tsx` must not keep the audio logic, the layout and
  every section inline in one component.

### Stop conditions

Stop and revise if:

- any reader outside `database/access/*` starts parsing the description JSON;
- a component starts accumulating per-subject `if` branches;
- the migration needs anything beyond wrapping existing text into
  `overview`.

## Contracts

### Description document (stored JSON and CLI input)

```json
{
  "overview": "Plain text. Blank lines separate paragraphs.",
  "appearance": "…",
  "behavior": "…",
  "wardrobe": "…",
  "performance": "…",
  "sourceNotes": "…"
}
```

**Allowed keys by subject:**

| Subject | Keys |
|---|---|
| Cast Member | `overview`, `appearance`, `behavior`, `wardrobe`, `performance`, `sourceNotes` |
| Location | `overview`, `storyUse`, `spaceAndLayout`, `statesAndChanges`, `sourceNotes` |
| Prop | `overview`, `storyUse`, `formAndMaterials`, `statesAndContinuity`, `sourceNotes` |

**Rules:**

- The value is an object with `additionalProperties: false` and
  `minProperties: 1`.
- Every value is a string with `minLength: 1` that is not whitespace only
  (`pattern: "\\S"`).
- An absent description stays SQL `NULL` (the field is omitted). An empty
  object is invalid; omit the field instead.

### CLI

The command names stay the same: `renku cast|location|prop validate|apply
--file`. In the input, `description` now takes the section object. An unknown
section key is reported through the existing unknown-field error
(`PROJECT_DATA214`), with its location (for example
`operations[0].castMember.description.backstory`).

### Diagnostics

`PROFILE_DESCRIPTION_STORED_INVALID` is raised when a stored description fails
the schema on read. Its details name the subject kind, id and AJV issues.

### Client types

- `CastMember.description?: CastMemberDescription`
- `Location.description?: LocationDescription`
- `Prop.description?: PropDescription`

The resource responses in `studio-project-contracts.ts` follow these types
automatically.

## Implementation Slices

1. **Core contract.**
   - Add `profile-descriptions/model.ts` and `schemas.ts`.
   - Wire the `$ref`s into the operation input schemas.
   - Add `server/profile-descriptions/validator.ts`.
   - Change the three `database/access/*` modules to serialize on write and
     parse on read.
   - Update the client types and the readers listed above (type-only
     changes).
   - Update the fixtures in `server/testing/*` and the e2e fixture
     `studio/e2e/fixtures/studio-e2e-project.ts` to sectioned descriptions.
2. **Migration.** Generate the custom migration with Drizzle Kit, add the
   three `UPDATE … SET description = json_object('overview', description)
   WHERE description IS NOT NULL AND trim(description) <> ''` statements and
   the `user_version` bump, and document it in `drizzle-migrations.md`.
3. **Studio shared pieces.** Add `profile-description-sections.tsx`,
   `profile-description-headings.ts`, `profile-missing-fields.tsx` and
   `profile-side-note.tsx`.
4. **Cast Details.** Split `cast-member-details-tab.tsx` into the rail, the
   story summary and the voice-sample hook, and apply the Option A layout.
5. **Location and Prop Details.**
   - Add the wide hero band to the Location tab and the rail layout to the
     Prop tab.
   - Fix the "AssetFiles" label in `prop-panel.tsx`.
6. **Skills (studio-skills repo).**
   - `casting-director/references/cast-authoring.md`: document every
     Cast Member field, including the description sections, what belongs in
     each, and that Source says which statements come from the screenplay and
     which are interpretation. Add a full `castMember.add` example. Remove
     the vague "more detailed descriptions" wording in `SKILL.md`, and point
     to the section guidance instead.
   - `production-designer/references/location-authoring.md` and
     `prop-authoring.md`: the same for their sections.
   - Add `samples/cast-operations.json`, `samples/location-operations.json`
     and `samples/prop-operations.json`, using Sintel content.
   - `movie-director/references/workflow-playbooks.md` and
     `screenplay-supporting-material-importer/references/workflow.md`: update
     the enrichment wording to "write descriptions into the sections".
   - Instruct agents never to put headings inside section text.
7. **Docs.**
   - `docs/cli/commands.md`: the operation file examples.
   - `docs/architecture/data-model-and-storage.md`: the description sections.
   - `docs/architecture/reference/studio-skills.md`: the contract pointer.
   - ADR `docs/decisions/0124-store-profile-descriptions-as-fixed-sections.md`.

## Tests And Guardrails

**Core**

- Operation validation accepts each subject's keys, and rejects unknown keys,
  empty strings and an empty object with locations.
- Apply writes JSON, and read-back returns the typed object.
- A hand-corrupted stored value fails with
  `PROFILE_DESCRIPTION_STORED_INVALID` (in
  `department-design-commands.test.ts` and a new
  `profile-descriptions/validator.test.ts`).

**Migration**

A fixture database with string descriptions migrates to
`{"overview": …}`; NULL and blank values stay NULL. Add this beside the
existing migration tests in `database/lifecycle/`.

**CLI**

`cli-workflows.test.ts` applies a sectioned cast file and shows it back.

**Studio**

`cast-member-panel.test.tsx`, `location-panel.test.tsx` and
`prop-overview-panel.test.tsx` cover:

- section order;
- the overview with no heading;
- the source footnote;
- the missing-fields line;
- no image box when the Location has no hero;
- Voice-over hiding the image but keeping the setting;
- the "Assets" label.

**Architecture**

The existing import-boundary tests continue to pass. Add one import-boundary
check in `packages/core/src/server/architecture.test.ts`: only modules under
`database/access/` import the stored-description validator module. The check
protects a module boundary, not helper names.

## Documentation

- ADR 0124 (new).
- `docs/architecture/data-model-and-storage.md`.
- `docs/architecture/reference/drizzle-migrations.md` (the custom migration
  note).
- `docs/cli/commands.md`.
- `docs/architecture/reference/studio-skills.md`.
- The studio-skills references and samples listed in slice 6. The
  studio-skills plugin version is bumped in that repo's release step.

## Final Verification

- Run `pnpm build`, `pnpm test`, `pnpm lint` and `pnpm check`.
- Back up the project databases, then run `renku project migrate` on Sintel,
  Big Fish and Urban Basilica, and confirm every description reads back.
- In Studio, at desktop width, check:
  - Sintel (long, voice sample, image);
  - Shaman;
  - Edward Bloom (empty);
  - Dragon Lair Cavern;
  - the Gatekeeper staff (long name);
  - a location with no hero image.

  Compare the screenshots with the approved study.
- Run `renku cast validate` on the new skill sample files.
- **Architecture-shape review:**
  - inspect `git diff --stat`;
  - confirm `cast-member-details-tab.tsx` is a thin composition;
  - confirm no reader outside the access layer parses descriptions;
  - confirm `index.ts` files only gained exports;
  - confirm no formatting churn in touched files.

## Completion Checklist

### Review Area

- [x] The Decisions section is followed, including the bundled fonts
      (Montserrat, JetBrains Mono, Courier Prime) loading in the main app and
      in the Codex panel builds.
- [x] The implementation keeps the section rules in Core and only rendering
      in Studio.
- [x] The final file shape matches the Architecture Shape Gate; no god
      component.

### Architecture And Contracts

- [x] The JSON Schemas live in `client/profile-descriptions/schemas.ts`,
      with AJV on write and read.
- [x] The operation input schemas `$ref` the description schemas; unknown
      keys use `PROJECT_DATA214`.
- [x] `PROFILE_DESCRIPTION_STORED_INVALID` is raised on bad stored data, with
      no string fallback.
- [x] Client types are updated; no duplicate string field or convenience
      mirror.

### Implementation Slices

- [x] Slice 1: Core contract, validator, access-layer serialization and
      readers.
- [x] Slice 2: custom Drizzle Kit migration with the `user_version` bump.
- [x] Slice 3: shared Studio description, missing-fields and side-note
      pieces.
- [x] Slice 4: Cast Details in Option A, split into rail, story summary and
      voice hook.
- [x] Slice 5: Location wide hero, Prop rail, "Assets" label.
- [x] Slice 6: studio-skills guidance, examples and samples.
- [x] Slice 7: docs and ADR 0124.

### Tests And Guardrails

- [x] Core validation and read-back tests, including corrupted stored data.
- [x] Migration test (strings to overview; NULL and blank stay NULL).
- [x] CLI workflow test with a sectioned file.
- [x] Studio panel tests for section order, empty states and the Voice-over
      behavior.
- [x] The static check that only the access layer parses the description
      column.

### Documentation

- [x] ADR 0124, the data model, the drizzle migration notes and the CLI
      commands are updated.
- [x] The studio-skills references and samples are updated together with the
      CLI contract.
- [x] No historical plans edited for naming.

### Final Verification

- [x] `pnpm build`, `pnpm test`, `pnpm lint` and `pnpm check` pass.
- [x] The three real projects migrate and read back.
- [x] Screenshots of the six pages are checked against the approved study.
- [x] `git diff --stat` is reviewed, and the large or heavily changed files
      are inspected.
- [x] `index.ts` files remain thin entrypoints.
- [x] No checklist item was satisfied by accepting an unreviewable structure.

Verification notes (2026-10-20):

- Core: 806 tests pass. Studio: 687 pass. CLI: 161 unit tests and 39 of 40
  integration tests pass. The one failure ("reports missing Studio dev server
  status for agents") predates this change: it expects the event-store path
  `~/.config/renku/` but the CLI resolves `~/.local/state/renku/`.
- Lint passes, and the full Studio build passes. The fonts are embedded in
  every Codex panel build.
- Sintel, Big Fish and Urban Basilica upgraded automatically on open, each
  with a backup.
- Sintel's descriptions were rewritten into sections: 35 records. The text is
  identical word for word; only the old heading lines were removed. Urban
  Basilica needed no changes.
- The Cast (Sintel, Edward Bloom), Location (Dragon Lair Cavern, Ashton River
  with no hero image) and Prop (Gatekeeper staff) pages were checked in Studio.

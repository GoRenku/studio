# 0181 Storyboard-Native Continuity Sheets And Agent Quality Modes

Status: completed
Date: 2026-08-17
Completed: 2026-08-17

## Review Attention

- This plan follows completed Plan 0180. It does not rewrite that implemented
  baseline. Plan 0180's Storyboard Lookbook appearance authority, exact
  request-scoped references, GPT Image 2 execution paths, Beat batching,
  one-/two-/three-/four-Beat layout rules, and vision-guided crop workflow all
  remain in force unless this plan narrows them explicitly.
- The main product addition is a reusable **Storyboard continuity sheet**
  workflow for Cast Members, Locations, and Props. These remain ordinary
  `character_sheet`, `location_sheet`, and `prop_sheet` Assets. No new Asset
  type, GenerationPurpose, owner, selection table, or durable dependency model
  is added.
- Asset intended-use metadata is renamed from nullable scalar `purpose` to
  non-null `tags: string[]`, stored in SQLite as a JSON text array. One Asset
  may carry any number of short tags. Storyboard continuity sheets add the
  exact tag `storyboard`; one-line summaries remain free to describe the
  variant in human-readable prose. Core validates only the list structure and
  never infers style, filters candidates, or auto-selects a reference from tag
  meaning.
- Focused media import gains optional Asset metadata so attachment and tagging
  are one Core-owned atomic intent. `--summary` and `--reference-name` become
  effective for focused single-file `renku media import`; singular
  `--reference-purpose` is replaced directly by repeatable `--tag`.
  `renku asset update` uses the same repeatable flag and adds `--clear-tags` for
  an explicit empty list. This changes the public Core/CLI Asset contract but
  adds no new command or Settings surface.
- Generation reference candidates gain the Asset's existing
  `oneLineSummary` and `referenceName` values plus `tags`. Agents and users
  can therefore distinguish Storyboard continuity candidates from Production
  candidates without guessing from filenames. Runtime still exposes every
  eligible same-owner sheet and does not make the choice.
- `cast.character-sheet`, `location.sheet`, and `prop.sheet` context gains the
  current Storyboard Lookbook Sheet as an additional optional named slot.
  Existing Production Lookbook and same-owner continuity slots remain. The
  agent selects exactly one appearance authority for the requested artifact.
- Character Sheets use one universal layout in both Production and Storyboard
  rendering: one large straight-on face close-up with metadata and applicable
  accessory details below it, followed by full-length front, back, left
  profile, and right profile views with a labeled height ruler. Production
  versus Storyboard changes rendering style only, never the layout.
- Generated-image review supports two agent-owned modes: **review-first** by
  default and **strict iterative** only after explicit user opt-in. Review-first
  shows one result and quality feedback, then lets the user accept, regenerate,
  or discard. Strict iterative may author new reviewed requests until the
  result passes, the user stops, or a real blocker/approval boundary is
  reached.
- Quality findings never become a runtime attachment gate. In either mode the
  user may accept and attach an imperfect result after seeing the image and the
  agent's feedback.
- Strict iteration does not waive existing usage, Preview, confirmation,
  estimate-token, concurrency, or provenance rules. Every creative revision is
  a new GenerationSpec and request. The agent must not issue blind identical
  retries for a visual-quality failure.
- This plan includes a breaking Asset schema/public-contract cutover and a
  Drizzle Kit migration. Migration 0077 renames `purpose` to `tags`, converts
  null to `[]`, and preserves every non-null current value as a one-element JSON
  tag array. Runtime code, CLI flags, docs, tests, and callers move directly to
  `tags`; no scalar alias, dual reader, fallback parser, or compatibility
  diagnostic remains.
- No Studio UI behavior change, HTTP route, Project Setting, persisted QA mode,
  runtime semantic tag parser, image-content validator, automatic reference
  selection, or automatic global sheet generation is planned. Existing UI
  fixtures change only as required by the public Asset shape.
- Existing Urban Basilica values are preserved as singleton tags; no existing
  Asset is newly tagged `storyboard` by migration. Untagged Assets remain
  eligible reference fallbacks. The two temporary Urban and Mehmed II test
  outputs remain unattached and are not migration inputs or accepted project
  media.
- Automated migration proof runs first on an isolated Urban Basilica copy.
  After all checks pass, implementation upgrades the live database through the
  existing backed-up `renku project migrate urban-basilica` path. No media file
  is rewritten or attached by that database upgrade.
- The isolated populated-project rehearsal exposed one necessary migration
  correction: Drizzle's generated parent-table rebuild cannot drop `asset`
  inside its migration transaction while populated file, membership, and
  selection tables reference it. Migration 0077 therefore uses a documented
  in-place add/populate/drop-column conversion. The Drizzle-generated snapshot
  and journal remain authoritative, and the resulting schema is unchanged.
- The existing Studio generation-reference HTTP response now projects the
  three added candidate metadata fields. This is direct public-contract
  fallout, not a new route or UI behavior.
- No product decision remains open inside this plan. The user's implementation
  request supplied approval to execute it.

## Implementation Record

- Migration 0077 was first applied through `renku project migrate` to a
  disposable copy of Urban Basilica. It preserved all 102 Assets, converted
  the 16 non-null scalar values to exact singleton arrays, converted the other
  86 values to `[]`, preserved 102 Asset files, 102 memberships, 29
  selections, and 23 provenance rows, and passed `foreign_key_check` and
  `quick_check` with no non-database file hash changes.
- The live migration created verified backup
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-61-to-62-20260817T154551778Z-497bfc.sqlite`
  and sidecar
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-61-to-62-20260817T154551778Z-497bfc.json`.
  The same row, exact-value, relationship, integrity, and 252 non-database file
  hash checks passed on the live Project. Studio was restarted on the current
  runtime and focused on Urban Basilica.
- The disposable proof imported one tagged fixture atomically, confirmed the
  same metadata in Asset list and Generation Context, confirmed no automatic
  selection, saved corrected Urban and height-blocked Mehmed II Specs, and
  displayed both in one valid combined Preview. The generation-run count did
  not change and no provider was invoked.
- `pnpm check`, `pnpm test`, and `pnpm build` pass. Integration runs pass 12
  Core, 21 Engines, 51 Studio, and 29 CLI cases, including the new coverage.
  Four unrelated existing CLI expectation mismatches remain: Lookbook
  reference-slot ordering, Cast Voice sample filename allocation, and two
  Studio server-policy projections. No adjacent contract was changed to mask
  them.
- The Media Producer image-route validator and Studio Skills release tests
  pass. Both repository diffs pass `git diff --check`.

## Summary

Plan 0180 correctly separated Storyboard rendering style from Production
continuity facts, but the real Urban Basilica run showed that prompt role
labels alone are not enough. GPT Image 2 received realistic Character,
Location, and Prop sheets alongside a loose hand-drawn Storyboard Lookbook and
produced dark realistic grayscale Beat images. The continuity references were
necessary, but their rendering finish remained too influential.

The accepted correction is to prepare dedicated Storyboard-native continuity
sheets for Cast Members, Locations, and Props. These sheets preserve the same
canonical identity, wardrobe, geometry, geography, construction, scale, and
state as the Production references while already using the current Storyboard
Lookbook's visual language. Scene Storyboard generation then deliberately
prefers those tagged sheets for continuity and keeps the Storyboard Lookbook
Sheet as the sole appearance authority.

The two temporary Character Sheet experiments exposed a second issue: the
prompt changed the Character Sheet's established layout when it should have
changed only the drawing style. This plan makes the existing five-part
identity turnaround the universal Character Sheet template and assigns its
detailed ownership to Media Producer's focused Character Sheet guide.

Finally, this plan replaces the unconditional one-pass QA rule with two clear
agent workflows. Cost-conscious users stay in control after each result;
users who explicitly choose strict iteration can delegate the generate,
inspect, revise, and regenerate loop without turning creative QA into Studio
runtime validation.

## Requirement Ledger

| ID | Requirement | Source | Planned result |
| --- | --- | --- | --- |
| R1 | Character, Location, and Prop references must remain attached because independently generated Beat images require continuity across the Screenplay. | User | Keep exact continuity references mandatory in the agent workflow; do not solve style leakage by omitting them. |
| R2 | Storyboard generation should use Storyboard-styled Character, Location, and Prop sheets instead of realistic Production sheets. | User | Add a focused Storyboard continuity-sheet preparation and selection workflow using the existing three sheet purposes and Asset types. |
| R3 | Asset intended uses are first-class tags and Storyboard intent needs a short name. | User | Rename scalar `purpose` to JSON-backed `tags: string[]`; Storyboard continuity sheets add exact `storyboard`, readable variant detail stays in `oneLineSummary`, and tags are exposed in generation candidates. |
| R4 | Reference choice remains exact and request-scoped. | User and Decision 0049 | Expose metadata but keep all eligible candidates; never auto-select, globally select, or infer from candidate order. |
| R4a | Absence of a Storyboard-tagged subject sheet must not block Storyboard generation. | User | Prefer a suitable tagged sheet; otherwise inspect and choose the best available same-owner sheet, preserving its continuity-only role and reporting any style-leakage risk. |
| R5 | Production sheets still provide canonical subject continuity when preparing Storyboard-native sheets. | User | Use the exact Production Character/Location/Prop Sheet as content authority and the exact Storyboard Lookbook Sheet as appearance authority in the new sheet request. |
| R6 | Every Character Sheet uses the same specific layout. | User | Require one large straight-on face close-up, metadata/accessory area below it, full-length front/back/left/right views, and a labeled height ruler. |
| R7 | Production versus Storyboard affects appearance, not Character Sheet structure. | User | Make the universal layout invariant across both modes; only Lookbook-derived rendering instructions change. |
| R8 | Height and applicable accessory details must be included without invented facts. | User and current Casting handoff | Casting supplies known height and accessories; missing height is reported and asked for before a reusable final sheet unless the user explicitly proceeds without it. |
| R9 | Users need a cost-conscious review workflow. | User | Make review-first the default: generate once, inspect, show the image and quality feedback, then wait for accept/regenerate/discard direction. |
| R10 | Users also need delegated correctness-focused iteration. | User | Add strict iterative mode after explicit opt-in, with purpose-specific visual checks and deliberate prompt/reference revisions between attempts. |
| R11 | Imperfect outputs must remain attachable by user choice. | User | Keep quality feedback advisory in both modes; no runtime or skill-level absolute attachment prohibition after explicit user acceptance. |
| R12 | Strict iteration must preserve cost and approval safety. | Existing generation contracts | Keep Preview, confirmation, estimate/token, concurrency, external freeze, and provenance rules per request; add no queue or retry service. |
| R13 | Creative prompts and images remain opaque to Studio runtime. | Decision 0041 and repository hard rule | Runtime stores/project metadata and reference candidates only; all layout/style/quality interpretation stays in skills, evals, and user review. |
| R14 | Current Scene Storyboard batching and cropping must not regress. | User and Plan 0180 | Preserve one full-canvas image for one Beat, the accepted two-Beat placeholder layout, the accepted three-/four-Beat grid behavior, and existing vision-guided crop flow. |
| R15 | The failed two-sheet experiment must inform the fix without entering durable project state. | User and real-project evidence | Use the prompts and outputs as negative evidence; do not attach, migrate, or treat them as accepted continuity sheets. |

## Product Behavior

### Storyboard continuity sheets

A Storyboard continuity sheet is not a new domain entity. It is an ordinary
subject-owned sheet:

| Subject | Existing generation purpose | Existing Asset type |
| --- | --- | --- |
| Cast Member | `cast.character-sheet` | `character_sheet` |
| Location | `location.sheet` | `location_sheet` |
| Prop | `prop.sheet` | `prop_sheet` |

The new workflow authors the request with two distinct reference roles:

1. the current Storyboard Lookbook Sheet is the sole appearance authority;
2. the exact accepted Production Character, Location, or Prop Sheet is the
   canonical content authority.

The prompt must preserve the content authority's identity, silhouette,
proportions, wardrobe, accessory design, geography, landmarks, construction,
scale, materials, markings, condition, and relevant state while re-rendering
those facts in the Storyboard Lookbook's medium, linework, value treatment,
finish, lighting behavior, texture, and detail density.

The accepted output is imported atomically with metadata such as:

```json
{
  "tags": ["storyboard"],
  "oneLineSummary": "Helmeted battlefield armor rendered in the current Storyboard Lookbook visual language.",
  "referenceName": "helmeted-battlefield-storyboard-continuity"
}
```

`referenceName` remains variant-specific and optional. `tags` may contain any
number of short strings, for example `["storyboard", "previs"]`. The exact
`storyboard` member is the stable agent convention. The one-line summary remains
readable project copy rather than a machine token or required prefix.

Tag order conveys no priority. The skill checks exact list membership and never
treats the first tag as preferred. Core validates and preserves the list but
does not interpret tag meaning.

The workflow may prepare sheets on demand for the exact subjects in a Scene or
may handle a user-requested project-wide preparation pass. It does not add a
bulk-generation command, queue, automatic background work, or a rule that
every subject must have a Storyboard continuity sheet before unrelated Project
work can continue.

### Scene Storyboard reference selection

For each Beat image batch, Media Producer:

1. reads the exact request-scoped candidate slots from Generation Context;
2. inspects candidate metadata and pixels;
3. prefers a suitable candidate whose Asset `tags` includes the exact string
   `storyboard`;
4. confirms that its title, summary, visible content, wardrobe/location/Prop
   state, and available generation provenance fit the current batch;
5. deliberately chooses the exact AssetFile for the saved GenerationSpec; and
6. still attaches the current Storyboard Lookbook Sheet as the sole appearance
   authority.

A tag is evidence of intended use, not proof of visual correctness. A tagged
sheet created against an obsolete Storyboard Lookbook or the wrong costume,
Location state, or Prop state is not silently preferred. The agent reports the
mismatch and follows the selected review mode. The user may explicitly direct
the agent to use another candidate.

If no suitable `storyboard`-tagged sheet exists, the agent does **not** block the
Storyboard request. It inspects every eligible same-owner Character, Location,
or Prop Sheet and deliberately selects the best available continuity match for
the requested identity, wardrobe, geography, construction, and state. Existing
Assets whose tags do not include `storyboard`, including migrated singleton
tags and untagged `[]` Assets, remain valid fallback candidates. The agent
keeps that fallback in the continuity-only role, keeps the Storyboard Lookbook
as the sole appearance authority, and reports any increased style-leakage risk
in its quality feedback.

The agent offers to prepare a dedicated Storyboard continuity sheet when that
would improve later generations, but generation can proceed with the fallback
unless the user explicitly requested strict correctness. It never substitutes
an unrelated owner, drops the subject, or infers a choice from list order.

### Universal Character Sheet layout

`cast.character-sheet` has one default reusable identity layout for both
Production and Storyboard rendering:

1. **Face column**
   - one large straight-on face close-up;
   - face centered and identity-readable;
   - crop ends above the shoulders;
   - compact name, height, and identity synopsis below the face;
   - applicable character-owned accessory details below the face in the same
     information area.
2. **Four full-length views**
   - front;
   - back;
   - left profile;
   - right profile;
   - neutral repeatable pose;
   - full figure and feet visible;
   - identical person, proportions, wardrobe layers, and accessory placement.
3. **Scale**
   - one clearly labeled height ruler with numeric marks;
   - the written height agrees with the ruler and full-body proportions.

The default prompt excludes gesture panels, expression ranges, action poses,
environment scenes, tool demonstrations, material swatches, and extra studies.
Those may replace the default only when the user explicitly requests a custom
Character Sheet departure. They must never be added merely because unused
canvas space exists.

Rendering mode changes only the visual language:

- a Production Character Sheet uses the chosen Production Lookbook appearance;
- a Storyboard continuity Character Sheet uses the current Storyboard Lookbook
  appearance;
- both keep the same face/info/four-view/height layout.

Casting Director supplies known height, identity synopsis, exact wardrobe
state, and applicable character-owned accessories. It does not own the image
layout prompt. Media Producer's focused Character Sheet guide owns the
universal output template and its visual QA.

If height is missing, the agent asks before preparing a reusable final sheet
and never invents a value. If the user explicitly chooses to proceed with
unknown height, the request and quality report state that limitation. The user
may still accept the result; no runtime validator rejects it.

### Location and Prop Storyboard sheets

Location and Prop sheets retain their existing focused board-design guidance.
This plan does not force the Character Sheet turnaround onto other subjects.

For a Storyboard continuity variant:

- the Storyboard Lookbook controls rendering appearance;
- the accepted Production sheet controls canonical geography or construction;
- Location studies keep recognizable layout, landmarks, entrances, sightlines,
  movement paths, scale, and relevant state;
- Prop studies keep silhouette, construction, scale, markings, moving parts,
  condition, and relevant state; and
- metadata identifies the accepted output as intended for Scene Storyboards.

### Review-first mode

Review-first is the default for generated images:

1. author, save, review, and execute one exact request;
2. inspect the result once against the applicable purpose checklist;
3. show the image to the user;
4. report concise passes, concerns, and the recommended next action; and
5. wait for the user's choice to attach, regenerate with a revised request, or
   discard/leave unattached.

The agent does not automatically regenerate. A failed criterion does not block
explicit user acceptance and attachment.

### Strict iterative mode

Strict iterative mode begins only when the user explicitly asks for automatic
iteration or absolute correctness and acknowledges the generation/usage
implication. The choice is conversational and task-scoped; it is not persisted
as a Project Setting or GenerationSpec field.

Before the first request, the agent identifies the applicable observable
criteria. For each attempt it:

1. executes the exact reviewed request through the selected Codex or
   Renku-managed path;
2. inspects the result against the purpose checklist;
3. records the concrete failure evidence in its working context;
4. changes a justified prompt, reference, layout, or model input for the next
   creative attempt;
5. authors and reviews a new GenerationSpec;
6. applies the ordinary confirmation and cost boundary; and
7. continues until the result passes, the user interrupts/accepts, or a real
   blocker is reached.

An operational retry of an unchanged frozen request remains distinct from a
creative iteration. A visual-quality failure never causes a blind identical
retry. Strict mode creates no runtime scheduler, retry counter, queue, hidden
spend ceiling, or new approval bypass.

Even in strict mode, the user may stop and accept the current output after
reading the feedback. The agent then attaches only after that explicit
direction or after the result passes and the user's original strict-mode
instruction already authorized attachment.

### Purpose-specific quality criteria

The generic review workflow owns control flow; focused purpose guides own the
criteria.

Character Sheet review checks:

- exact universal layout;
- straight-on face identity;
- four complete full-length views in the required order;
- consistent person, proportions, wardrobe, and accessories;
- height ruler and written height agreement;
- no unrequested extra study blocks;
- selected Lookbook appearance;
- no rendering-style leakage from the content reference; and
- no materially cropped or unreadable required region.

Location/Prop Storyboard continuity review checks:

- canonical geography/construction and state;
- target Storyboard Lookbook appearance;
- no Production rendering-style leakage;
- useful reference coverage for downstream Storyboards;
- consistent scale and recognizable defining features; and
- no unrequested scene/poster treatment that makes the sheet less reusable.

Scene Beat Storyboard review checks:

- exact requested Beat coverage and current count-specific layout;
- complete Project-ratio panel compositions;
- Storyboard Lookbook appearance;
- tagged continuity reference fidelity;
- no Production rendering-style leakage;
- readable narrative action, geography, and Prop interaction; and
- usable vision-guided crops for occupied Beat cells only.

These are agent/user checks. Studio runtime never parses prompts or inspects
pixels to enforce them.

## Explicit Non-Goals

- Removing Character, Location, or Prop continuity references from Beat
  Storyboard generation.
- Replacing exact references with text descriptions.
- Creating new `storyboard_character_sheet`, `storyboard_location_sheet`, or
  `storyboard_prop_sheet` Asset types.
- Creating a global selected Character, Location, or Prop Sheet.
- Automatically filtering Generation Context candidates by Asset tags.
- Making the first, newest, tagged, or only candidate selected automatically.
- Adding a Project-wide quality-mode Setting or per-Spec QA field.
- Adding a runtime style classifier, similarity score, OCR, panel detector,
  image analyzer, prompt parser, or quality threshold.
- Blocking attachment in Core because an agent reports a creative defect.
- Changing the Scene Beat model, Beat count, one-to-four batching, composite
  transform, placeholder rules, or existing crop mechanism.
- Automatically generating Storyboard continuity sheets for the entire
  Project without a user request and normal generation approvals.
- Adding a bulk job, queue, retry service, cost budget system, or hidden maximum
  attempt count.
- Attaching the two existing temporary Urban/Mehmed II examples.
- Regenerating or mutating live Urban Basilica media as part of automated
  implementation verification.

## Context And Evidence

### Implemented Plan 0180 baseline

Completed Plan 0180 and Decision 0080 establish:

- the Storyboard Lookbook as the sole Beat Storyboard appearance authority;
- exact Character, Location, and Prop references as continuity authorities;
- subject fidelity separated from rendering style;
- request-scoped exact reference selection;
- agent-external Codex GPT Image 2 as the default image path;
- arbitrary Scene Beat cardinality followed by batches of at most four;
- current one-/two-/three-/four-Beat composite rules;
- the existing agent-owned vision-guided crop path; and
- runtime opacity for prompts and media.

This plan preserves those contracts. It narrows Decision 0080 only where that
decision requires one-pass QA with no automatic iteration under every user
intent.

### Real Urban Basilica generation evidence

The current Scene 01 Generation Context exposes:

- one exact Storyboard Lookbook Sheet;
- two Urban Character Sheet candidates;
- three Mehmed II Character Sheet candidates;
- one Mara Character Sheet candidate; and
- two Theodosian Walls Location Sheet candidates.

Its `GenerationReferenceCatalogItem` values expose titles, file identities,
owner, role, origin, and path, but omit the Asset's existing
`oneLineSummary`, `referenceName`, and scalar `purpose`. The agent therefore cannot
see the intended-use description in the same candidate envelope it must use
for exact selection.

The live Asset projections prove those metadata fields already exist. For
example:

- `asset_h7dttbm3`, Mehmed II Helmeted Battlefield Character Sheet, has scalar
  `purpose: "helmeted battlefield armor reference for siege scenes"`;
- `asset_5ucg8r3s`, Urban's main Character Sheet, has scalar
  `purpose: "Depict Urban as the builder"`; and
- existing sheet `oneLineSummary` values are currently null.

The populated Urban Basilica database contains 102 Assets, 16 with non-null
scalar purpose values spanning Character Sheets, Cast Profiles, and Cast Voice
Samples. That proves this is not an empty-column rename. The cutover must
preserve each non-null authored value as a singleton list and map null to an
empty list before runtime reads the new JSON-backed field.

### Failed temporary Character Sheet prompts

The unattached Urban prompt asked for:

- a front view;
- a three-quarter view;
- a back view;
- gestures; and
- tool/construction cues.

It omitted full-length left and right profiles and explicitly excluded
measurements.

The unattached Mehmed II prompt included front/back/left/right views but also
added performance gestures and construction studies, while explicitly
excluding measurements and dense metadata.

Those prompts directly contradicted the established reusable Character Sheet
template. The installed sample already demonstrates the correct five-section
layout and height, while the focused Media Producer guide currently says only
that layout, view count, and height are prompt/QA owned. The detailed universal
format lives more strongly in Casting Director's handoff than in the skill
that actually authors the image request.

The ownership correction is therefore:

- Casting Director owns the facts supplied to generation;
- Media Producer's focused Character Sheet guide owns the universal image
  template and review checklist; and
- Production versus Storyboard changes the selected appearance authority only.

### Existing metadata and import surface

The Asset model already owns:

- `title`;
- `oneLineSummary`;
- `referenceName`; and
- scalar `purpose`.

`renku asset update` can edit all four. `MediaCommandFlags` already includes
`summary`, `referenceName`, and singular `referencePurpose`, but the focused
media import handler currently ignores them. Core attachment persistence
already supports `oneLineSummary` internally but does not receive or persist
the other two fields from the focused attachment command.

The user-confirmed cardinality means the current scalar can no longer be reused
unchanged. The accepted change is to rename this Asset-owned field to
`tags: string[]`, update every writer and projection directly, and avoid either
a parallel tagging concept or fragile post-import mutation.

### Existing reference-guide surface

`cast.character-sheet`, `location.sheet`, and `prop.sheet` currently expose:

1. a Production Lookbook Sheet slot; and
2. a same-owner Character/Location/Prop Sheet slot.

The reusable `storyboardLookbookSheetSlot` already exists and is used by
`scene.storyboard-sheet` and `shot.image`. The three sheet purposes can reuse
that focused slot without a new reference framework.

### Accepted architecture

This plan follows:

- Decision 0041, Keep AI Artifacts And Prompts Opaque;
- Decision 0049, Use Request-Scoped Generation Reference Choices;
- Decision 0051, Keep Generation Authoring Incomplete And Reference Slots
  Agent-Directed;
- Decision 0080, Use Storyboard Lookbook As Beat Storyboard Appearance
  Authority;
- `docs/architecture/data-model-and-storage.md` for Asset metadata ownership;
- `docs/architecture/reference/drizzle-migrations.md` and Decision 0011 for
  Drizzle Kit generation, backup, application, and documented custom SQL;
- current official [Drizzle SQLite column
  types](https://orm.drizzle.team/docs/sqlite/column-types) and [empty-array
  default](https://orm.drizzle.team/docs/guides/empty-array-default-value)
  guidance for JSON-mode `text`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/domain-vocabulary.md`; and
- `docs/architecture/reference/studio-skills.md`.

## Right-Sized Change Decision

### 1. Reuse the current contracts unchanged

Skills could call `renku media import`, then call `renku asset update`, then
call `renku asset list` separately during every Storyboard reference choice.
This cannot represent several simultaneous intended uses in the current scalar
field. It also splits one accepted attachment intent across mutations and
leaves Generation Context—the exact request-authoring surface—without the
metadata needed to distinguish candidates. Partial untagged attachments remain
easy.

This option is rejected.

### 2. Extend the existing Asset attachment and reference projection owners

Refactor the current Asset metadata owner from scalar `purpose` to first-class
`tags`, then use the current focused sheet GenerationPurposes, reference
slots, and GenerationReferenceCatalogItem. Add optional metadata to focused
attachment, project it into reference candidates, add the existing Storyboard
Lookbook slot to the three sheet purposes, and update focused skills/evals.

This is the chosen option. It changes one existing durable field and its schema
cardinality rather than adding a parallel tag model, and fixes the missing
ownership boundary directly.

### 3. Add Storyboard-specific Asset types, selections, or automatic filters

New Asset types or global selections would duplicate current Character,
Location, and Prop Sheet ownership and conflict with request-scoped exact
choice. Automatic filtering or selection by Asset tags would turn an
agent convention into runtime semantic behavior and could hide usable
Production references when the user deliberately wants them.

This option is rejected.

## Architecture Shape Gate

### Owning boundaries

Core owns:

- the `tags: string[]` Asset contract, structural normalization, JSON
  persistence, and one-way scalar-to-list migration;
- Asset metadata normalization and atomic persistence;
- focused generated-media attachment;
- exact GenerationReferenceCatalogItem projection;
- factual named reference slots and eligible candidates;
- generation purpose/target/media envelope validation; and
- request-scoped selection persistence.

CLI owns:

- parsing repeatable `--tag` and explicit `--clear-tags` where
  applicable;
- parsing the remaining media import metadata flags;
- passing them unchanged to Core; and
- formatting Core's report.

Studio Skills own:

- the exact `storyboard` tag convention;
- whether the current request is Production or Storyboard continuity;
- exact candidate inspection and choice;
- reference role wording;
- the universal Character Sheet prompt template;
- purpose-specific visual-quality criteria;
- review-first versus strict-iterative control flow;
- prompt/reference revisions after visual feedback; and
- the final user-facing attachment decision.

Studio browser UI remains a projection consumer. No React behavior or new
server route is planned; the existing generation-reference response gains the
same candidate metadata as direct contract fallout.

### Intended Studio repository module shape

Modify focused existing owners:

- `packages/core/src/client/assets.ts`
  - add the reusable `AssetMetadataInput` shape;
  - replace `Asset.purpose` and `UpdateAssetInput.purpose` directly with
    `tags: string[]` / `tags?: string[]`;
  - keep `UpdateAssetInput` using the same reusable metadata vocabulary.
- `packages/core/src/client/generation.ts`
  - extend `GenerationReferenceCatalogItem` with exact Asset metadata,
    including non-null `tags: string[]`.
- `packages/core/src/server/schema/assets.ts`
  - replace nullable `purpose` with non-null JSON-mode text `tags` typed as
    `string[]`, with an empty-array database default.
- `packages/core/drizzle/0077_asset_tags.sql` and the Drizzle-generated
  journal/snapshot
  - generate the schema change with Drizzle Kit;
  - document the necessary in-place data-preservation step inside the generated
    migration because a schema diff cannot convert arbitrary scalar text to a
    JSON array and a populated referenced parent cannot be rebuilt inside the
    Drizzle migration transaction;
  - map null to `[]`, map each non-null scalar to `json_array(purpose)`, and set
    `PRAGMA user_version = 62` because current runtime reads the new column
    unconditionally.
- `packages/core/src/server/database/lifecycle/migration-0077.test.ts`
  - execute the migration with representative null, quoted, mixed-case, and
    Unicode scalar values and prove exact singleton-list preservation,
    empty-list mapping, foreign-key integrity, and quick check.
- `packages/core/src/server/database/access/assets.ts`
  - read and write the plural JSON-mode column only;
  - remove the scalar record property rather than retaining an alias.
- `packages/core/src/server/assets/metadata.ts`
  - own shared tag-list normalization for update and attachment creation:
    trim each tag, reject empty entries, deduplicate exact duplicates while
    preserving first-authored order, and never lowercase or interpret a tag;
  - keep `updateAsset` as the existing public mutation.
- `packages/core/src/server/assets/projection.ts`
  - project `tags` as a non-null list on every Asset.
- `packages/core/src/server/generation/attachments.ts`
  - accept optional nested `assetMetadata` and pass normalized values into the
    existing atomic attachment write.
- `packages/core/src/server/generation/attachment-persistence.ts`
  - persist `oneLineSummary`, `referenceName`, and `tags` on the same Asset
    insert as ownership and file persistence.
- `packages/core/src/server/project-data-service-wiring/generation.ts`
  - expose the same typed optional metadata on `attachGenerationMedia`.
- `packages/core/src/server/generation/references.ts`
  - project the three existing Asset metadata fields into every registered
    AssetFile reference candidate;
  - return null for absent summary/reference name and `[]` for absent tags
    on safe project-file references rather than guessing.
- existing Asset writers and copiers in
  `packages/core/src/server/commands/cast-voice-commands.ts`,
  `packages/core/src/server/shot-plans/image-copying.ts`, and focused fixtures
  - write/copy `tags` directly; new Cast Voice Samples store the same existing
    editorial value as a singleton tag list, while migration preserves that
    value for existing Assets.
- `packages/core/src/server/generation/purposes/cast-character-sheet.ts`
- `packages/core/src/server/generation/purposes/location-sheet.ts`
- `packages/core/src/server/generation/purposes/prop-sheet.ts`
  - reuse `storyboardLookbookSheetSlot` beside the existing Production
    Lookbook and same-owner sheet slots.
- focused Core tests beside those owners.
- `packages/cli/src/commands/media-import-command-handlers.ts`
  - pass `summary`, `referenceName`, and repeatable `tag` flags as
    Core Asset metadata for non-Storyboard focused single-file imports.
- `packages/cli/src/commands/asset-command.ts` and `packages/cli/src/cli.ts`
  - replace singular `referencePurpose` / `--reference-purpose` directly with
    repeatable `tag` / `--tag`;
  - add `--clear-tags` for `asset update`, mutually exclusive with
    supplied tags, so an existing Asset can deliberately return to `[]`.
- focused CLI handler/integration tests.

Update Asset-shaped Studio route/test fixtures and Core test helpers from
`purpose: null` to `tags: []` as contract fallout. No React behavior or
visible copy changes.

Do not add a new module folder, registry, dispatcher, route, command, or index
entry for this change. Existing `index.ts` files remain unchanged unless a
current public type is already exported through the package entrypoint and the
type change naturally flows through it.

### Intended Studio Skills module shape

Use focused references rather than expanding Media Producer's general
`SKILL.md` with one long special-case workflow:

- `skills/media-producer/references/cast-character-sheets.md`
  - become the single normative owner of the universal Character Sheet layout,
    Production/Storyboard appearance selection, metadata attachment, and
    Character Sheet QA criteria.
- `skills/media-producer/references/location-sheet.md`
- `skills/media-producer/references/location-sheet-board-design.md`
  - add Storyboard continuity variant reference roles, metadata, and focused QA
    while preserving existing Location board design.
- `skills/media-producer/references/prop-sheet.md`
- `skills/media-producer/references/prop-sheet-board-design.md`
  - add the corresponding Prop workflow and criteria.
- `skills/media-producer/references/scene-storyboard-sheet.md`
  - prefer suitable candidates whose tags include `storyboard` and preserve
    current batch/layout/crop behavior.
- `skills/media-producer/references/reference-visible-image-prompting.md`
  - explain Production-sheet content authority versus Storyboard Lookbook
    appearance authority when preparing Storyboard-native sheets.
- `skills/media-producer/references/image-output-review.md`
  - new focused owner for review-first and strict-iterative control flow,
    approval/cost boundaries, and advisory attachment behavior.
- `skills/media-producer/references/workflow.md`
  - link the image output review owner from the existing inspection/attachment
    sequence without duplicating its modes.
- `skills/media-producer/SKILL.md`
  - add only concise routing to the new review reference and focused purpose
    guides; do not repeat the specific Character Sheet or Storyboard scenario.
- `skills/media-producer/samples/cast-character-sheet-spec.json`
  - strengthen the universal layout example.
- `skills/media-producer/samples/cast-storyboard-continuity-sheet-spec.json`
- `skills/media-producer/samples/location-storyboard-continuity-sheet-spec.json`
- `skills/media-producer/samples/prop-storyboard-continuity-sheet-spec.json`
  - add focused Storyboard continuity examples using the default prompt-only
    Codex envelope and exact named slots.
- `skills/media-producer/evals/forward-test-cases.md`
  - add format, tagging, candidate choice, style leakage, and two-mode QA cases.
- `skills/casting-director/references/cast-media-handoff.md`
  - keep fact handoff and point to Media Producer's universal layout owner;
  - do not duplicate the complete prompt template.
- `skills/production-designer/references/media-and-scene-beats-handoff.md`
  - hand off Production versus Storyboard sheet intent and exact content
    authority.

### Public entrypoints and contracts

Existing public entrypoints remain:

- `ProjectDataService.attachGenerationMedia`;
- `ProjectDataService.buildGenerationContext`;
- `renku media import`;
- `renku generation context`; and
- current `cast.character-sheet`, `location.sheet`, `prop.sheet`, and
  `scene.storyboard-sheet` purposes.

No second attachment service, metadata service, Storyboard continuity command,
or skill-local mutation wrapper is allowed.

### Forbidden implementation shapes

Do not implement this plan by:

- adding a new Storyboard continuity table, Asset type, owner, relationship,
  or global selection;
- interpreting an Asset tag or `oneLineSummary` in Core to classify a sheet;
- filtering or sorting eligible candidates by the Storyboard tag in Core;
- adding automatic selection to a purpose guide;
- adding prompt/layout/style validation to Core, CLI, Studio server, or React;
- persisting QA scores, pass/fail state, attempt counters, or image analysis;
- putting attachment, metadata normalization, reference projection, and
  purpose-slot logic into one new catch-all module;
- adding a second Asset metadata normalizer in generation code;
- adding CLI-local business validation for which generation purposes may
  receive Asset tags;
- adding a broad purpose switch or source-text architecture test;
- adding a retry scheduler, queue, background worker, or cost bypass;
- changing Scene Storyboard composite or crop implementation; or
- expanding the generic Media Producer SKILL with duplicated focused recipes.

### Stop conditions

Stop and revise the plan before implementation continues if:

- reliable Storyboard candidate choice would require a new durable selection
  or dependency model rather than existing Asset metadata and exact Spec
  references;
- the implementation begins semantically interpreting Asset tags in
  Core beyond structural list normalization;
- adding metadata to attachment cannot reuse the existing Asset normalization
  owner without duplicating rules;
- Drizzle Kit cannot produce a reviewable `0077` schema snapshot/migration with
  one documented scalar-to-list preservation step;
- any additional database table, tag relationship, or UI surface becomes
  necessary;
- the universal Character Sheet layout starts entering runtime schemas or
  validators;
- strict iterative mode requires bypassing estimate tokens, confirmation, or
  frozen-spec provenance;
- an image retry service or attempt-persistence model appears necessary;
- Scene Storyboard layout/crop code must change; or
- a focused file starts accumulating unrelated purpose, attachment,
  persistence, projection, and review responsibilities.

## Contracts

### Asset metadata input

Add one reusable public metadata shape:

```ts
interface AssetMetadataInput {
  oneLineSummary?: string | null;
  referenceName?: string | null;
  tags?: string[];
}
```

`UpdateAssetInput` and generated-media attachment use the same vocabulary and
Core normalization. Attachment receives it nested to avoid collision with the
GenerationPurpose field:

```ts
interface AttachGenerationMediaInput {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  sourceProjectRelativePath: string;
  title?: string;
  assetMetadata?: AssetMetadataInput;
  receipt?: unknown;
  sourceSpecId?: string;
  select?: boolean;
}
```

Whitespace-only summary/reference-name values normalize to null according to
the existing Asset update rule. `tags` is a complete replacement list when
present: Core trims each string, rejects any empty tag, removes exact duplicate
tags while preserving first-authored order, and stores `[]` as no intended-use
tags. Array order is stable round-trip order, not precedence. Core does not
lowercase, parse, or assign meaning to tags. The Asset,
membership, AssetFile, provenance, and metadata remain one atomic Core write.
No partial Asset is left if file or provenance persistence fails.

An empty or non-string tag fails before persistence with structured Core code
`CORE_ASSET_TAGS_INVALID`. CLI's mutually exclusive update flags fail
before delegation with `CLI045`. These diagnostics protect list structure only;
they do not recognize or validate a tag vocabulary.

The nested shape is optional and works for the existing focused single-file
attachments. Skills use it for Character, Location, and Prop sheets. Core does
not add purpose-specific metadata vocabulary or reject other legitimate Asset
metadata uses.

### CLI focused import metadata

Focused non-Scene-Storyboard imports accept:

```text
renku media import \
  --purpose cast.character-sheet \
  --target cast:<cast-member-id> \
  --source <project-relative-path> \
  --title <title> \
  --summary <one-line-summary> \
  --reference-name <name> \
  --tag storyboard \
  --tag <another-tag> \
  --source-spec <frozen-spec-id> \
  --json
```

Repeatable `--tag` occurrences become one `string[]`; the CLI does not
split commas or JSON, normalize text, deduplicate, or interpret tags. Core owns
normalization and persistence. Grouped Scene Storyboard import remains
unchanged because Beat images are not the Storyboard continuity sheets
introduced here.

`renku asset update` uses the same repeated flag to replace the complete list:

```text
renku asset update <asset-id> \
  --project <project-name> \
  --tag storyboard \
  --tag previs \
  --json

renku asset update <asset-id> \
  --project <project-name> \
  --clear-tags \
  --json
```

`--clear-tags` maps to `tags: []` and is mutually exclusive with `--tag`.
Omitting both leaves the existing list unchanged. The old
`--reference-purpose` flag and scalar `referencePurpose` option are removed in
the same cutover; no alias or compatibility path remains.

### Generation reference candidate metadata

Extend `GenerationReferenceCatalogItem` with exact metadata fields:

```ts
oneLineSummary: string | null;
referenceName: string | null;
tags: string[];
```

For registered AssetFile candidates, values come directly from the owning
Asset. For safe project-file references without an Asset, summary and reference
name are null and tags is `[]`. Search, eligibility, slot membership,
order, and exact references remain unchanged.

Core never interprets these strings. Their presence lets an agent or user make
a better request-scoped choice.

### Storyboard Lookbook slots for subject-sheet generation

Each of the three existing subject-sheet purpose guides exposes:

1. `visual-language/production-lookbook-sheet`;
2. `visual-language/storyboard-lookbook-sheet`;
3. the existing same-owner Character/Location/Prop Sheet slot.

Both appearance slots are optional candidates. Skills select:

- Production Lookbook only for a Production sheet;
- Storyboard Lookbook only for a Storyboard continuity sheet; and
- the exact same-owner subject sheet when it is the canonical content
  authority for a new variation.

Core does not require exactly one appearance reference, because authoring may
remain incomplete and creative choice is request-scoped.

### Stable agent metadata convention

Storyboard continuity sheets use:

```json
{
  "tags": ["storyboard"]
}
```

This is an agent workflow convention and documented project vocabulary, not a
Core enum. `storyboard` is a short exact-membership tag and may coexist with
other tags. The summary has no required prefix; it adds human context such as
wardrobe, Location state, Prop state, and the Storyboard Lookbook relationship.

### Asset tags storage and migration contract

The public Asset projection is:

```ts
interface Asset {
  // existing fields
  tags: string[];
}
```

The Drizzle schema uses SQLite JSON text mode:

```ts
tags: text('tags', { mode: 'json' })
  .$type<string[]>()
  .notNull()
  .default(sql`'[]'`)
```

Migration `0077_asset_tags` performs one direct cutover:

| Existing scalar value | New JSON value |
| --- | --- |
| `NULL` | `[]` |
| any non-null string `value` | `json_array(value)` |

`json_array` is required rather than string concatenation so quotes,
backslashes, Unicode, and other valid authored text remain exact JSON string
values. The generated journal and snapshot remain the schema source of truth;
the SQL's in-place add/populate/drop-column sequence is a documented custom
step because Drizzle's schema diff cannot infer the scalar-to-array conversion
and its generated parent-table rebuild cannot run against populated inbound
foreign keys inside the migration transaction.
Migration application uses the existing verified project backup and
`renku project migrate` workflow. Runtime contains only the `tags` column and
`tags` contract after migration.

### Review mode contract

The two review modes are skill-owned task behavior:

```text
review-first     default; one result, feedback, user decision
strict iterative explicit user opt-in; deliberate new attempts until pass,
                 user stop/acceptance, or real blocker/approval boundary
```

No review-mode value is added to Project Settings, GenerationSpec,
GenerationRun, Asset, or Studio UI. Existing execution, approval, and
attachment safety contracts remain unchanged.

### Decision record

Add:

- `docs/decisions/0081-use-storyboard-native-continuity-sheets-and-agent-owned-review-modes.md`

Decision 0081 records:

- first-class Asset tags, their JSON storage/migration contract, and the
  exact `storyboard` tag;
- existing subject-sheet Asset types plus Asset metadata for Storyboard-native
  continuity;
- no automatic/global selection;
- universal Character Sheet layout as agent-owned prompt and QA guidance;
- review-first as the default;
- strict iterative review only by explicit user direction;
- advisory quality findings and user override;
- unchanged cost, confirmation, Preview, provenance, and opacity boundaries;
  and
- unchanged Scene Storyboard batching and cropping.

Add a narrow notice to Decision 0080 stating that Decision 0081 supersedes only
its unconditional one-pass/no-automatic-iteration clause. Leave Decision
0080's original reasoning and all other accepted behavior intact.

## Implementation Slices

### Slice 1: Record the narrowed decision, Asset tag contract, and vocabulary

- add Decision 0081;
- add the narrow Decision 0080 notice;
- record `tags: string[]`, JSON text storage, exact structural
  normalization, singleton preservation of populated scalar values, and direct
  removal of the scalar contract;
- document Storyboard continuity sheets as existing subject sheets identified
  by Asset metadata, not new types;
- document review-first and strict-iterative agent behavior;
- preserve request-scoped exact choices and runtime opacity; and
- make clear that migration preserves existing values as singleton lists and
  does not infer or add `storyboard` to current Assets.

### Slice 2: Cut Asset purpose metadata over to first-class JSON tags

- replace scalar `Asset.purpose` with non-null `Asset.tags` and replace the
  scalar update input with optional complete-list replacement;
- update the Drizzle schema to non-null JSON-mode text with `[]` default;
- generate `0077_asset_tags` with Drizzle Kit and use the documented in-place
  add/populate/drop-column conversion with `json_array(purpose)`;
- set schema generation 62;
- update Asset database access, projections, Core writers, copy paths, test
  fixtures, and Asset-shaped Studio fixtures directly;
- update Cast Voice Sample creation to store the same existing editorial value
  as a singleton tag list without changing the separate Cast Voice contract;
- normalize tag lists once in Core, preserving exact case and authored
  order while trimming/rejecting empties and deduplicating exact duplicates;
- replace `--reference-purpose` with repeated `--tag`, add `--clear-tags` for
  Asset update, and remove the scalar option;
- add migration, Core, CLI, and contract-fallout tests; and
- apply and verify the migration first on an isolated Urban Basilica copy
  during implementation verification.

### Slice 3: Make focused attachment metadata atomic

- add the named `AssetMetadataInput` contract and use it from both update and
  focused attachment inputs;
- centralize existing trimming/null normalization in the Asset metadata owner;
- extend `attachGenerationMedia` with optional nested metadata;
- persist summary, reference name, and tags in the existing Asset insert;
- pass summary, reference name, and repeated tags from `media import`
  to Core;
- keep grouped Scene Storyboard import unchanged;
- add Core transaction/normalization tests; and
- add CLI delegation and representative integration coverage.

### Slice 4: Expose metadata and Storyboard Lookbook candidates

- extend GenerationReferenceCatalogItem with exact nullable summary/reference
  name and non-null tags;
- project Asset values for registered AssetFile references and null/null/`[]`
  for project files;
- preserve candidate eligibility and ordering;
- add the existing Storyboard Lookbook Sheet slot to Character, Location, and
  Prop sheet purpose guides;
- keep Production Lookbook and same-owner slots unchanged;
- add focused context tests for all three purposes; and
- prove no slot initializes a selection.

### Slice 5: Make the Character Sheet template universal

- strengthen `cast-character-sheets.md` as the normative layout owner;
- keep Casting Director responsible for height, synopsis, wardrobe, identity,
  and accessories;
- state that Production/Storyboard changes only the appearance authority;
- remove default gesture/expression/tool/environment blocks;
- update the canonical sample with the exact face/info/four-view/height layout;
- add `cast-storyboard-continuity-sheet-spec.json` using the named Storyboard
  Lookbook slot and prior Character Sheet content reference;
- document atomic metadata import; and
- add negative evals matching the actual Urban/Mehmed failure pattern.

### Slice 6: Add Storyboard-native Location and Prop sheet workflows

- extend focused Location/Prop guides with Production-content versus
  Storyboard-appearance roles;
- retain existing board design and subject-specific QA;
- add `location-storyboard-continuity-sheet-spec.json` and
  `prop-storyboard-continuity-sheet-spec.json`;
- document the exact metadata convention and import command;
- update Production Designer handoff to name the intended rendering mode and
  content authority; and
- add style-leakage and state-continuity evals.

### Slice 7: Prefer tagged continuity sheets in Scene Storyboards

- update `scene-storyboard-sheet.md` to read candidate metadata;
- prefer suitable candidates whose `tags` includes `storyboard` without
  auto-selection;
- inspect pixels and available source request/provenance before choosing;
- report missing, stale, wrong-state, or visually unsuitable tagged sheets;
- route missing sheets through the focused preparation workflow;
- preserve exact Storyboard Lookbook attachment;
- preserve one-/two-/three-/four-Beat layouts and existing crop behavior; and
- add evals proving a realistic Production sheet is not chosen when a suitable
  tagged Storyboard sheet exists.

### Slice 8: Add review-first and strict-iterative image QA

- add `image-output-review.md` as the single control-flow owner;
- keep review-first as default;
- require explicit user opt-in for strict iteration;
- keep feedback advisory and user attachment override available;
- distinguish creative iteration from operational retry;
- require a justified request change after a visual-quality failure;
- create a new Spec for each creative attempt;
- preserve Preview, confirmations, estimates/tokens, concurrency, freeze, and
  provenance per attempt;
- update Scene Storyboard's unconditional one-pass wording;
- keep purpose criteria in focused guides rather than the generic review file;
- add evals for both modes, user override, cost boundaries, and no blind retry;
  and
- add no persistent QA state or runtime validator.

### Slice 9: Validate with Urban Basilica evidence

Use an isolated copy of `/Users/keremk/renku-movies/urban-basilica`.

- verify current Production candidates remain eligible;
- migrate the copy from scalar `purpose` to `tags` and prove all 16
  non-null values became exact singleton lists while null values became `[]`;
- import a fixture subject sheet with the new metadata flags and prove the same
  Generation Context candidate exposes them;
- prove the tagged candidate is still unselected until authored into a Spec;
- prepare corrected Urban and Mehmed II Storyboard continuity Character Sheet
  specs using the universal layout;
- show both saved specs in one combined Preview;
- inspect the prompt/reference/metadata handoff;
- do not invoke Codex or a paid provider during automated verification;
- do not attach outputs to the isolated copy unless a later manual acceptance
  run explicitly generates and approves them; and
- never mutate the live Project.

The two existing temporary outputs may be visually compared as negative
evidence, but they are not imported or rewritten.

### Slice 10: Upgrade the populated local Project

Only after Slice 9 and the full regression checks pass:

- run `renku project migrate urban-basilica` against the configured live
  project;
- require the existing verified pre-migration SQLite backup and sidecar;
- verify schema generation 62, 102 total Assets, the same 16 authored
  non-empty values as singleton lists, empty lists for prior nulls, unchanged
  ownership/file counts, `foreign_key_check`, and `quick_check`;
- verify Studio can reopen the Project and list Cast/Location/Prop/Storyboard
  Assets without changing visible media; and
- stop before any paid generation or attachment. The later two-Character-Sheet
  trial remains a separate user-reviewed generation action.

## Tests And Guardrails

### Migration and Core Asset metadata coverage

- migration maps scalar null to `[]` and every non-null scalar to an exact
  singleton list, including quotes, backslashes, mixed case, and Unicode;
- migration preserves all Asset, membership, file, selection, provenance,
  discard-lifecycle, and unrelated rows and passes `foreign_key_check` and
  `quick_check`;
- a migrated database reports schema generation 62 and opens only through the
  current `tags` runtime contract;
- focused attachment without metadata persists `tags: []`;
- focused attachment with summary, reference name, and several tags
  persists exact normalized values atomically;
- leading/trailing whitespace is normalized by the shared Asset owner;
- an empty tag is rejected before any write;
- non-string or empty entries report `CORE_ASSET_TAGS_INVALID` with the
  offending list location;
- exact duplicate tags collapse to the first occurrence while distinct case is
  preserved and no semantic normalization occurs;
- `asset update` omission leaves tags unchanged, a supplied list replaces
  the complete list, and `[]` clears it;
- whitespace-only optional summary/reference-name values become null/absent
  consistently with `asset update`;
- attachment rollback leaves no Asset, membership, file, provenance, or
  metadata fragment after a write failure;
- existing Asset title, summary, reference-name, and locale update behavior
  remains unchanged; and
- no purpose-specific semantic validation is added for the `storyboard` tag.

### Core reference projection coverage

- registered AssetFile candidates expose exact summary, reference name, and
  tags;
- absent Asset summary/reference name projects as null and absent tags as
  `[]`;
- project-file references project null summary/reference name and `[]`
  tags;
- existing title, owner, role, path, media facts, and provenance remain
  unchanged;
- candidate ordering remains unchanged;
- search and role eligibility remain unchanged; and
- metadata never initializes or changes a GenerationSpec reference.

### Core purpose-guide coverage

For `cast.character-sheet`, `location.sheet`, and `prop.sheet`:

- Production Lookbook Sheet slot remains;
- Storyboard Lookbook Sheet slot appears with exact current role candidates;
- same-owner subject-sheet slot remains;
- unrelated Lookbook or subject files are ineligible;
- missing Storyboard Lookbook Sheet leaves a truthful empty optional slot;
- no notice claims creative readiness; and
- no candidate is selected automatically.

### CLI coverage

- media import handler passes `--summary`, `--reference-name`, and every
  repeated `--tag` into nested Core Asset metadata;
- omitted flags remain omitted;
- asset update replaces the list from repeated `--tag`, clears it from
  `--clear-tags`, and rejects using both together with `CLI045` before
  delegation;
- existing title, source, target, selection, managed receipt, and external
  source-Spec behavior remains unchanged;
- one representative integration test imports and lists a tagged sheet;
- Generation Context then exposes the exact tag and summary;
- grouped Scene Storyboard import ignores no newly supported contract because
  its shape remains deliberately unchanged; and
- no CLI-local tag classification or semantic validation is introduced.

### Skill forward-test matrix

| Scenario | Required evidence |
| --- | --- |
| Production Character Sheet | Selects Production Lookbook appearance, uses universal face/info/front/back/left/right/height layout, and does not add gesture or tool blocks. |
| Storyboard Character Sheet | Selects Storyboard Lookbook appearance plus exact Production Character Sheet content authority, uses the identical universal layout, and attaches with the `storyboard` tag. |
| Missing height | Asks for height before a reusable final sheet, never invents it, and allows an explicit proceed-without-height user choice with a visible limitation report. |
| Applicable accessory | Places the exact accessory detail below the face and keeps it consistent in all full-body views; does not invent unrelated accessories. |
| Urban negative case | Rejects a prompt that substitutes three-quarter/gesture/tool studies for left/right full-length views or says `No measurements`. |
| Mehmed II negative case | Rejects extra performance/construction blocks that displace the metadata/height area; preserves the helmeted variant and exact universal layout. |
| Storyboard Location Sheet | Uses Storyboard Lookbook for rendering, exact Production Location Sheet for geography, and imports with the `storyboard` tag plus a readable summary. |
| Storyboard Prop Sheet | Uses Storyboard Lookbook for rendering, exact Production Prop Sheet for construction/state, and imports with the `storyboard` tag plus a readable summary. |
| Tagged and Production candidates coexist | Scene Storyboard agent reads both, inspects them, prefers the suitable tagged candidate, and persists only the exact request-scoped choice. |
| Multi-tag Storyboard candidate | Agent recognizes exact `storyboard` membership even when another tag appears first; tag order never becomes candidate priority. |
| Tagged candidate is stale or wrong-state | Agent does not trust the tag alone; reports the mismatch and follows the selected review mode. |
| No tagged candidate but usable same-owner sheet exists | Agent deliberately chooses the best continuity fallback, keeps the Storyboard Lookbook as sole appearance authority, reports added style-leakage risk, and offers a dedicated Storyboard sheet without blocking the request. |
| No usable same-owner candidate | Agent reports the missing continuity input and offers/prepares the focused subject sheet; it never substitutes an unrelated owner or silently drops continuity. |
| Review-first quality concern | Agent shows the image and feedback, makes no automatic second request, and lets the user accept, regenerate, or discard. |
| Review-first imperfect acceptance | Agent attaches after explicit acceptance despite reported creative concerns; no runtime gate is invented. |
| Strict iterative visual failure | Agent cites concrete failed criteria, deliberately changes the next request, creates a new Spec, and respects all normal execution gates. |
| Strict iterative user override | User can stop the loop and accept the current image after reading feedback. |
| Managed strict iteration | Every attempt receives current Preview behavior, a fresh estimate/token, configured confirmation, and exact run provenance. |
| Codex strict iteration | Every changed attempt uses a new saved/frozen external Spec; no Renku token is invented. |
| Operational retry | An unchanged frozen request may be retried only as the existing operational retry path, not misreported as a creative correction. |
| One-/two-/three-/four-Beat Storyboards | Existing full-canvas, placeholder, blank-cell, grid, aspect-ratio, and crop behavior remains unchanged. |

No forward test may make a paid call or mutate the live Project.

### Opaque-artifact guardrails

Confirm runtime adds no:

- closed tag enum;
- substring or semantic parsing of Asset tags or summary;
- prompt heading or phrase validation;
- Character Sheet panel/view/height schema;
- image inspection, similarity score, style classifier, OCR, or layout
  detector;
- quality pass/fail field;
- attachment rejection based on creative QA;
- automatic candidate filter or selection;
- attempt counter or retry policy; or
- automatic Project-wide sheet generation.

### Regression guardrails

Keep passing:

- generic Asset update/list;
- focused media attachment for every existing purpose;
- managed receipt and agent-external frozen-Spec provenance;
- exact request-scoped reference selection;
- Production Lookbook candidates for existing subject-sheet workflows;
- Scene Storyboard Generation Context;
- current one-to-four composite prompt transform;
- two-Beat disposable placeholder behavior;
- one-Beat full-canvas behavior;
- agent-owned vision-guided cropping;
- grouped Beat image import and canonical selection; and
- current Cast, Location, Prop, Lookbook, Shot, and Scene UI projections.

## Documentation

### Studio repository

Add:

- `docs/decisions/0081-use-storyboard-native-continuity-sheets-and-agent-owned-review-modes.md`

Update:

- `docs/decisions/0080-use-storyboard-lookbook-as-beat-storyboard-appearance-authority.md`
  with one narrow supersession notice;
- `docs/architecture/data-model-and-storage.md` for first-class Asset tags,
  JSON persistence, and atomic attachment metadata;
- `docs/architecture/reference/drizzle-migrations.md` with a concise entry for
  the documented 0077 scalar-to-JSON-array preservation step;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md` for candidate metadata and
  optional subject-sheet Storyboard Lookbook slots;
- `docs/architecture/reference/domain-vocabulary.md` for Storyboard continuity
  sheet vocabulary without a new Asset type;
- `docs/architecture/reference/studio-skills.md` for review modes and creative
  ownership; and
- `docs/cli/commands.md` for focused media import metadata flags.

Do not rewrite historical plans or Decision 0080's body.

### Studio Skills repository

Update the exact focused references, samples, and evals named by the
Architecture Shape Gate. Keep general skill files concise and route to focused
owners. Do not describe the Character Sheet layout as Studio runtime
validation.

## Final Verification

### Focused Studio verification

Run the exact focused tests first, then:

```bash
pnpm test:core
pnpm test:cli
pnpm type-check:core
pnpm type-check:cli
pnpm lint:core
pnpm lint:cli
pnpm build:core
pnpm build:cli
pnpm check:architecture
```

No dependency installation is planned.

### Studio Skills verification

From `studio-skills`:

```bash
node skills/media-producer/scripts/validate-image-prompt-guides.mjs \
  --project urban-basilica
npm run release:test
```

Run the new forward tests on a disposable Urban Basilica copy without paid
generation.

### Full regression verification

After focused checks pass:

```bash
pnpm check
pnpm test
pnpm test:integration
pnpm build
```

Record unrelated pre-existing failures with exact evidence. Do not weaken the
new contracts to make an unrelated test pass.

### Real-project verification

First use an isolated copy of:

```text
/Users/keremk/renku-movies/urban-basilica
```

Verify:

- migration preserves the 16 current non-null scalar purpose values as exact
  singleton lists, maps all null values to `[]`, and leaves all other Asset and
  ownership data unchanged;
- focused sheet import persists the exact `storyboard` tag and readable summary
  in the same attachment;
- Asset list and Generation Context return the same metadata;
- Production and Storyboard continuity candidates coexist;
- no candidate is selected automatically;
- a corrected Urban Spec contains the universal layout and known height;
- a corrected Mehmed II Spec does not invent height and pauses for the missing
  fact unless the user explicitly supplies/waives it;
- both Specs use the exact Storyboard Lookbook Sheet and exact Production
  Character Sheet content authority;
- both Specs can be displayed in one combined Preview;
- no image tool/provider is invoked;
- no temporary output is attached; and
- the live Project remains unchanged during this proof.

After all automated, isolated-copy, and diff checks pass, run the planned live
`renku project migrate urban-basilica` step. Confirm its verified backup paths,
repeat the row/value/integrity checks on the migrated live database, and reopen
the Project in Studio. The migration must not alter Asset files, add the
`storyboard` tag, attach the temporary examples, or invoke generation.

A later user-approved manual acceptance run may generate corrected examples,
exercise both review modes, and attach accepted outputs with metadata. That is
not part of automated plan completion and retains its normal usage/cost
approval boundary.

### Diff and architecture review

In both repositories:

- inspect `git diff --stat`;
- inspect the complete diff;
- run `git diff --check`;
- preserve unrelated user changes, including the current untracked
  `sample-schema.json` in `studio-skills`;
- inspect every new or heavily modified file in full;
- confirm the only database change is migration 0077 plus its documented
  in-place scalar-to-list conversion;
- confirm no UI behavior, new route, or Settings change exists;
- confirm Asset metadata normalization has one Core owner;
- confirm generation attachments remain atomic;
- confirm candidate projection does not interpret metadata;
- confirm purpose-guide additions reuse the existing Storyboard Lookbook slot;
- confirm CLI remains thin;
- confirm focused skill references own detailed behavior;
- confirm the universal Character Sheet template did not enter runtime code;
- confirm strict iteration did not become a queue, scheduler, or approval
  bypass;
- confirm Scene Storyboard layout/crop production code is unchanged;
- confirm `index.ts` files remain thin; and
- confirm no checklist item was satisfied by accepting unreviewable code
  structure.

## Completion Checklist

### Review Area

- [x] User approves this plan before implementation.
- [x] Confirm Plan 0180 remains the implemented baseline rather than being
      rewritten.
- [x] Confirm continuity references remain required in the agent workflow.
- [x] Confirm Storyboard continuity sheets use existing subject-sheet Asset
      types and purposes.
- [x] Confirm first-class Asset tags and the exact `storyboard` convention are
      accepted.
- [x] Confirm absence of `storyboard` does not block use of a suitable
      same-owner fallback sheet.
- [x] Confirm the universal Character Sheet layout applies to Production and
      Storyboard rendering.
- [x] Confirm review-first remains the default.
- [x] Confirm strict iteration requires explicit user opt-in.
- [x] Confirm imperfect output remains attachable by explicit user choice.
- [x] Confirm the scalar-to-list migration is explicit and no hidden Project
      Setting, UI behavior, or bulk-generation behavior was added.

### Architecture And Contracts

- [x] Add Decision 0081.
- [x] Add the narrow Decision 0080 supersession notice.
- [x] Add `AssetMetadataInput` with deliberate public naming and use it from
      both update and focused attachment inputs.
- [x] Replace scalar `Asset.purpose` with non-null `Asset.tags: string[]`.
- [x] Replace scalar `UpdateAssetInput.purpose` with optional complete-list
      `tags` replacement.
- [x] Remove the scalar public field, option, and CLI flag directly with no
      alias, dual reader, or compatibility diagnostic.
- [x] Change the Drizzle Asset schema to JSON-mode text `tags` with a
      non-null empty-array default.
- [x] Generate migration 0077, its snapshot, and journal through Drizzle Kit.
- [x] Use the documented in-place add/populate/drop-column migration with
      `json_array(purpose)` and set schema generation 62.
- [x] Preserve scalar null as `[]` and every non-null scalar as one exact list
      entry without inferring new tags.
- [x] Extend `attachGenerationMedia` with optional nested Asset metadata.
- [x] Reuse one Core Asset metadata normalizer.
- [x] Persist attachment metadata atomically with the Asset, membership, file,
      and provenance.
- [x] Extend GenerationReferenceCatalogItem with exact nullable summary,
      nullable reference name, and non-null tags.
- [x] Keep candidate eligibility, ordering, and selection unchanged.
- [x] Add the existing Storyboard Lookbook slot to the three subject-sheet
      purposes.
- [x] Add no new GenerationPurpose, Asset type, owner, relationship, or global
      selection.
- [x] Add no database table or schema concept beyond the direct `tags` column
      cutover.
- [x] Add no runtime prompt/image semantics.
- [x] Keep package-boundary failures structured.
- [x] Use `CORE_ASSET_TAGS_INVALID` for invalid tag-list structure and
      `CLI045` for mutually exclusive Asset-update tag flags.
- [x] Confirm final module/file shape matches the Architecture Shape Gate.

### Core Implementation

- [x] Normalize Asset metadata in the existing Asset owner.
- [x] Trim tags, reject empty tags, deduplicate exact duplicates in first-
      authored order, preserve case, and perform no semantic interpretation.
- [x] Make `asset update` omission/replace/clear behavior match the `tags`
      contract.
- [x] Update Asset database access and projection to the `tags` column only.
- [x] Update every Core Asset writer, copy path, and test fixture directly.
- [x] Preserve each existing Cast Voice Asset purpose as one migrated tag
      without changing the separate Cast Voice domain contract.
- [x] Pass optional metadata through attachment wiring.
- [x] Persist `oneLineSummary` on generated/external focused attachment.
- [x] Persist `referenceName` on generated/external focused attachment.
- [x] Persist `tags` on generated/external focused attachment.
- [x] Preserve attachment rollback semantics.
- [x] Project summary, reference name, and tags for registered reference
      candidates.
- [x] Project null summary/reference name and `[]` tags for unregistered
      project-file references.
- [x] Preserve existing reference facts and provenance.
- [x] Reuse `storyboardLookbookSheetSlot` in Character Sheet context.
- [x] Reuse `storyboardLookbookSheetSlot` in Location Sheet context.
- [x] Reuse `storyboardLookbookSheetSlot` in Prop Sheet context.
- [x] Keep Production Lookbook and same-owner slots unchanged.
- [x] Keep every candidate unselected by default.

### CLI Surface

- [x] Pass `--summary` through `media import` to Core Asset metadata.
- [x] Pass `--reference-name` through `media import` to Core Asset metadata.
- [x] Pass every repeated `--tag` through `media import` to Core Asset
      metadata.
- [x] Make repeated `--tag` replace the complete list in `asset update`.
- [x] Make `--clear-tags` clear the list in `asset update`.
- [x] Reject combining `--tag` with `--clear-tags` before Core
      delegation using `CLI045`.
- [x] Remove `--reference-purpose` and `referencePurpose` from the current CLI
      contract.
- [x] Keep CLI normalization and semantic interpretation out of the handler.
- [x] Keep grouped Scene Storyboard import unchanged.
- [x] Update CLI command documentation.
- [x] Add focused handler tests.
- [x] Add one representative import/list/context integration test.

### Character Sheet Skill Workflow

- [x] Make `cast-character-sheets.md` the universal layout owner.
- [x] Require the large straight-on face close-up.
- [x] Require metadata below the face.
- [x] Require applicable accessory details below the face.
- [x] Require full-length front, back, left profile, and right profile views.
- [x] Require feet visible and neutral repeatable poses.
- [x] Require a labeled height ruler and matching written height.
- [x] Ask for missing height rather than inventing it.
- [x] Allow explicit user proceed-without-height with visible feedback.
- [x] Exclude default gesture, expression, action, tool, environment, and
      material-study blocks.
- [x] Allow layout departure only by explicit user request.
- [x] Keep Production versus Storyboard as appearance-only variation.
- [x] Update the canonical sample.
- [x] Add the Storyboard continuity Character Sheet sample.
- [x] Keep Casting Director's handoff focused on facts.
- [x] Add Urban and Mehmed II failure-pattern evals.

### Location And Prop Skill Workflow

- [x] Add Storyboard appearance versus Production content roles to Location
      Sheet guidance.
- [x] Add the same separation to Prop Sheet guidance.
- [x] Preserve existing Location board-design coverage.
- [x] Preserve existing Prop board-design coverage.
- [x] Add Storyboard continuity Location sample.
- [x] Add Storyboard continuity Prop sample.
- [x] Document atomic metadata import for both.
- [x] Update Production Designer handoff.
- [x] Add geography/construction/state and style-leakage evals.

### Scene Storyboard Skill Workflow

- [x] Read candidate Asset metadata from Generation Context.
- [x] Prefer a suitable candidate whose tags include exact `storyboard`.
- [x] Inspect candidate pixels and available generation provenance.
- [x] Do not trust a tag that conflicts with visible style or subject state.
- [x] Do not auto-select, use list order, or silently drop continuity.
- [x] If no suitable tagged sheet exists, inspect all eligible same-owner
      sheets and deliberately choose the best available continuity fallback.
- [x] Keep an untagged fallback continuity-only, keep the Storyboard Lookbook
      as sole appearance authority, and report added style-leakage risk.
- [x] Offer focused sheet preparation without blocking generation solely
      because `storyboard` is absent.
- [x] Route a genuinely missing usable same-owner sheet through focused
      preparation rather than substituting an unrelated owner.
- [x] Preserve the Storyboard Lookbook Sheet as sole appearance authority.
- [x] Preserve exact request-scoped choices in GenerationSpec.
- [x] Preserve one-Beat full-canvas behavior.
- [x] Preserve two-Beat disposable placeholder behavior.
- [x] Preserve three-Beat blank-cell behavior.
- [x] Preserve four-Beat grid behavior.
- [x] Preserve existing vision-guided cropping and occupied-cell-only import.

### Agent Quality Modes

- [x] Add `image-output-review.md` as the single review control-flow owner.
- [x] Route to it concisely from Media Producer's main skill/workflow.
- [x] Keep purpose criteria in focused guides.
- [x] Make review-first the default.
- [x] Show image plus passes, concerns, and recommendation.
- [x] Wait for accept/regenerate/discard in review-first mode.
- [x] Permit explicit attachment despite advisory concerns.
- [x] Require explicit opt-in for strict iterative mode.
- [x] Establish observable criteria before strict generation.
- [x] Require concrete failure evidence after each failed attempt.
- [x] Require a justified request change for creative iteration.
- [x] Create a new Spec for every changed creative request.
- [x] Preserve Preview, confirmations, estimates/tokens, concurrency, freeze,
      and provenance on every attempt.
- [x] Distinguish operational retry from creative iteration.
- [x] Allow the user to interrupt or accept the current result.
- [x] Add no persisted QA state, queue, scheduler, or runtime gate.

### Tests And Guardrails

- [x] Add migration 0077 tests for null, ordinary, quoted, backslash, mixed-
      case, and Unicode purpose values.
- [x] Prove migration preserves Asset relationships, selections, provenance,
      lifecycle rows, foreign-key integrity, and database quick check.
- [x] Add Core metadata normalization and persistence tests.
- [x] Add Asset list/update/copy/writer tests for non-null tags.
- [x] Add Core atomic rollback coverage.
- [x] Add candidate metadata projection tests.
- [x] Add project-file null-summary/null-reference-name/empty-tags
      coverage.
- [x] Add all three Storyboard Lookbook slot tests.
- [x] Add CLI delegation tests.
- [x] Add representative CLI integration coverage.
- [x] Add universal Character Sheet positive and negative evals.
- [x] Add Storyboard-native Location and Prop evals.
- [x] Add tagged/stale/missing candidate evals.
- [x] Add a multi-tag candidate eval proving exact membership works without
      tag-order priority.
- [x] Add review-first feedback and imperfect-acceptance evals.
- [x] Add strict-iteration, user-override, and cost-boundary evals.
- [x] Keep one-/two-/three-/four-Beat layout regression cases.
- [x] Make no paid provider call in automated tests or evals.
- [x] Confirm no runtime prompt/image semantic validation exists.
- [x] Confirm architecture tests protect stable boundaries rather than private
      implementation names.

### Documentation

- [x] Document first-class Asset tags and JSON storage.
- [x] Document migration 0077's scalar-to-singleton-list preservation step.
- [x] Document atomic focused-import Asset metadata.
- [x] Document reference candidate metadata.
- [x] Document optional Production and Storyboard Lookbook slots.
- [x] Document Storyboard continuity sheet vocabulary without a new type.
- [x] Document both agent review modes and user override.
- [x] Update Studio Skills architecture guidance.
- [x] Update CLI commands.
- [x] Document repeatable `--tag` for `media import`, plus repeatable `--tag`
      and explicit `--clear-tags` replacement behavior for `asset update`.
- [x] Update focused sister-repository skill references, samples, and evals.
- [x] Do not rewrite historical plans or Decision 0080's body.

### Final Verification

- [x] Run focused Core tests.
- [x] Run focused CLI tests and representative integration case.
- [x] Run Core and CLI type checks.
- [x] Run Core and CLI lint.
- [x] Run Core and CLI builds.
- [x] Run architecture checks.
- [x] Run the Media Producer image prompt-guide validator.
- [x] Run Studio Skills release tests.
- [x] Run root `pnpm check`.
- [x] Run root `pnpm test`.
- [x] Run root `pnpm test:integration`.
- [x] Run root `pnpm build`.
- [x] Verify on an isolated Urban Basilica copy without paid generation.
- [x] Apply migration 0077 through `renku project migrate` to the isolated copy
      and verify all 102 Assets, including the 16 populated scalar values.
- [x] After every prior check passes, apply migration 0077 to live Urban
      Basilica through `renku project migrate urban-basilica` and record the
      verified backup and sidecar paths.
- [x] Verify the migrated live Project retains all Asset/file/ownership data,
      adds no inferred `storyboard` tags, and reopens in Studio.
- [x] Prepare and combined-preview corrected Urban and Mehmed II Specs.
- [x] Confirm live Urban Basilica changed only through migration 0077 and its
      media files and temporary test outputs remain unchanged.
- [x] Run `git diff --check` in both repositories.
- [x] Inspect `git diff --stat` and the complete diff in both repositories.
- [x] Inspect every new or heavily modified file in full.
- [x] Confirm the untracked `studio-skills/sample-schema.json` remains
      untouched.
- [x] Confirm migration 0077 is the only schema change and contains no
      unrelated data cleanup or inferred retagging.
- [x] Confirm no UI behavior, new route, or Settings change was added.
- [x] Confirm no new god file, catch-all helper, broad dispatcher, or retry
      service was added.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm Scene Storyboard composite/crop production code is unchanged.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark this plan complete.

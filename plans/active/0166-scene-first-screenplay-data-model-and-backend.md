# 0166 Scene-First Screenplay Data Model And Backend

Status: complete
Date: 2026-08-03

Cross-phase product, UI, import, and research context:
[Scene-First Screenplay And FDX Import — Shared Design Context](assets/0166-0168-screenplay/shared-design-context.md).

This plan is the sole normative owner of the canonical Project/Screenplay data
model and persistence contract. Plan 0169 separately owns the Screenplay
Analysis contract and its conversion away from organizational Act/Sequence
IDs. Plans 0166 and 0169 form one coordinated backend cutover: neither database
migration is applied to the real project until both implementations pass their
completion gates. Plan 0167 depends on both for Studio UI cutover, and Plan 0168
depends on the completed backend and UI.

## Summary

Replace the confusing metadata/document model and mandatory
`Act -> Sequence -> Scene` hierarchy with a complete scene-first backend.

At completion:

- Project is the single owner of title, logline, synopsis, premise, genre,
  themes, and screenplay-development metadata;
- `Screenplay` means screenplay content, optional sections, canonical order,
  and references—nothing else;
- every supported screenplay block and dialogue form has a closed TypeScript
  and JSON Schema contract;
- Scenes are independent of Acts and Sequences;
- Acts and Sequences are optional, non-owning Sections;
- section deletion promotes direct children in place;
- screenplay text references Cast Members, Locations, and Props without
  `@handles` or duplicated fact objects;
- Beat Sheet evidence uses stable Block IDs;
- screenplay resources, CLI, and Studio HTTP no longer require section ancestry;
- the real development database is backed up, migrated once, and verified; and
- the screenplay-drafter, Scene Beat, Shot, and director Skills author and
  consume this exact backend contract.

This phase may leave the React browser broken where it still expects old
responses. The coordinated Plans 0166/0169 backend cutover may not leave Core,
SQLite, CLI, resource projections, Studio server routes, or agent contracts
half-converted. There is no compatibility facade between phases.

## Requirement Ledger

| Requirement | Phase-1 behavior | Owner |
| --- | --- | --- |
| Verified backup | A verified Core-generated backup and sidecar exist before any production-code implementation or database mutation begins. | Core migration lifecycle |
| One metadata owner | Duplicate screenplay metadata is moved to direct Project properties and removed from Screenplay. | Project domain/schema |
| Clear public aggregate | Public reads return one `Screenplay`, not `ScreenplayDocument { screenplay }` or kind-tagged wrappers. | Core client contract |
| Defined fields | Every public field and discriminator has an explicit meaning, owner, optionality, and authorship/import boundary. | Core client contract/schema |
| Complete semantic union | Every accepted block, dialogue part, and dual-dialogue form has a closed type/schema and stable ID. | Core screenplay module |
| Final Draft Scene numbers | An optional exact production number belongs to its Scene; the Renku reservation/allocator model is removed. | Core Scene contract/schema |
| Scene independence | Scene storage contains no Section owner or local ordering column. | Core schema |
| One order | Mixed structure entries provide the only canonical Scene traversal. | Core structure service |
| Optional Sections | Root, Act, and Sequence containment follows the bounded canonical model below. | Core structure validator |
| Lossless Section deletion | Deleting a Section promotes direct children at the same position without recursively flattening descendants. | Core Section command |
| Project subject references | Speaker, setting, mention, and presence bindings support Cast Members, Locations, and Props. | Core reference command/storage |
| Stable evidence | Beat Sheets reference stable Block IDs; dialogue audio references Dialogue Turn IDs. | Core Beat/audio contracts |
| Backend cutover | CLI, resources, project-data service, HTTP routes, selection context, and coordination use the new contracts. | Core, CLI, Studio server |
| Direct data conversion | `urban-basilica` preserves current creative and production meaning without a runtime old-shape reader. | Drizzle migration |
| Skill cutover | Drafter, Beat, Shot, and director guidance no longer teaches the obsolete model. Screenplay Analyst guidance is owned by Plan 0169. | `studio-skills` |

## Product Behavior

The canonical data model is defined in this plan. The shared context supplies
the cross-phase product and research rationale. Phase 1 must implement these
specific backend behaviors:

- `Screenplay.opening` is an ordered screenplay-level region outside Scenes.
- `Scene.heading` establishes the Scene boundary; Scene title is optional.
- `Scene.productionNumber` is the optional Final Draft Scene Number associated
  with that Scene's heading and remains independent of Scene order.
- the number is stored/resolved as its exact authored string; there is no
  separate Renku reservation registry, omitted-number state, or allocator, and
  Scene creation does not invent a number.
- the complete `ScreenplayBlock` union is accepted and validated.
- normal Dialogue uses its Block ID as `DialogueTurnId`; Dual Dialogue owns two
  separately addressable turns.
- Cast/Location/Prop facts are never embedded in Screenplay JSON.
- references target exact screenplay elements and may include a validated
  UTF-16 range or unanchored presence.
- every Scene and Section appears exactly once in mixed structure entries.
- all ordered consumers call one Core traversal implementation.
- moving a Scene changes placement only.
- deleting a Section removes only the wrapper and keeps ordered Scene traversal
  identical.

Valid examples include:

```text
Scenes                  Scenes                  Scenes
  Scene 1                 Sequence A              Act I
  Scene 2                   Scene 1                 Scene 1
                            Scene 2                 Sequence A
                          Scene 3                     Scene 2
                                                      Scene 3
```

No browser organization controls are part of this phase or the current MVP.
The Core/CLI operations exist because the domain must be complete and agents
must not manipulate database rows directly.

## Explicit Non-Goals

- No React/browser implementation; Plan 0167 owns it.
- No Screenplay Analysis contract, validation, context, persistence conversion,
  Story Arc resource, analyst CLI, or analyst Skill work; Plan 0169 owns that
  bounded change.
- No FDX parser, source Asset, hash, import record, or import command; Plan 0168
  owns them.
- No FDX export or re-import.
- No formatting runs, font/alignment/page fields, ScriptNotes, production tags,
  or Final Draft editor state.
- No Final Draft Number/Renumber command, locked-number workflow, omitted-Scene
  workflow, or automatic A/B insertion policy; those are future screenplay-
  editing behavior, not required for semantic import.
- No user-facing Section authoring controls.
- No arbitrary recursive folder tree.
- No automatic Act/Sequence inference.
- No duplicate convenience fields for old consumers.
- No old route aliases, old JSON kinds, compatibility imports, or migration-on-
  read.
- No change to Cast/Location/Prop descriptive ownership, designs, or media.
- No Section-owned Asset or Section-scoped costume/design dependency; costume
  variants that need narrower continuity use explicit Scene IDs.
- No removal of screenplay revision history; snapshots are updated to the new
  aggregate.

## Context And Evidence

The detailed cross-phase repository and real-project findings are in the shared
design context.
Implementation must additionally inspect and update every current owner in this
inventory:

- public contracts and schemas:
  `packages/core/src/client/screenplay*.ts`, `scene-beat-sheet*.ts`,
  `project.ts`, and current package entrypoints;
- storage:
  `server/schema/{project,screenplay,acts,sequences,scenes,scene-locations}.ts`,
  production numbers, Beat Sheets, dialogue audio, and revisions;
- Core behavior:
  current screenplay commands, JSON validators, persistence, projections,
  context text, resources, project-data service wiring, selection resources,
  coordination, and resource keys;
- CLI:
  current screenplay authoring, read, revision, Beat Sheet, and Scene number
  subcommands currently concentrated in flat command files;
- Studio server:
  `routes/screenplay.ts`, hierarchy routes in `routes/navigation.ts`, flat
  screenplay HTTP helpers, project responses, selection context, and fakes;
- current docs and ADRs describing mandatory Sequences, mandatory Scene
  numbers, Props outside screenplay references, and block-index evidence; and
- the exact sister-skill files enumerated in the shared design context.

Accepted architecture references include:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/naming-guidelines.md`;
- `docs/architecture/json-storage-validation.md`;
- `docs/architecture/drizzle-migrations.md`;
- `docs/architecture/structured-diagnostics.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/studio-server-hono.md`;
- ADR 0060 for production Scene numbers; and
- ADR 0070 for first-class Props.

Both ADRs need supersession through a new screenplay-model ADR: ADR 0060's
Renku number reservation/allocation model is fully replaced by the optional
exact `Scene.productionNumber` contract, and Props become valid screenplay
reference subjects without losing independent Project identity.

## Right-Sized Change Decision

### Reuse unchanged

Rejected. Nullable `scene.sequence_id` would still leave root, Act, Sequence,
and Scene positions as competing orders. Keeping embedded Cast/Location objects
or `@handles` would preserve the current ownership defect and still omit Props.

### Refactor the existing owner

Accepted. Core already owns screenplay validation, operations, SQLite,
resources, revisions, Beat Sheets, audio, and project service wiring.
Those responsibilities remain in Core, but the current flat and monolithic
files are reorganized into one bounded screenplay module.

### Introduce a general document or folder platform

Rejected. Renku needs one Screenplay aggregate and a bounded Act/Sequence
structure, not a generic document engine, rich-text system, arbitrary folders,
or cross-product reference graph.

## Canonical Data Model

The public concepts, field names, and serialized shapes below are fixed for
implementation and normative for Plans 0167, 0168, and 0169. Public JSON
represents every ID as a string; TypeScript may brand those strings to prevent
accidental cross-domain assignment.

### Identity types

```ts
type ProjectId = string;
type SceneId = string;
type BlockId = string;
type DialogueTurnId = string;
type DialogueBlockId = BlockId & DialogueTurnId;
type DialoguePartId = string;
type ScreenplaySectionId = string;
type ScreenplayStructureEntryId = string;
type ScreenplayReferenceId = string;
type ScreenplayRevisionId = string;
type CastMemberId = string;
type LocationId = string;
type PropId = string;
```

All IDs are durable, opaque identities. They are not titles, array indexes,
Scene numbers, Section paths, or ordering keys. Core generates IDs during
ordinary authoring, the one-time migration preserves or deterministically
derives them as specified below, and Plan 0168 derives source-owned IDs
deterministically during FDX import. Callers may store, compare, and submit IDs
but may not interpret their characters.

Identity scopes are explicit. `BlockId` is unique across opening elements and
top-level Scene Blocks. `DialogueTurnId` is unique across ordinary and Dual
Dialogue turns. An ordinary Dialogue has one `DialogueBlockId` that
participates in both identity scopes, allowing the same semantic element to be
addressed as an ordered Block or a Dialogue Turn without a duplicate ID. A
Dual Dialogue wrapper has a distinct `BlockId`; each of its two nested turns
has a distinct `DialogueTurnId` and is not itself a top-level Block.
`DialoguePartId` is unique across the Screenplay. The remaining ID types are
unique within their named collections.

### Project metadata

The duplicate metadata object currently called `Screenplay` is removed. These
become direct `Project` properties:

```ts
interface Project {
  id: ProjectId;
  projectName: string;
  title: string;
  aspectRatio: string;
  coverImage: ProjectCoverImage | null;
  logline?: string;
  synopsis?: string;
  premise?: string;
  intendedAudience?: string;
  format?: string;
  targetRuntimeMinutes?: number;
  primaryGenre?: string;
  secondaryGenres?: string[];
  tones?: string[];
  contentRatingIntent?: string;
  creativeBoundaries?: string[];
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
  dramatizedElements?: string[];
  screenplayDraftStatus?: string;
  researchSources?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  nextSteps?: string[];
  counts: ProjectCounts;
}

interface ProjectCoverImage {
  fileName: "cover.png";
}

interface ProjectCounts {
  languages: number;
  castMembers: number;
  locations: number;
  props: number;
  acts: number;
  sequences: number;
  scenes: number;
}
```

Every Project field above has one meaning:

| Field | Definition |
| --- | --- |
| `id` | Durable internal Project identity. It is not the folder name or CLI selector. |
| `projectName` | Stable storage/CLI selector currently exposed vaguely as `name`. |
| `title` | Audience-facing movie title. |
| `aspectRatio` | Project-wide intended picture aspect ratio already owned by Project. |
| `coverImage` | Existing conventional Project cover image when present; `null` means none is attached. |
| `logline` | Concise story hook, normally one sentence. |
| `synopsis` | Plot summary currently stored as `summary`. |
| `premise` | Framing dramatic proposition currently stored as `premiseOverview`. |
| `intendedAudience` | Human audience the project is being made for. |
| `format` | Narrative form such as “short film” or “feature film”; it does not contain a duration. |
| `targetRuntimeMinutes` | Numeric intended finished runtime in minutes. |
| `primaryGenre` | Main genre classification. |
| `secondaryGenres` | Ordered additional genre classifications. |
| `tones` | Ordered tonal qualities for the project. |
| `contentRatingIntent` | Intended audience-content rating target, distinct from `intendedAudience`. |
| `creativeBoundaries` | Authored content constraints or exclusions, not software-validation boundaries. |
| `centralConflict` | Primary opposing dramatic forces. |
| `dramaticQuestion` | Main question whose resolution drives the story. |
| `themes` | Ordered thematic ideas explored by the project. |
| `historicalBasis` | Ordered known historical facts or sources forming the factual basis. |
| `dramatizedElements` | Ordered elements intentionally invented, compressed, or altered for drama. |
| `screenplayDraftStatus` | Human-readable development state of the screenplay, not a workflow enum unless a later decision defines one. |
| `researchSources` | Ordered source citations or research references used by the project. |
| `assumptions` | Decisions temporarily accepted so work can proceed despite incomplete information. |
| `openQuestions` | Unresolved questions requiring later user/agent collaboration. |
| `nextSteps` | Agreed follow-up work, distinct from assumptions and questions. |
| `counts` | Current resource counts for navigation/status. Act and Sequence counts describe optional Sections and never imply Scene ownership. |

Optional fields are absent when no value has been authored. Optional string
arrays preserve authored order; each present entry is a non-empty string. These
fields are Project development metadata, not FDX screenplay content, so the
deterministic importer does not invent or overwrite them.

Every `ProjectCounts` member is a Core-computed non-negative integer, never an
authoring input. `acts` and `sequences` count Section types; `scenes` counts
Scenes regardless of organization. `ProjectCoverImage.fileName` remains the
existing conventional `cover.png` contract and is not arbitrary UI copy.

The vague public `ProjectInfo` wrapper is removed. Existing project-selection,
creation, and migration reports may continue returning the explicit
`projectPath` and `databasePath` values their filesystem workflows require, but
those paths are not Project story metadata and do not wrap the `Project`
contract.

The Project owns, but does not embed in the `Project` response, one Screenplay
and the existing Cast Member, Location, Prop, Visual Language, Lookbook, Beat,
Shot, Generation, and Asset collections. Those continue through their bounded
resources and contracts. This prevents an eager mega-response without changing
lifecycle ownership. In particular, `Project.sequences` disappears; callers
read optional Acts, Sequences, and Scenes from the Screenplay structure
resource.

### Adjacent Project facts

The Cast Member, Location, and Prop base-fact contracts are preserved; they are
not redesigned as screenplay children:

```ts
interface CastMember {
  id: CastMemberId;
  handle: string;
  name: string;
  role?: string;
  isVoiceOver: boolean;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  voiceNotes?: string;
  description?: string;
}

interface Location {
  id: LocationId;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}

interface Prop {
  id: PropId;
  handle: string;
  name: string;
  description?: string;
  visualNotes?: string;
}
```

The preserved fields have these explicit meanings:

| Field | Definition |
| --- | --- |
| each `id` | Durable opaque identity in that Project collection. |
| each `handle` | Stable unique fact-authoring/CLI selector. It is not screenplay markup and is never required in prose. |
| each `name` | User-facing canonical display name for the subject. |
| `CastMember.role` | Optional authored narrative/production-role label; it has no closed vocabulary. |
| `CastMember.isVoiceOver` | Explicit fact that the Cast Member is audio-only or voice-over; it is not inferred from one `V.O.` cue. |
| `CastMember.age` | Optional authored non-negative integer character age in years. |
| `CastMember.want` | Optional conscious dramatic objective. |
| `CastMember.need` | Optional underlying dramatic need. |
| `CastMember.arc` | Optional summary of character change across the project. |
| `CastMember.voiceNotes` | Optional authored vocal/performance guidance owned by Cast facts. |
| `Location.timePeriod` | Optional period in which the represented place exists or is dressed. |
| each `description` | Optional agent/user-authored Project knowledge about the subject, not imported screenplay prose. |
| each `visualNotes` | Optional appearance/design guidance owned by Location or Prop facts. |

Names, descriptions, and other facts are not copied into
`ScreenplayReference`; the reference stores only the durable subject ID.

The deterministic FDX importer creates none of these entities. After import,
the agent and user may create or update facts in their owning domains and then
add screenplay references. Removing a screenplay reference never deletes its
subject. Deleting a referenced Cast Member, Location, or Prop remains blocked
until its references are explicitly removed or redirected.

### Screenplay

`ScreenplayDocument`, `ScreenplayCreateDocument`, the redundant
`kind: "screenplay"`, and the nested `screenplay` property disappear.

```ts
interface Screenplay {
  opening: OpeningElement[];
  scenes: Scene[];
  sections: ScreenplaySection[];
  structure: ScreenplayStructureEntry[];
  references: ScreenplayReference[];
}
```

This is one project-owned aggregate. Each collection has a distinct purpose:

- `opening` contains semantic screenplay content before the first Scene;
- `scenes` contains authored Scene content;
- `sections` contains optional Act and Sequence labels/descriptions;
- `structure` contains placement and order, without copying Scene content; and
- `references` binds screenplay targets to Project Cast Members, Locations,
  and Props.

The aggregate has no title, logline, Cast list, Location list, Prop list,
formatting document, or generic `kind` field.

Each Project has exactly one Screenplay aggregate. It does not repeat
`projectId` inside its JSON because the selected project database supplies that
scope. `opening`, `scenes`, `sections`, `structure`, and `references` are always
present arrays, including when empty. IDs are unique within their respective
collections; Core validates every cross-reference and exact-once placement
before committing the aggregate.

`readScreenplay` therefore returns a `Screenplay`, never `null` and never an
existence wrapper. A new Project reads as five empty arrays. In this contract,
`createScreenplay` means atomically populating that empty aggregate, not
creating a second lifecycle object or singleton row.

Array semantics are not implicit:

- `opening` order is authored screenplay order;
- `Scene.blocks` and every `DialogueTurn.parts` order are authored screenplay
  order;
- `structure` positions are the sole persisted organization and Scene-order
  source of truth;
- canonical reads serialize `structure` in ordered depth-first traversal,
  `scenes` in the resulting Scene order, and `sections` in the resulting
  Section encounter order for deterministic JSON, but those derived array
  positions are not separately writable order fields;
- complete-create inputs may list `scenes` and `sections` in any array order
  because their structure entries define placement; and
- `references` has no authored order and is returned in stable ID order.

CLI JSON files are validated by the command that consumes them. They do not
need redundant document-kind tags such as `screenplayCreate` or
`screenplayOperations`.

### Scene

```ts
interface Scene {
  id: SceneId;
  productionNumber?: string;
  heading: string;
  title?: string;
  blocks: ScreenplayBlock[];
}
```

Every Scene field has one owner and meaning:

| Field | Definition and authorship |
| --- | --- |
| `id` | Durable opaque Scene identity. Moving or renumbering a Scene never changes it. |
| `productionNumber` | Optional exact Final Draft Scene Number associated with the Scene Heading. It is unique among current Scenes. FDX import preserves it; Core does not allocate or normalize it. |
| `heading` | Required plain semantic Scene Heading paragraph. It starts the Scene and is not duplicated in `blocks`. |
| `title` | Optional Renku planning label used for navigation and discussion. It is authored by a user/agent and is never inferred by deterministic FDX import. |
| `blocks` | Authored screenplay body from immediately after this heading to immediately before the next Scene Heading. Array order is screenplay order within the Scene. |

The inherited `storyFunction` field is removed rather than renamed. Its sample
values mix structural beat labels with free-form dramatic commentary and have
no defined screenplay authorship or vocabulary. Dramatic interpretation belongs
to the independently persisted Screenplay Analysis owned by Plan 0169, not to
the semantic Scene.

The exact `heading` text is retained as one string. Renku may tokenize common
`INT./EXT.`, location, and time-of-day portions for presentation, but those
tokens are not another persisted source of truth. Scene order is defined only
by `structure`; `productionNumber` is never an ordinal or sort key. A Scene
starts at its Scene Heading and ends immediately before the next Scene Heading.

### Screenplay blocks

Every block has a stable `id`. JSON Schemas are closed with
`additionalProperties: false`, and every consumer switches exhaustively over
the complete discriminator union.

```ts
type ScreenplayBlock =
  | TextBlock
  | DialogueBlock
  | DualDialogueBlock;

interface TextBlock {
  id: BlockId;
  type:
    | "action"
    | "transition"
    | "shot"
    | "lyrics"
    | "castList"
    | "note"
    | "specialHeading"
    | "titleCard"
    | "super";
  text: string;
}

interface DialogueBlock {
  id: DialogueBlockId;
  type: "dialogue";
  characterName: string;
  extensions: string[];
  parts: DialoguePart[];
}

interface DualDialogueBlock {
  id: BlockId;
  type: "dualDialogue";
  left: DialogueTurn;
  right: DialogueTurn;
}

interface DialogueTurn {
  id: DialogueTurnId;
  characterName: string;
  extensions: string[];
  parts: DialoguePart[];
}

type DialoguePart =
  | { id: DialoguePartId; type: "speech"; text: string }
  | { id: DialoguePartId; type: "parenthetical"; text: string };
```

`TextBlock.id` is the durable identity used by references and Beat evidence.
`TextBlock.text` is the exact visible plain text after source formatting runs
are concatenated; authored line breaks may remain. Each `type` has a defined
screenplay meaning:

| `TextBlock.type` | Meaning |
| --- | --- |
| `action` | Visual, audible, or behavioral narrative description. |
| `transition` | Editorial transition instruction such as `CUT TO:` or `FADE OUT.` |
| `shot` | Authored shot/camera-direction element that is explicitly semantic in the source. |
| `lyrics` | Sung lyric text represented as a screenplay element. |
| `castList` | Visible Cast List element in the screenplay body; it does not create Project Cast Members. |
| `note` | Visible Note screenplay element intended to appear with the script; it is not a Final Draft ScriptNote. |
| `specialHeading` | Visible non-Scene heading that does not establish a Scene boundary or, by itself, create an Act/Sequence Section. |
| `titleCard` | Text intended to appear as a title card. |
| `super` | Text intended to be superimposed over the image. |

Alignment is a rendering convention. A Transition is not stored as
`alignment: "right"`, and a Title Card is not stored as
`alignment: "center"`.

A `DialogueBlock` represents one ordinary Dialogue turn:

- `id` is both its stable Block ID and `DialogueTurnId`, so dialogue audio has
  no second redundant `dialogueId`;
- `characterName` is the exact semantic character-cue name after cue extensions
  are separated. It is display text, not a Cast Member ID;
- `extensions` is an ordered array of cue qualifiers such as `V.O.` and `O.S.`,
  stored without their outer display parentheses. Extensions do not identify
  the speaker;
- `parts` preserves the exact authored order of speech and Parentheticals and
  must contain at least one speech part; and
- a `speaker` reference supplies the separate Cast Member identity when known.

There is no canonical `dialogueOrderKey`. Dialogue order is the containing
Scene's Block order, identity is the durable turn ID, and a storage filename is
not screenplay data.

For `DialoguePart`, `id` is a stable target for exact references. A `speech`
part contains spoken text. A `parenthetical` part contains the semantic
performance direction in its authored position without one conventional pair
of outer parentheses; the Renku renderer supplies those parentheses. Any
punctuation inside the direction remains authored text. Parentheticals are not
generic italic text and are not top-level screenplay blocks.

A `DualDialogueBlock` represents simultaneous speech:

- the wrapper `id` identifies the Dual Dialogue block in Scene order;
- `left` and `right` are exactly two valid `DialogueTurn` values;
- each turn has its own distinct `DialogueTurnId`, cue, extensions, ordered
  parts, speaker reference, and dialogue-audio state; and
- the wrapper itself has no speaker or audio identity.

`General` is not a canonical Renku screenplay type because it is an ambiguous
Final Draft paragraph style rather than a screenplay meaning. The importer
uses a bounded deterministic mapping: recognized opening transitions such as
`FADE IN:` map to Transition; other visible General prose maps to Action with
its text preserved and a technical normalization entry. Unknown visible
paragraph types that cannot be safely represented fail import rather than
disappearing.

### Opening content

Final Draft defines a Scene as beginning with a Scene Heading. Real FDX files
commonly contain `FADE IN:` before the first Scene Heading, so attaching this
content to Scene 1 would be structurally false and would make it move or vanish
with that Scene.

```ts
type OpeningElement = TextBlock;
```

`Screenplay.opening` is an ordered, usually empty collection of supported
non-dialogue semantic elements before the first Scene. It is not called
`openingBlocks` because it is a named screenplay region, not an unexplained
overflow list.

An `OpeningElement` has exactly the `TextBlock` fields and meanings defined
above. Any supported Text Block discriminator may appear when that semantic
element genuinely precedes the first Scene Heading. Ordinary Dialogue and Dual
Dialogue are not `OpeningElement` variants in this iteration.

Opening elements:

- stay at the beginning when Scenes are moved;
- remain when the first Scene is deleted;
- do not count as a Scene;
- do not belong to Scene Beat Sheets, Shot Plans, dialogue audio, or Scene
  generation context; and
- render above the first canonical Scene only when non-empty.

Dialogue before the first Scene Heading is outside the supported main-script
subset for this iteration and fails deterministic import with a structured
diagnostic rather than being assigned to a fabricated Scene.

### Subject references

Project Cast Members, Locations, and Props keep their existing durable facts,
descriptions, design histories, media, and specialist ownership. The
Screenplay stores only bindings to those entities.

```ts
type ScreenplaySubject =
  | { type: "castMember"; id: CastMemberId }
  | { type: "location"; id: LocationId }
  | { type: "prop"; id: PropId };

type ScreenplayReferenceTarget =
  | { type: "openingElement"; elementId: BlockId }
  | { type: "scene"; sceneId: SceneId }
  | { type: "sceneHeading"; sceneId: SceneId }
  | { type: "block"; sceneId: SceneId; blockId: BlockId }
  | { type: "dialogueCue"; sceneId: SceneId; turnId: DialogueTurnId }
  | {
      type: "dialoguePart";
      sceneId: SceneId;
      turnId: DialogueTurnId;
      partId: DialoguePartId;
    };

interface ScreenplayTextRange {
  start: number;
  length: number;
}

interface ScreenplayReference {
  id: ScreenplayReferenceId;
  subject: ScreenplaySubject;
  target: ScreenplayReferenceTarget;
  role: "speaker" | "setting" | "mention" | "presence";
  range?: ScreenplayTextRange;
}
```

`ScreenplaySubject` contains only the durable Project-entity identity. Cast
Member, Location, and Prop names, descriptions, designs, and media remain in
their existing Project domains.

Each reference target identifies one exact semantic element:

| Target | Addressed value |
| --- | --- |
| `openingElement` | One `Screenplay.opening` Text Block and its `text`. |
| `scene` | The Scene as a whole; it has no target text for a range. |
| `sceneHeading` | The Scene's `heading` text. |
| `block` | One Scene Block. A range is possible only when the referenced block is a `TextBlock`. |
| `dialogueCue` | One Dialogue Turn's `characterName` text. |
| `dialoguePart` | One speech or Parenthetical part's `text`. |

Roles have a closed subject/target/range matrix:

| Role | Subject | Target | Range |
| --- | --- | --- | --- |
| `speaker` | Cast Member only | `dialogueCue` only | Forbidden; exactly one speaker binding may exist per Dialogue Turn. |
| `setting` | Location only | `scene` or `sceneHeading` | Forbidden; it records the Scene setting rather than a literal mention. |
| `mention` | Cast Member, Location, or Prop | `openingElement`, `sceneHeading`, textual `block`, `dialogueCue`, or `dialoguePart` | Required and non-empty. |
| `presence` | Cast Member, Location, or Prop | `scene` or `block` | Forbidden; it records relevance without claiming literal target text. |

`ScreenplayTextRange.start` is a zero-based JavaScript UTF-16 offset and
`length` is a positive UTF-16 code-unit count. The addressed substring need not
equal the Project entity's display name; for example, “the bronze mouth” may
refer to the Great Bombard Prop. Core requires `start + length` to be no greater
than the addressed string's JavaScript `length`, and neither endpoint may fall
between the high and low surrogate of one Unicode code point. It rejects
overlapping interactive mention ranges on the same target; adjacent ranges are
valid.

The referenced Project entity and every target ID must exist. Existing
dependency checks prevent deletion of a subject while a screenplay reference
exists. A Scene content update and all reference additions/removals in the same
operation batch validate against the final state atomically, so no stale range
survives a successful text replacement.

The sample migration replaces each known `@handle` token with the subject's
ordinary display name and creates the corresponding range binding. Existing
ID-only relationships become semantic setting/presence bindings. An unresolved
or ambiguous token aborts the migration instead of leaving application markup
inside screenplay prose.

### Sections and canonical order

```ts
interface ScreenplaySection {
  id: ScreenplaySectionId;
  type: "act" | "sequence";
  title: string;
  description?: string;
}

interface ScreenplayStructureEntry {
  id: ScreenplayStructureEntryId;
  parentSectionId?: ScreenplaySectionId;
  content:
    | { type: "scene"; sceneId: SceneId }
    | { type: "section"; sectionId: ScreenplaySectionId };
  position: number;
}
```

Every Section and structure field is defined:

| Field | Definition |
| --- | --- |
| `ScreenplaySection.id` | Durable identity of the organizational wrapper. |
| `ScreenplaySection.type` | Meaningful discriminator: `act` or `sequence`. It controls bounded containment but does not grant ownership. |
| `ScreenplaySection.title` | Required user-visible organizational label. An explicit supported FDX marker may supply it. |
| `ScreenplaySection.description` | Optional user/agent-authored explanation of the Section's dramatic purpose. Deterministic FDX import leaves it absent. |
| `ScreenplayStructureEntry.id` | Durable identity of one placement record. A move preserves this ID. |
| `parentSectionId` | Parent wrapper identity; absent means the entry is at the Screenplay root. |
| `content` | Exactly one placed Scene or Section identity. It never embeds or copies that object's content. |
| `position` | Zero-based contiguous order among entries with the same `parentSectionId`. Core maintains it; mutation callers submit placement intent instead of numeric positions. |

The `type` fields above are meaningful union discriminators. They are not
redundant tags saying that a Screenplay is a screenplay. A unique placement
constraint and Core validation enforce one entry at each sibling position and
exactly one entry for every Scene and Section.

Valid containment is bounded:

- root: Scene, Act, or Sequence;
- Act: Scene or Sequence;
- Sequence: Scene;
- no Act inside Act or Sequence;
- no Sequence inside Sequence.

Every Scene and Section has exactly one structure entry. Ordered depth-first
traversal is the only canonical screenplay Scene order. No writable
`scene.position`, `scene.sequenceId`, merged adapter order, or order cache
survives.

Deleting a section removes only the wrapper and splices its direct children at
the wrapper's former position:

```text
Act I                       Act I
  Sequence A    delete       Scene 1
    Scene 1      ----->       Scene 2
    Scene 2
```

If deleting an Act promotes a child Sequence, that Sequence survives as a
Sequence at root. Deletion is not recursive flattening. The ordered Scene-ID
traversal before and after section deletion is identical.

Moving a Scene changes only its structure entry. Scene ID, content, production
number, Beat Sheet, Shot Plans, generations, dialogue audio, and references do
not change.

### JSON Schema contract

The TypeScript contracts above and their runtime JSON Schemas describe the same
closed model. The Core client entrypoints export these deliberately named
schemas:

- `projectSchema` for the complete public `Project` shape;
- `screenplaySchema` for the complete `Screenplay` aggregate;
- `screenplayInputSchema` for create/authoring identities and input shapes;
- `sceneSchema`;
- `screenplayBlockSchema`, including every Text Block discriminator, ordinary
  Dialogue, Dialogue Part, Dialogue Turn, and Dual Dialogue;
- `openingElementSchema`;
- `screenplaySectionSchema`;
- `screenplayStructureEntrySchema`;
- `screenplayReferenceSchema`, including the complete subject/target/role/range
  matrix;
- `screenplayOperationSchema`;
- `screenplayOperationsInputSchema`; and
- `screenplayMutationReportSchema` for the exact successful create/apply
  response.

Every object schema uses `additionalProperties: false`. Discriminated unions
use closed `oneOf` branches, required fields match the TypeScript definitions,
optional values are genuinely optional rather than nullable unless the
persistence projection explicitly uses SQL `NULL`, IDs and required authored
strings are non-empty, optional authored arrays have `minItems: 1` when
present, `screenplayOperationsInputSchema.operations` has `minItems: 1`, and
finite/non-negative integers are enforced where relevant.

Schema parity tests must instantiate every branch through both TypeScript
fixtures and AJV, reject unknown fields/discriminators, and prove the read and
write validators use the same schema objects. Database JSON is validated before
write and after read; CLI and HTTP adapters call Core and do not maintain
slightly different copies.

## Persistence Model

The Drizzle TypeScript schema is the source of truth.

### `project`

The existing single Project row remains the owner of its core identity and
display fields:

| SQL storage | Public property | Storage rule |
| --- | --- | --- |
| `id` | `id` | Non-empty text primary key. |
| `project_name` | `projectName` | Required non-empty unique text used by Project selection. |
| `title` | `title` | Required non-empty audience-facing title. |
| `aspect_ratio` | `aspectRatio` | Required non-empty text; the migration guards the currently nullable source before adding the constraint. |
| `cover_file` | `coverImage` | Nullable text constrained to the accepted conventional value `cover.png`; projected as `{ fileName: "cover.png" }` or `null`. |
| `created_at` / `updated_at` | none | Required internal ISO-8601 timestamps; they are not story metadata or part of this public `Project` response. |

`Project.counts` is calculated by Core and is not stored on this row. The row
also receives these direct story/development columns:

| SQL storage | Public property | Storage type |
| --- | --- | --- |
| `logline` | `logline` | nullable text |
| `synopsis` | `synopsis` | nullable text |
| `premise` | `premise` | nullable text |
| `intended_audience` | `intendedAudience` | nullable text |
| `format` | `format` | nullable text |
| `target_runtime_minutes` | `targetRuntimeMinutes` | nullable non-negative integer |
| `primary_genre` | `primaryGenre` | nullable text |
| `secondary_genres_json` | `secondaryGenres` | nullable validated string-array JSON |
| `tones_json` | `tones` | nullable validated string-array JSON |
| `content_rating_intent` | `contentRatingIntent` | nullable text |
| `creative_boundaries_json` | `creativeBoundaries` | nullable validated string-array JSON |
| `central_conflict` | `centralConflict` | nullable text |
| `dramatic_question` | `dramaticQuestion` | nullable text |
| `themes_json` | `themes` | nullable validated string-array JSON |
| `historical_basis_json` | `historicalBasis` | nullable validated string-array JSON |
| `dramatized_elements_json` | `dramatizedElements` | nullable validated string-array JSON |
| `screenplay_draft_status` | `screenplayDraftStatus` | nullable text |
| `research_sources_json` | `researchSources` | nullable validated string-array JSON |
| `assumptions_json` | `assumptions` | nullable validated string-array JSON |
| `open_questions_json` | `openQuestions` | nullable validated string-array JSON |
| `next_steps_json` | `nextSteps` | nullable validated string-array JSON |

The old duplicate story columns are removed from `screenplay` after conversion.
The vague database column `project.name` is renamed to `project.project_name`
in the same one-way migration as the public `projectName` cutover.

### `screenplay`

This is one enforced singleton row per Project database:

| Column | Definition |
| --- | --- |
| `singleton_id` | Integer primary key constrained to the single value `1`; it is internal storage machinery and never enters the public model. |
| `opening_json` | Non-null JSON array validated by `openingElementSchema`; defaults to `[]`. |

The row contains no title, logline, Project metadata, Cast/Location/Prop facts,
formatting, generic `kind`, or duplicate Scene collection. Scenes, Sections,
structure entries, and references live in their normalized tables.
Project creation and the one-time migration both insert this row, so reads do
not use absence as a second screenplay lifecycle state.

### `scene`

| Column | Definition |
| --- | --- |
| `id` | Text primary key; public `SceneId`. |
| `production_number` | Nullable exact non-empty text; partial unique index when non-null. |
| `heading` | Required non-empty Scene Heading text. |
| `title` | Nullable Renku planning label. |
| `blocks_json` | Non-null array validated by `screenplayBlockSchema`; defaults to `[]`. |

There is no `sequence_id`, `act_id`, local `position`, parsed setting cache, or
production-number reservation relationship. Scene-number list/resolve reads
`production_number` directly from current Scenes, and Scene creation does not
auto-allocate it.

### `screenplay_section`

| Column | Definition |
| --- | --- |
| `id` | Text primary key; public `ScreenplaySectionId`. |
| `section_type` | Required text constrained to `act` or `sequence`. |
| `title` | Required non-empty user-visible label. |
| `description` | Nullable user/agent-authored planning text. |

This table contains no owner foreign keys to Scenes, Assets, designs, or
production records.

### `screenplay_structure_entry`

| Column | Definition |
| --- | --- |
| `id` | Text primary key; public `ScreenplayStructureEntryId`. |
| `parent_section_id` | Nullable foreign key to `screenplay_section.id`; null means root. Deletion is restricted until Core has spliced/reparented children. |
| `content_type` | Required text constrained to `scene` or `section`. |
| `scene_id` | Nullable unique foreign key to `scene.id`. |
| `section_id` | Nullable unique foreign key to `screenplay_section.id`. |
| `position` | Required non-negative integer sibling position. |

A check constraint requires exactly one content foreign key and requires it to
match `content_type`. One partial unique index enforces root positions and
another enforces positions within each non-null parent. Core additionally
enforces exact-once placement, bounded containment, acyclicity, and contiguous
positions before every write.

### `screenplay_reference`

| Column family | Definition |
| --- | --- |
| `id` | Text primary key; public `ScreenplayReferenceId`. |
| `subject_type` | Required text constrained to `castMember`, `location`, or `prop`. |
| `cast_member_id` / `location_id` / `prop_id` | Nullable foreign keys with a check requiring exactly the one subject column matching `subject_type`. |
| `target_type` | Required text constrained to `openingElement`, `scene`, `sceneHeading`, `block`, `dialogueCue`, or `dialoguePart`. |
| `opening_element_id` | Nullable Block ID used only for `openingElement` targets. |
| `scene_id` | Nullable Scene foreign key required by every Scene-owned target. |
| `block_id` | Nullable Block ID required by `block`. |
| `turn_id` | Nullable Dialogue Turn ID required by `dialogueCue` and `dialoguePart`. |
| `part_id` | Nullable Dialogue Part ID required by `dialoguePart`. |
| `role` | Required text constrained to `speaker`, `setting`, `mention`, or `presence`. |
| `range_start` / `range_length` | Nullable integer pair, both required only for `mention`; start is non-negative and length is positive. |

IDs that point inside validated JSON cannot use SQLite foreign keys, so Core
validates their existence and the complete target/role/range matrix atomically.
SQL checks enforce the mutually exclusive column families that SQLite can
express directly.

### `screenplay_revision`

| Column | Definition |
| --- | --- |
| `id` | Text primary key; public `ScreenplayRevisionId`. |
| `screenplay_json` | Required complete snapshot validated by `screenplaySchema`; it contains no Project metadata. |
| `source_command` | Required non-empty identifier of the successful Core authoring/restore command that created the snapshot. |
| `summary` | Nullable concise command-authored change summary. |
| `created_at` | Required ISO-8601 UTC timestamp. |

Create/apply inserts one snapshot of the resulting state inside the same
transaction as the canonical changes. Revision restore validates the selected
snapshot against the current schema and creates a new revision rather than
rewriting history.

### Dependent storage

- `scene_dialogue_audio.dialogue_id` is renamed to `turn_id`, its public
  setup target, audio record, and dialogue-context fields become `turnId`, and
  `audioByDialogueId` becomes `audioByTurnId`. Existing values are preserved as
  `DialogueTurnId` values. Core validates that the turn exists in `scene_id`;
  Dual Dialogue turns are valid owners. Existing take/Asset/File IDs and file
  paths remain unchanged. New destination paths derive from Scene/Turn identity
  and the speaker reference, never from a persisted `dialogueOrderKey`.
- Dialogue-audio creation requires exactly one `speaker` reference for the Turn
  and a selected Cast Voice belonging to that Cast Member. Its persisted
  `cast_member_id` remains the voice-performance owner. Core rejects rebinding
  that Turn to a different speaker while dialogue-audio setup/takes still
  depend on the previous Cast Member; callers must resolve that production
  dependency explicitly rather than silently relabeling existing audio.
- `scene_location`, `act`, `sequence`, and `scene_production_number` disappear
  after successful conversion.
- `AssetOwner` and Asset membership remove Sequence as an owner kind because
  organizational Sections cannot own production files.
- Cast costume variant scope becomes Project-wide or an explicit set of Scene
  IDs; it cannot point at a Section whose deletion must remain free.

All JSON columns use the exact closed JSON Schemas defined above and are
validated before writes and after reads. Structure, JSON-contained IDs, and
foreign-key relationship invariants are validated in Core, not routes, CLI
handlers, React, or Skills.

### One-time migration of `urban-basilica`

Before production implementation or migration begins, the existing Core
migration lifecycle must create its verified `VACUUM INTO` backup and JSON
sidecar under:

```text
.renku/project-database-backups/
```

Implementation does not proceed if the report lacks a backup for the non-empty
database or the backup fails `PRAGMA quick_check`.

The generated Drizzle migration needs a documented custom data-preservation
section because it must transform populated hierarchy and JSON data. It:

1. guards the known source generation and verifies duplicate Project/
   screenplay metadata is either equal or empty on the Project side;
2. copies the populated screenplay metadata into direct Project columns;
3. creates Sections from Acts and Sequences, mapping `purpose` to
   `description`;
4. creates one structure entry per Section and Scene while preserving current
   Act/Sequence/Scene traversal;
5. preserves each current Scene title and constructs its required heading as
   `<interiorExterior>. <ordered location display names joined by ", "> -
   <timeOfDay>` after guarding that every real-sample source component is
   present and non-empty; the old `story_function` column is deliberately not
   copied into the new Scene because dramatic interpretation belongs to
   Screenplay Analysis;
6. preserves each existing `dialogueId` as the ordinary Dialogue's dual-role
   `DialogueBlockId`, maps its optional single `extension` to `[]` or one
   ordered extension value, maps its optional `parenthetical` to the first
   Parenthetical part, then maps every `lines[index]` value to a Speech part in
   order; current parenthetical strings remain semantic text without outer
   parentheses, and the renderer continues to supply them so visible output is
   unchanged; it derives stable IDs for Text/Dual wrappers and Dialogue Parts
   from Scene ID plus old block/part positions and maps snake-case block
   discriminators such as `title_card` and `special_heading` directly to their
   canonical camel-case variants; existing `dialogueOrderKey` values are
   discarded only after all dialogue-audio rows retain the same Turn, Take,
   Asset, and Asset File identities;
7. converts every current Dialogue `castMemberId` into one Cast Member
   `speaker` reference targeting that Dialogue cue; replaces each resolved
   `@handle` token in Text Block or Dialogue Part text with the subject's
   ordinary `name` and creates the exact Cast Member or Location `mention`
   range on that target; validates that the parallel current
   `castMemberIds`/`locationIds` arrays agree with those tokens; and converts a
   valid stored block relationship without literal text into `presence`
   instead of fabricating a range;
8. converts every ordered `scene_location` row into a Location `setting`
   reference on the Scene and a Location `mention` range over that Location's
   synthesized display name in `Scene.heading`, preserving the existing
   clickable/hoverable slugline behavior;
9. converts Beat Sheet block indexes to the migrated stable Block IDs;
10. updates the zero-row screenplay revision table to the new snapshot shape;
11. guards the real project's zero Sequence-owned Assets and zero
    Sequence-scoped costume variants, removes Sequence Asset ownership, and
    converts any Scene-scoped costume variant to the new explicit Scene-ID-set
    shape;
12. copies each current production-number reservation exactly onto its current
    Scene and preserves Scene IDs, audio, Beat Sheet, Shot Plan, Asset, Cast,
    Location, and Prop records; Plan 0169 owns the coordinated conversion of
    every Screenplay Analysis document before the legacy hierarchy disappears;
    and
13. verifies that every old reservation belongs to a current Scene and that the
    copied values are unique, then drops the old number registry and obsolete
    hierarchy columns/tables only after the new rows validate.

The real `urban-basilica` database currently has ten reservations (`1` through
`10`), all attached to current Scenes and none retained for omitted Scenes. The
migration copies those exact strings; it does not rewrite `1` to `01` or create
a hidden canonical/display duality. Plan 0167 may retain the current two-digit
look for plain numeric values as a presentation rule only.

Migration verification compares both backup and migrated database for ordered
Scene IDs, block counts/types, dialogue-turn IDs, production numbers,
department entity counts, Beat evidence meaning, audio ownership, Shot Plan
ownership, and Asset membership.

No runtime old-shape reader, alias, migration-on-read, or legacy diagnostic is
added.

The current sample has no Prop identity embedded in screenplay JSON, so the
migration preserves both Prop fact rows but invents no Prop reference. Prop
references become available immediately through the same canonical command;
the user/agent authors them later when the screenplay evidence supports the
binding.

## Architecture Shape Gate

### Package ownership

- `packages/core` owns Project/Screenplay contracts, closed schemas, semantic
  validation, structure traversal, focused mutations, references, revision
  snapshots, persistence, migration, resources, and structured diagnostics.
- `packages/cli` parses command/file inputs, calls Core, and formats reports.
- `packages/studio/server` exposes thin Hono resources over the Core service.
- `/Users/keremk/Projects/aitinkerbox/studio-skills` teaches the public commands
  and contracts. It cannot compensate for missing Core invariants.
- `packages/engines` has no role in this plan.

### Intended Core client module

```text
packages/core/src/client/
  project/
    index.ts
    model.ts
    schemas.ts

  screenplay/
    index.ts
    model.ts
    blocks.ts
    organization.ts
    references.ts
    operations.ts
    resources.ts
    schemas/
      blocks.ts
      screenplay.ts
      operations.ts
      references.ts

  scene-beats/
    index.ts
    model.ts
    schemas.ts
```

`project/index.ts`, `screenplay/index.ts`, and `scene-beats/index.ts` are
intentional thin module entrypoints containing only public exports. The
package-level `client/index.ts` remains a thin package entrypoint. It must not
contain schemas, validation, conversion, or operations. Plan 0169 separately
owns the `screenplay-analysis/` client module.

The obsolete flat `project.ts`, `screenplay.ts`, `screenplay-json-schemas.ts`,
`screenplay-projection.ts`, and `scene-beat-sheet*.ts` files are deleted after
callers move. Plan 0169 owns deletion of the flat `screenplay-analysis*.ts`
paths. No re-export stubs remain.

### Intended Core server module

```text
packages/core/src/server/
  screenplay/
    index.ts
    commands/
      screenplay.ts
      operations.ts
      opening.ts
      scenes.ts
      sections.ts
      references.ts
      revisions.ts
      scene-numbers.ts
    validation/
      blocks.ts
      structure.ts
      references.ts
    persistence/
      screenplay.ts
      scenes.ts
      sections.ts
      structure.ts
      references.ts
      revisions.ts
    projections/
      screenplay.ts
      structure.ts
      scene.ts
      narrative.ts
    resources/
      structure.ts
      sections.ts
      scenes.ts
      status.ts
    context/
      scene-text.ts
      beat-sheet.ts

  schema/
    screenplay/
      index.ts
      screenplay.ts
      scenes.ts
      sections.ts
      structure.ts
      references.ts
      revisions.ts
```

The module `index.ts` files only compose/export their bounded public surfaces.
Domain branches live with their owner:

- aggregate read/create orchestration in `commands/screenplay.ts` and focused
  opening replacement in `commands/opening.ts`;
- atomic batch dispatch in `commands/operations.ts`, using a closed typed
  operation-handler registry that delegates each discriminator to its owning
  command module before one final-state validation and transaction;
- block variants in `validation/blocks.ts` and client schemas;
- containment/order rules in `validation/structure.ts` and
  `commands/sections.ts`;
- reference target/role/range rules in `validation/references.ts`;
- database row mechanics in the matching persistence file; and
- read projections in focused resource/projection files.

Current broad files expected to disappear include
`commands/apply-screenplay-operations.ts`,
`database/access/screenplay-persistence.ts`, flat screenplay access/resource
files, `screenplay-json/validator.ts`, and the old hierarchy schema files.
Project-data service wiring remains thin and delegates into this module.

### Intended CLI module

```text
packages/cli/src/commands/
  screenplay/
    index.ts
    authoring.ts
    reading.ts
    revisions.ts
    beat-sheets.ts
    scene-numbers.ts
```

`commands/screenplay/index.ts` composes the `renku screenplay` command and
dispatches only to focused subcommand handlers. It contains no JSON validation,
placement, reference, migration, or database logic. The obsolete flat
`screenplay-command.ts` and `screenplay-scene-number-command.ts` paths are
deleted rather than retained as facades. Plan 0169 owns
`commands/screenplay/analysis.ts` and the analyst command cutover.

### Intended Studio server module

```text
packages/studio/server/
  routes/
    screenplay/
      index.ts
      structure.ts
      sections.ts
      scenes.ts
      dialogue-audio.ts
  http/
    screenplay/
      responses.ts
      dialogue-audio.ts
```

`routes/screenplay/index.ts` mounts focused Hono subroutes and contains no
business rules. `routes/screenplay.ts`, `http/screenplay-responses.ts`, and
`http/scene-dialogue-audio-request.ts` disappear.

The accepted resource paths are:

- `GET /screenplay/structure`;
- `GET /screenplay/sections/:sectionId`;
- `GET /screenplay/scenes/:sceneId`;
- existing Scene Beat/Shot/Generation reads addressed by Scene ID;
- dialogue audio under
  `/screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio`.

Plan 0169 owns the existing Story Arc server capability and its route/resource
projection against canonical Scene order.

Act/Sequence ancestry routes are removed. Routes do not calculate structure,
resolve ranges, or infer subject identity.

### Forbidden shapes and stop conditions

Implementation must stop and revise this plan if any of these occurs:

- `Screenplay` again contains Project metadata or embedded Cast/Location/Prop
  facts;
- Scene storage receives another Section owner or writable order;
- a generic JSON patch/write-state operation replaces focused intents;
- a route, CLI handler, React caller, or Skill validates domain containment or
  subject references;
- `@handle` parsing remains a screenplay-linking requirement;
- one persistence file owns parsing, validation, structure, references,
  revisions, and projections;
- a module `index.ts` accumulates implementation;
- old flat paths survive as compatibility re-exports; or
- tests pass only by weakening JSON schemas, allowing extra properties, or
  accepting stale reference ranges.

## Command And Diagnostic Contracts

The canonical data types above are normative. Phase 1 also fixes these command
shapes:

- `createScreenplay({ projectName, screenplay: ScreenplayInput })` only when no
  Scenes, Sections, structure entries, opening elements, or references exist;
- `applyScreenplayOperations({ projectName, operations })` accepts a closed
  union of opening, Scene, Section, and reference operations and records one
  revision snapshot for a successful batch;
- opening operation: `opening.replace`, a full ordered replacement of the
  usually small screenplay-level opening region;
- Scene operations: `scene.add`, `scene.update`, `scene.delete`, `scene.move`;
- Section operations: `section.add`, `section.update`, `section.delete`,
  `section.move`;
- reference operations: `reference.add`, `reference.delete`;
- mutation placement uses optional `parentSection` plus exactly one of `at`,
  `beforeEntry`, or `afterEntry`; callers never submit the old parent or a
  numeric position;
- Project story metadata is updated through the existing Core
  `updateProjectInformation` full-replacement command or
  `patchProjectInformation` partial command, not a screenplay operation;
  absent optional values in the full update clear them, while the patch uses
  explicit `null` to clear one optional value; and
- screenplay revision read/restore returns `Screenplay`, not
  `ScreenplayDocument`.

JSON file envelopes use the command context instead of redundant `kind`
properties:

```ts
type AuthoringKey = string;

type AuthoringIdentity<TId> =
  | { id: TId; key?: never }
  | { id?: never; key: AuthoringKey };

type TextBlockInput = AuthoringIdentity<BlockId> & Omit<TextBlock, "id">;

type DialoguePartInput =
  | (AuthoringIdentity<DialoguePartId> & {
      type: "speech";
      text: string;
    })
  | (AuthoringIdentity<DialoguePartId> & {
      type: "parenthetical";
      text: string;
    });

type DialogueTurnInput = AuthoringIdentity<DialogueTurnId> & {
  characterName: string;
  extensions: string[];
  parts: DialoguePartInput[];
};

type DialogueBlockInput = AuthoringIdentity<DialogueBlockId> & {
  type: "dialogue";
  characterName: string;
  extensions: string[];
  parts: DialoguePartInput[];
};

type DualDialogueBlockInput = AuthoringIdentity<BlockId> & {
  type: "dualDialogue";
  left: DialogueTurnInput;
  right: DialogueTurnInput;
};

type ScreenplayBlockInput =
  | TextBlockInput
  | DialogueBlockInput
  | DualDialogueBlockInput;

type SceneInput = AuthoringIdentity<SceneId> & {
  productionNumber?: string;
  heading: string;
  title?: string;
  blocks: ScreenplayBlockInput[];
};

type ScreenplaySectionInput = AuthoringIdentity<ScreenplaySectionId> & {
  type: "act" | "sequence";
  title: string;
  description?: string;
};

type SceneReference = AuthoringIdentity<SceneId>;
type SectionReference = AuthoringIdentity<ScreenplaySectionId>;
type StructureEntryReference = AuthoringIdentity<ScreenplayStructureEntryId>;
type BlockReference = AuthoringIdentity<BlockId>;
type DialogueTurnReference = AuthoringIdentity<DialogueTurnId>;
type DialoguePartReference = AuthoringIdentity<DialoguePartId>;
type ScreenplayReferenceReference = AuthoringIdentity<ScreenplayReferenceId>;

type ScreenplayStructureEntryInput =
  AuthoringIdentity<ScreenplayStructureEntryId> & {
    parentSection?: SectionReference;
    content:
      | { type: "scene"; scene: SceneReference }
      | { type: "section"; section: SectionReference };
    position: number;
  };

type ScreenplayReferenceTargetInput =
  | { type: "openingElement"; element: BlockReference }
  | { type: "scene"; scene: SceneReference }
  | { type: "sceneHeading"; scene: SceneReference }
  | {
      type: "block";
      scene: SceneReference;
      block: BlockReference;
    }
  | {
      type: "dialogueCue";
      scene: SceneReference;
      turn: DialogueTurnReference;
    }
  | {
      type: "dialoguePart";
      scene: SceneReference;
      turn: DialogueTurnReference;
      part: DialoguePartReference;
    };

type ScreenplayReferenceInput =
  AuthoringIdentity<ScreenplayReferenceId> & {
    subject: ScreenplaySubject;
    target: ScreenplayReferenceTargetInput;
    role: "speaker" | "setting" | "mention" | "presence";
    range?: ScreenplayTextRange;
  };

interface ScreenplayInput {
  opening: TextBlockInput[];
  scenes: SceneInput[];
  sections: ScreenplaySectionInput[];
  structure: ScreenplayStructureEntryInput[];
  references: ScreenplayReferenceInput[];
}

type ScreenplayPlacement =
  | { parentSection?: SectionReference; at: "start" | "end" }
  | {
      parentSection?: SectionReference;
      beforeEntry: StructureEntryReference;
    }
  | {
      parentSection?: SectionReference;
      afterEntry: StructureEntryReference;
    };

type ScreenplayOperation =
  | { operation: "opening.replace"; opening: TextBlockInput[] }
  | {
      operation: "scene.add";
      scene: SceneInput;
      structureEntryKey: AuthoringKey;
      placement: ScreenplayPlacement;
    }
  | { operation: "scene.update"; scene: SceneInput }
  | { operation: "scene.delete"; scene: SceneReference }
  | {
      operation: "scene.move";
      scene: SceneReference;
      placement: ScreenplayPlacement;
    }
  | {
      operation: "section.add";
      section: ScreenplaySectionInput;
      structureEntryKey: AuthoringKey;
      placement: ScreenplayPlacement;
    }
  | { operation: "section.update"; section: ScreenplaySectionInput }
  | { operation: "section.delete"; section: SectionReference }
  | {
      operation: "section.move";
      section: SectionReference;
      placement: ScreenplayPlacement;
    }
  | {
      operation: "reference.add";
      reference: ScreenplayReferenceInput;
    }
  | {
      operation: "reference.delete";
      reference: ScreenplayReferenceReference;
    };

interface ScreenplayOperationsInput {
  operations: ScreenplayOperation[];
}

type GeneratedScreenplayIdentityKind =
  | "scene"
  | "block"
  | "dialogueBlock"
  | "dialogueTurn"
  | "dialoguePart"
  | "section"
  | "structureEntry"
  | "reference";

interface GeneratedScreenplayIdentity {
  kind: GeneratedScreenplayIdentityKind;
  key: AuthoringKey;
  id: string;
}

interface ScreenplayMutationReport {
  valid: true;
  warnings: import("@gorenku/studio-diagnostics").DiagnosticIssue[];
  project: { id: ProjectId; projectName: string };
  screenplayRevisionId: ScreenplayRevisionId;
  generatedIdentities: GeneratedScreenplayIdentity[];
  resourceKeys: string[];
}
```

An `AuthoringIdentity` contains exactly one durable `id` or request-local
`key`. IDs address existing canonical values. A non-empty `key` identifies a
new value within one create document or operation batch, is unique across that
input, may be referenced elsewhere in the same input, and never persists.
Core resolves every key through its ID allocator and returns the generated
mapping. `GeneratedScreenplayIdentity.kind` identifies the canonical namespace;
`dialogueBlock` is the ordinary Dialogue identity that occupies both Block and
Turn namespaces. The report lists generated identities in first key-encounter
order. `resourceKeys` are the existing Core refresh identifiers emitted only
after commit. `valid` is present only on success, `warnings` uses the shared
structured-diagnostics contract, and `project` identifies the selected Project
without returning filesystem paths. Canonical reads contain IDs only.

`ScreenplayStructureEntryInput.position` exists only in the complete-create
document, where all sibling positions are supplied together and must already be
zero-based, contiguous, and unique. Incremental mutations use
`ScreenplayPlacement` instead.

`createScreenplay({ projectName, screenplay: ScreenplayInput })` requires keys
for new values and rejects IDs that already exist. Add operations likewise
require keys for their new top-level object. `structureEntryKey` is the distinct
request-local identity for the placement entry created with that Scene or
Section; a later operation in the same batch may use it as `beforeEntry` or
`afterEntry`. Update, delete, and move operations may address an existing ID or
an earlier key in the same atomic batch. Scene and Section updates are full
replacements of their authored fields; omitting an optional field clears it.
Within a Scene update, existing nested IDs retain identity, keys create new
nested values, and omitted prior nested IDs are deleted subject to final-state
dependency validation.

`opening.replace` follows the same nested identity rules: existing IDs retain
identity, keys create new Opening Elements, and omitted IDs are removed after
final-state reference validation. It does not affect Scene order.

`ScreenplayPlacement` contains exactly one anchor: `at`, `beforeEntry`, or
`afterEntry`. `parentSection` is absent for root placement. When a sibling
entry anchor is used, it must belong to that same parent. Callers never submit
the previous parent or numeric positions for a move. Core resolves the final
structure, references, and generated IDs before one transaction and one
revision snapshot. Both successful create and apply commands return the exact
`ScreenplayMutationReport` above. An operation batch must contain at least one
operation.

The public ID/key authoring envelope is not used to smuggle preselected IDs
through ordinary commands. Revision restore, the one-time migration, and Plan
0168's deterministic importer already own canonical identities for different
reasons. Those Core-owned workflows validate a complete `Screenplay` with the
same canonical validators and call the focused internal Screenplay persistence
module inside their owning transaction. That persistence entrypoint is not
exported to CLI, HTTP, Skills, or browser callers and is not a generic state-
patch API.

Structured diagnostic codes introduced or retained at the boundary are:

- `SCREENPLAY_INVALID_CONTENT`
- `SCREENPLAY_STRUCTURE_INVALID`
- `SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND`
- `SCREENPLAY_SECTION_NOT_FOUND`
- `SCREENPLAY_SECTION_CONTAINMENT_INVALID`
- `SCREENPLAY_REFERENCE_SUBJECT_NOT_FOUND`
- `SCREENPLAY_REFERENCE_TARGET_NOT_FOUND`
- `SCREENPLAY_REFERENCE_RANGE_INVALID`
- `SCREENPLAY_REFERENCE_RANGE_OVERLAP`
- `SCREENPLAY_DIALOGUE_SPEAKER_CONFLICT`
- `SCREENPLAY_NOT_EMPTY`
- `SCREENPLAY_PRODUCTION_NUMBER_CONFLICT`

They describe only the new contract. No code names an obsolete shape in a
runtime diagnostic.

## Implementation Slices

### Slice 0 — Freeze evidence and create the safety gate

- Confirm Plan 0167's current desktop baseline and interaction matrix have been
  captured before changing screenplay contracts.
- Record current `urban-basilica` row counts, ordered Scene IDs, block
  distributions, dialogue IDs, production numbers, Beat evidence, audio, Shot
  Plans, Assets, Cast, Locations, and Props in a migration test fixture/report.
- Run the existing Core project migration backup path as the first stateful
  implementation action, before editing production contracts or applying the
  new migration, and retain its verified SQLite file and JSON sidecar.
- Stop if the backup report is absent for the non-empty database or verification
  fails.

### Slice 1 — Move story metadata to Project

- Add the deliberately named Project fields and update Project Information
  validation, commands, resources, CLI, HTTP responses, and agent context.
- Remove the public metadata type currently called `Screenplay`.
- Resolve `summary -> synopsis`, `premiseOverview -> premise`, genre/tone list
  names, `boundaries -> creativeBoundaries`, `status -> screenplayDraftStatus`,
  `estimatedMinutes -> targetRuntimeMinutes`, `ratingIntent ->
  contentRatingIntent`, and public Project `name -> projectName` directly.
- Replace `targetLengthLabel` with `format`; the one-time sample conversion maps
  “10-minute short film” to `format: "short film"` while preserving the numeric
  runtime separately.
- Split `assumptionsMade` into `assumptions`, `openQuestions`, and `nextSteps`;
  the sample conversion uses its explicit `Open question:` and
  `Next iteration option:` prefixes, while unprefixed entries remain
  assumptions.
- Eliminate the duplicate owner; do not keep mirrors in the screenplay table or
  response.

### Slice 2 — Establish the closed Screenplay model

- Add the client screenplay module and complete JSON Schemas.
- Remove the inherited `storyFunction` field from Scene storage, contracts,
  authoring, projections, Beat context, drafter guidance, samples, and tests;
  Plan 0169 removes it from Screenplay Analysis context and Story Arc fallback
  behavior.
- Add stable Block, Dialogue Turn, and Dialogue Part IDs.
- Validate all persisted block JSON before write and after read.
- Update dialogue audio to use `DialogueTurnId` while preserving current sample
  IDs.
- Update revision snapshots to the new aggregate.

### Slice 3 — Replace hierarchy storage with structure storage

- Add Section and structure tables through the Drizzle TypeScript schema.
- Implement bounded containment, exact-once placement, canonical traversal,
  move, and direct-child-splice deletion in Core.
- Remove Act/Sequence ownership and competing Scene positions.
- Make Scene title and production number optional, widen number values to exact
  non-empty strings stored directly on Scene, and remove the separate Renku
  registry, normalization, reservation, synchronization, and allocation code.
- Migrate each current sample value exactly (`1` remains `"1"`) after asserting
  that all ten existing reservations belong to current Scenes and are unique;
  then drop the registry table.
- Keep Scene-number list/resolve as thin queries over current Scenes so CLI and
  agent callers can address numbered Scenes without turning the number into
  Scene identity or order.

### Slice 4 — Add Project subject references

- Add the reference table, closed target/subject/role contracts, and Core
  validation.
- Support Cast Member, Location, and Prop foreign-key ownership.
- Validate exact ranges and atomic Scene/reference changes.
- Replace embedded IDs, duplicate facts, `scene_location`, and `@handle`
  conventions in the canonical model.

### Slice 5 — Convert dependent Core domains

- Change Beat Sheets from block indexes to Block IDs and add relevant Prop IDs
  to Beat context/contracts.
- Update Scene context text, selection context, counts, coordination, resource
  keys, and all Scene-owned Beat/Shot/Generation/audio reads to consume
  canonical traversal and references. Plan 0169 owns Screenplay Analysis and
  the Story Arc resource.
- Remove Sequence from `AssetOwner` and Asset membership inputs; guard the
  sample's zero Sequence-owned Asset rows before the cutover.
- Replace Cast costume variant `sequence` scope with Project or explicit
  Scene-ID-set scope and migrate existing Scene scope to a one-element set.

### Slice 6 — Cut over Core services, CLI, and Studio HTTP

- Move implementation into the Architecture Shape Gate folders and delete old
  flat files.
- Expose the focused Core commands/resources through the project-data service.
- Split and update the CLI command module.
- Split and update the Hono route/HTTP modules with the new resource paths.
- Update fakes and adapter tests without duplicating Core validation matrices.

### Slice 7 — Generate, apply, and verify the one-time migration

- Generate the migration with Drizzle Kit from the new schema.
- Add only the documented custom data-preservation SQL needed for populated
  hierarchy/JSON conversion.
- Convert `urban-basilica` exactly as specified by this plan's Persistence Model.
- Apply through `renku project migrate urban-basilica` so the backup gate is
  exercised.
- Compare migrated state with the verified backup and run Core validation over
  every screenplay-owned JSON value and relationship.

### Slice 8 — Cut over sister Skills and accepted docs

- Update every exact Skill/reference/sample family listed in the shared design
  context.
- Remove mandatory three-act organization, embedded facts, `@handles`, block
  indexes, and old JSON kind envelopes from current guidance.
- Add Prop-aware reference and Beat/Shot context.
- Keep import-specific instructions for Plan 0168.

## Tests And Guardrails

### Owning Core tests

Cover the full behavior matrix once in Core:

- every block and dialogue-part variant validates and round-trips;
- every canonical field follows its documented meaning, optionality, and
  authorship boundary;
- authoring inputs require exactly one ID/key identity, resolve request-local
  keys across complete create documents and operation batches, return generated
  IDs, and never persist keys;
- full Scene/Section replacement, new nested keys, and all placement anchor
  variants produce the documented final state or fail atomically;
- extra properties and unknown discriminators fail;
- opening elements remain outside Scene order and ownership;
- `opening.replace` preserves retained IDs, resolves new keys, validates
  references against the final opening, and never changes Scene traversal;
- valid flat/mixed structures traverse deterministically;
- duplicate/missing placements, cycles, and invalid nesting fail before writes;
- Section deletion covers empty, direct Scene, direct Sequence, and mixed Act
  children and preserves ordered Scene IDs;
- Scene/Section moves cover root and valid parents without changing identity;
- speaker, setting, mention, and presence references cover all three subject
  kinds and every target kind;
- invalid/missing subject/target, invalid Unicode range, overlap, and stale
  range fail before writes;
- subject dependency deletion remains safe;
- dialogue audio resolves single and dual turns;
- dialogue audio workspace/report fields and persistence use `turnId`, existing
  audio files remain at their current paths, and new destinations require no
  dialogue order key;
- Beat evidence remains stable after unrelated block insertion/movement;
- production-number list/resolve preserve exact custom values, new Scenes may
  remain unnumbered, moves do not alter values, deletion removes the Scene and
  its number, and revision restore restores both;
- revisions restore the new aggregate and Project metadata is unaffected.

### Migration tests

- Execute generated/custom SQL with foreign keys enabled against a populated
  pre-migration fixture.
- Prove metadata, ordered Scenes, every block type, IDs, ranges, Scene numbers,
  Beats, audio, Shot Plans, Assets, Cast, Locations, and Props survive.
- Prove every synthesized Scene Heading exactly preserves the current
  interior/exterior, ordered Location labels, and time of day, with matching
  Location setting and mention references.
- Prove existing numbers migrate exactly (`1` remains `"1"`) and arbitrary
  imported-style values round-trip without normalization.
- Prove known `@handles` become ordinary display text plus exact references.
- Prove Sequence cannot own an Asset or costume scope after migration, and the
  guarded zero-row preconditions hold for the real sample.
- Prove an unresolved handle or conflicting duplicate metadata aborts rather
  than guesses.
- Prove the current schema generation advances and old tables/columns no longer
  exist.
- Prove the verified backup path runs before the real database mutation.

### Adapter tests

- CLI tests cover command/file parsing, Core delegation, JSON/text reports, and
  structured diagnostic formatting.
- Hono tests cover resource paths, response decoration, error translation, and
  removal of ancestry routes.
- Do not repeat the Core invalid-structure/reference matrix in adapters.

### Architecture guardrails

- Import-boundary checks keep browser-safe contracts free of server/database
  imports.
- Schema tests prove stored JSON is AJV-validated on both read and write.
- Existing complexity/static checks are updated so the CLI and route module
  split cannot regress into one broad dispatcher.
- Architecture tests protect folders/import layers and public contract shape,
  not private helper names or command inventories.

## Documentation

Create a new ADR accepting:

- Project-owned story metadata;
- the semantic Screenplay aggregate;
- scene-first canonical order and optional non-owning Sections;
- Cast/Location/Prop screenplay references; and
- app-owned screenplay presentation.

Add concise supersession notices to ADR 0060 and ADR 0070 without rewriting
their historical bodies.

Update current:

- data model/storage and domain vocabulary;
- naming, JSON storage, project resources, and Studio server references;
- screenplay/Beat/Scene-number CLI documentation;
- agent workflow documentation; and
- any current architecture text that says Sequence is mandatory, Props are
  outside screenplay references, or Beat evidence uses array indexes.

Do not edit historical plans for a naming sweep.

## Final Verification

Run focused checks during slices, then before completion:

```bash
pnpm build:core
pnpm --dir packages/core test
pnpm --dir packages/cli test
pnpm --dir packages/studio test
pnpm check
pnpm build
pnpm test
pnpm lint
```

The Studio package may have documented React failures belonging strictly to
Plan 0167, but Core, CLI, and Studio server tests/build boundaries must pass.
If the repository's root build cannot isolate browser compile failures, record
the exact Plan-0167 failures rather than adding compatibility fields.

Also:

- inspect the verified backup and migration sidecar;
- run `PRAGMA quick_check` and foreign-key checks on migrated
  `urban-basilica`;
- compare the migration ledger against the backup;
- exercise CLI read/create/apply/Section/reference/revision/Beat/Scene-number
  journeys against a temporary project and read-only migrated sample;
- inspect `git diff --stat` and the complete diff;
- inspect every newly large or heavily modified file;
- confirm module `index.ts` files are thin;
- confirm old flat files and old paths are deleted rather than re-exported; and
- confirm no business rule moved into CLI, HTTP, React, or Skills.

## Completion Checklist

### Review Area

- [x] Reconcile the implementation with every Phase-1 requirement, the canonical model in this plan, and the cross-phase shared context.
- [x] Confirm centralized Core ownership did not become a monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, generic patch API, or god file was added.

### Project And Screenplay Contracts

- [x] Rename the public Project storage selector to `projectName` and keep `title` as the movie title.
- [x] Move all accepted story/development metadata to direct Project properties.
- [x] Remove the hierarchy-specific `Project.sequences` convenience projection and use the bounded Screenplay structure resource.
- [x] Remove duplicate screenplay metadata columns and public objects.
- [x] Remove `ScreenplayDocument`, nested `screenplay`, and redundant JSON kind envelopes.
- [x] Implement the exact `Screenplay`, Scene, opening, Section, structure, block, dialogue, and reference contracts.
- [x] Implement focused `opening.replace` authoring without treating opening content as a Scene or generic document patch.
- [x] Define and implement every canonical field's meaning, optionality, ownership, and authorship boundary; leave no unexplained interface members.
- [x] Remove `storyFunction` from Scene storage, contracts, authoring, projections, Beat context, drafter guidance, samples, and tests; do not replace it with another Scene planning field.
- [x] Implement the complete authoring identity, input, placement, and operation unions with request-local keys resolved only by Core.
- [x] Store optional exact `Scene.productionNumber` on Scene and keep it independent of structure order.
- [x] Remove the Renku number registry, reservation, normalization, synchronization, and allocation model.
- [x] Keep only thin current-Scene list/resolve queries; do not implement Final Draft renumbering/editor workflows in this phase.
- [x] Close all JSON Schemas and validate persisted JSON before writes and after reads.
- [x] Keep formatting/editor state and ScriptNotes out of canonical contracts.

### Structure And References

- [x] Make Scenes independent of Sections and competing order fields.
- [x] Implement one canonical traversal and update every ordered consumer.
- [x] Implement bounded nesting, exact-once placement, Scene/Section moves, and direct-child-splice deletion.
- [x] Implement Cast/Location/Prop speaker, setting, mention, and presence references.
- [x] Validate reference targets/ranges atomically with content changes.
- [x] Remove embedded facts, `scene_location`, and runtime `@handle` requirements.

### Dependent Domains

- [x] Move dialogue audio to Dialogue Turn IDs, including Dual Dialogue turns.
- [x] Remove `dialogueOrderKey` from screenplay data, preserve existing audio file paths, and derive new destinations from Scene/Turn identity plus speaker references.
- [x] Move Beat evidence to Block IDs and add relevant Props to context.
- [x] Remove Sequence Asset ownership and replace Section-scoped costume variants with explicit Scene-ID sets.
- [x] Update selection, coordination, resource keys, counts, and Scene-owned surfaces; leave Screenplay Analysis and Story Arc work to Plan 0169.
- [x] Update revision snapshots without moving Project metadata into them.

### Core, CLI, And HTTP Shape

- [x] Build the client/server/schema module folders exactly as accepted.
- [x] Split the CLI under `commands/screenplay/` and delete flat predecessor paths.
- [x] Split Studio routes/HTTP under `screenplay/` folders and delete flat predecessor paths.
- [x] Keep all adapters thin and all durable rules in Core.
- [x] Keep every module `index.ts` limited to exports or shallow composition.

### Migration And Data Safety

- [x] Confirm the Plan-0167 UI baseline exists before changing screenplay contracts.
- [x] Capture the complete pre-migration sample ledger.
- [x] Create and verify the Core-generated SQLite backup and sidecar before migration.
- [x] Generate the Drizzle migration from the TypeScript schema.
- [x] Document and test only the custom preservation SQL the populated conversion requires.
- [x] Preserve all named Project, screenplay, production, and Asset data.
- [x] Build each sample Scene Heading from the guarded source setting fields and create exact Location setting/mention references for every displayed Location label.
- [x] Copy all ten sample production numbers exactly onto current Scenes, prove there are no orphaned reservations, and drop the old registry.
- [x] Convert handles to plain text plus references and indexes to IDs without ambiguity.
- [x] Advance schema generation and remove obsolete tables/columns with no runtime compatibility code.
- [x] Run database integrity and migrated-versus-backup comparisons.

### Tests And Guardrails

- [x] Cover the complete block/dialogue union at the owning Core layer.
- [x] Cover structure ordering, movement, deletion, and invalid-state atomicity in Core.
- [x] Cover all subject/reference target/role/range behaviors in Core.
- [x] Cover migration preservation and guarded failure cases.
- [x] Cover CLI and Hono adapter translation without duplicating Core matrices.
- [x] Update stable import-boundary and complexity guardrails without private-name needles.

### Sister Skills And Documentation

- [x] Update every exact Phase-1 sister Skill/reference/sample family listed in the shared design context.
- [x] Remove obsolete hierarchy, metadata, handle, block-index, and kind-envelope guidance.
- [x] Add Prop-aware context and analytical-versus-organizational Act guidance.
- [x] Add the new ADR and concise supersession notices to ADRs 0060 and 0070.
- [x] Update all current architecture, domain, CLI, and workflow documentation.
- [x] Leave historical plans unchanged except these active plans.

### Final Verification

- [x] Run focused Core, CLI, Studio server, migration, Skill, and contract tests.
- [x] Run root build/test/check/lint gates, recording only unavoidable Plan-0167 browser failures.
- [x] Exercise representative CLI workflows against temporary and migrated real projects.
- [x] Review `git diff --stat` and the full diff.
- [x] Inspect newly large/heavily modified files and split them before completion if needed.
- [x] Confirm `index.ts` files remain thin and no old paths survive as facades.
- [x] Confirm no checklist item was satisfied by accepting unreviewable structure.
- [x] Only then mark Plan 0166 complete and unblock Plan 0167.

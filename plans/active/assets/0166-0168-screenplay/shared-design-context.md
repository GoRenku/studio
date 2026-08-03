# Scene-First Screenplay And FDX Import — Shared Design Context

Status: proposed supporting design
Date: 2026-08-03

This document preserves the domain decisions, evidence, and cross-surface
contracts shared by four implementation plans:

- [0166 — Scene-First Screenplay Data Model And Backend](../../0166-scene-first-screenplay-data-model-and-backend.md)
- [0167 — Scene-First Screenplay Studio UI](../../0167-scene-first-screenplay-studio-ui.md)
- [0168 — Deterministic FDX Screenplay Import](../../0168-deterministic-fdx-screenplay-import.md)
- [0169 — Hierarchy-Independent Screenplay Analysis](../../0169-hierarchy-independent-screenplay-analysis.md)

It is not an implementation plan. The numbered plans own delivery, their
phase-specific contracts, sequencing, tests, and completion. Plan 0166 owns the
canonical Project/Screenplay model, while Plan 0169 owns Screenplay Analysis.
This document retains only the cross-phase meaning that must not be compressed
or reinterpreted differently in each phase.

## Product Boundary

Renku Studio is not a general-purpose screenplay editor or a page-layout
application. It stores the semantic screenplay and renders it through
application-owned screenplay conventions. Users do not manually author fonts,
alignment, margins, page breaks, bold, italics, revision colors, or other Final
Draft presentation state.

The Project owns the movie-making workspace:

- Project story metadata such as title, logline, synopsis, genre, themes, and
  development status;
- one Screenplay;
- Cast Members, Locations, and Props with their independently authored facts,
  designs, and media;
- Visual Language, Lookbooks, Scene Beat Sheets, Shot Plans, generations, and
  other production material.

The Screenplay contains screenplay content and optional organization. It
references Project Cast Members, Locations, and Props without embedding or
duplicating their descriptive facts.

The accepted outcome is:

- Scenes are canonical screenplay units.
- Acts and Sequences are optional, non-owning organizational sections.
- A flat ordered Scene list is valid.
- FDX import extracts only semantic content Renku uses.
- The original FDX bytes are retained unchanged and SHA-256 fingerprinted.
- Formatting and proprietary editor state remain only in the retained FDX.
- A deterministic importer creates no Cast Member, Location, or Prop by
  guessing identity.
- An agent and user can subsequently create Project facts and bind screenplay
  references without rewriting screenplay text.

## Requirement Ledger

| Requirement | Accepted behavior | Delivery owner |
| --- | --- | --- |
| One metadata owner | Story and screenplay-development metadata are direct Project properties; the duplicate screenplay metadata object and duplicate database columns disappear. | 0166 |
| Scene primacy | A Scene exists independently of every Act or Sequence and appears exactly once in canonical screenplay order. | 0166 |
| Optional organization | The screenplay may be flat, use Acts without Sequences, use Sequences at root, or mix direct Scenes and Sequences inside Acts. | 0166 |
| Non-owning sections | Sections own no Scenes, Assets, designs, or production records. Deleting a section removes its wrapper and promotes its direct children in place. | 0166 |
| Semantic screenplay | Scene Headings, Action, Dialogue, Parentheticals, Transitions, Shots, Lyrics, Cast Lists, visible Notes, Dual Dialogue, Title Cards, Supers, and Special Headings have explicit contracts. | 0166 |
| App-owned presentation | Canonical screenplay data contains no user-controlled typography, alignment, margins, pagination, or revision presentation. | 0166 and 0167 |
| Opening content | Supported semantic content before the first Scene Heading lives in `Screenplay.opening`, outside every Scene. | 0166 |
| Opening presentation | Studio renders non-empty opening content immediately above the current first Scene, without treating it as Scene content or making it editable. | 0167 |
| Project subject references | Screenplay references Cast Members, Locations, and Props through durable bindings, including exact text ranges and unanchored presence. | 0166 and 0167 |
| Unmodified screenplay text | References never require `@handle` tokens or any other mutation of imported/authored screenplay prose. | 0166 |
| Subject enrichment | Cast/Location/Prop descriptions remain optional Project facts and are authored by the agent and user outside deterministic import. | 0166 and 0168 |
| ScriptNotes boundary | Final Draft ScriptNotes create no canonical data, annotation feature, diagnostic, report item, or user-facing message. They remain only in the retained FDX. | 0168 |
| Exact source retention | The importer copies the exact input bytes to a Project-owned source Asset and records their SHA-256. Runtime screenplay reads never query that file. | 0168 |
| Deterministic import | The same accepted bytes and importer version produce the same semantic mapping and source-derived IDs without AI. | 0168 |
| Explicit sections only | Import creates Acts or Sequences only from supported explicit FDX structural elements; otherwise Scenes remain flat. | 0168 |
| UI continuity | The migrated `urban-basilica` Narrative, dialogue-audio workflow, hover behavior, navigation, Beats, Shot Plans, and Generations remain behaviorally equivalent. | 0167 |
| Scenes navigation root | The sidebar root is called **Scenes** and renders flat Scenes and optional sections. | 0167 |
| No organization UI | This MVP provides no create, rename, move, delete, drag/drop, or section-editing controls in Studio. | 0167 |
| Development migration | The real project database is backed up and verified before a one-time direct cutover. No compatibility paths survive. | 0166 |
| Independent analysis | Three-act analysis derives its own Act segments and optional Scene groups from ordered Scenes; it never treats organizational Sections as analysis ownership. | 0169 |
| Analysis continuity | The current Basilica scores, beats, synopses, critiques, suggestions, active selection, and Story Arc presentation survive the cutover. | 0169 and 0167 |
| Sister-skill cutover | Agent contracts, samples, and workflows use the same Project, Screenplay, block, reference, organization, and analysis models. | 0166, 0168, and 0169 |

## Current Evidence And Defects

### Duplicate and confusing metadata ownership

The public `Project` currently hides title, logline, and summary inside
`Project.identity`. A separate public `Screenplay` type contains another title,
logline, summary, and many story-development fields. `ScreenplayDocument` then
contains a property named `screenplay` of that second type.

The database repeats the problem: `project` stores title, logline, and summary,
while the singleton `screenplay` table stores another copy plus audience,
runtime, genre, tone, premise, conflict, themes, history, status, research, and
assumptions.

The real `urban-basilica` database demonstrates that these are competing
sources, not harmless mirrors: its Project logline is empty while its
screenplay-table logline is populated.

### Mandatory ownership hierarchy

The current schema requires:

```text
Act -> Sequence -> Scene
```

`sequence.act_id` and `scene.sequence_id` are non-null foreign keys, and each
table carries a separate local `position`. This prevents a flat screenplay,
Scenes directly in an Act, root Sequences, and lossless removal of an
organizational wrapper.

### Incomplete screenplay and reference contracts

The current public union claims only `ActionBlock | DialogueBlock` while the
action discriminator also carries Transition, Shot, Note, Title Card, Super,
and other meanings. Dialogue is detailed; sibling semantic types are not.
Blocks other than Dialogue have no durable IDs. Beat Sheets therefore point to
array indexes.

Cast and Location representations are duplicated inside the screenplay JSON.
References are split across embedded ID arrays, a `scene_location` table, and
literal `@handle` tokens in screenplay text. Props are absent from screenplay
references. Studio parses those tokens at render time and supports only Cast
and Location hover previews.

### Real sample migration baseline

Planning-time read-only inspection of
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` found:

- 3 Acts, 5 Sequences, 10 Scenes, 8 Cast Members, 8 Locations, and 2 Props;
- 119 screenplay blocks, including Action, Dialogue, Shot, Transition, Super,
  and Title Card variants;
- 60 dialogue identities, including dialogue with parentheticals;
- Scene Beat Sheets that reference block indexes;
- dialogue audio, Shot Plans, Assets, active analysis, and production Scene
  numbers that must keep their owners and meaning;
- screenplay text containing Cast and Location `@handle` tokens; and
- no Sequence-owned Asset memberships and no Sequence-scoped Cast costume
  variants, allowing those obsolete Section dependencies to be removed under
  an explicit migration guard; and
- no screenplay revision rows, simplifying the one-time revision-schema
  conversion but not removing the accepted revision feature.

## Canonical Backend Contract Ownership

Plan 0166 is the sole normative owner of the backend model. The complete
definitions now live with the phase that implements them:

- [Project, identity, Screenplay, Scene, and every field](../../0166-scene-first-screenplay-data-model-and-backend.md#canonical-data-model)
- [Every screenplay block and dialogue form](../../0166-scene-first-screenplay-data-model-and-backend.md#screenplay-blocks)
- [Opening content](../../0166-scene-first-screenplay-data-model-and-backend.md#opening-content)
- [Cast Member, Location, and Prop references](../../0166-scene-first-screenplay-data-model-and-backend.md#subject-references)
- [Sections and canonical order](../../0166-scene-first-screenplay-data-model-and-backend.md#sections-and-canonical-order)
- [Closed JSON Schemas](../../0166-scene-first-screenplay-data-model-and-backend.md#json-schema-contract)
- [Drizzle persistence and one-time migration](../../0166-scene-first-screenplay-data-model-and-backend.md#persistence-model)
- [Commands and diagnostics](../../0166-scene-first-screenplay-data-model-and-backend.md#command-and-diagnostic-contracts)

This supporting document does not repeat those definitions. It preserves the
cross-phase product boundary, evidence, FDX mapping, UI behavior, sister-skill
workflow, and research basis that Plans 0166–0168 share.

## FDX Semantic Boundary

### What is canonical

The deterministic importer reads the FDX `Content` paragraph stream and maps
the supported semantic subset:

| FDX evidence | Canonical meaning |
| --- | --- |
| Scene Heading paragraph | New Scene and `Scene.heading` |
| Action | `action` |
| Character + Dialogue + Parenthetical run | One `dialogue` turn with ordered parts |
| DualDialogue wrapper | `dualDialogue` with left/right turns |
| Transition | `transition` |
| Shot | `shot` |
| Lyrics | `lyrics` |
| Cast List | `castList` |
| visible Note paragraph | `note` |
| supported Title/Centered/Super semantic element | `titleCard`, `specialHeading`, or `super` only when source evidence is explicit and tested |
| supported content before first Scene Heading | `Screenplay.opening` |
| explicit supported Act/Sequence markers | optional Sections and structure entries |
| scene number | `Scene.productionNumber`, optional and preserved exactly as authored |
| Character cue extension | `DialogueTurn.extensions` |
| Text runs | concatenated plain semantic text; run styling is discarded |

Scene titles, Section descriptions, Cast/Location/Prop descriptions, and
subject identity bindings are never invented by deterministic import.

### What remains only in the source FDX

Recognized but noncanonical Final Draft/editor state is intentionally ignored
without diagnostics or report entries:

- ScriptNotes;
- bold, italic, underline, fonts, sizes, colors, alignment, margins, spacing,
  and pagination;
- revision marks, revision colors, page-locking state, scene colors, and
  omitted-state presentation;
- title-page layout and arbitrary title-page fields not already supplied as
  Project facts;
- user-defined element styles and proprietary workspace/editor settings;
- production breakdown tags as authoritative entity identity; and
- other inert proprietary extensions outside the supported semantic subset.

This is not information loss from the retained source: the exact bytes remain
unchanged in the source Asset, and the hash is calculated over those bytes
before parsing. Canonical runtime behavior deliberately does not depend on
them.

The technical import log is not an inventory of ignored FDX features. It is
limited to semantic extraction events that help diagnose the importer, such as
a General paragraph normalized to Action. Unknown visible content that cannot
be represented is an error and prevents writes; it is not quietly logged and
dropped. No import log is surfaced in normal Studio UI.

### Source retention and future change detection

The source Asset stores the exact `.fdx` bytes under a Project-owned screenplay
source path. `screenplay_import` records its durable identity, exact source
Asset and Asset File identities, importer version, import time, and the closed
technical normalization log. Plan 0168's
[Public Contracts](../../0168-deterministic-fdx-screenplay-import.md#public-contracts)
defines every field and persistence column; this shared context does not create
a second partial contract.

The existing `AssetFile.contentHash` is the one persisted SHA-256 source of
truth; `ScreenplayImport` does not duplicate it. Import/read reports may expose
that joined value as `sha256`. The hash supports future changed-file detection,
but re-import, comparison,
merge, overwrite, and conflict resolution are explicitly outside these plans.
After import, ordinary Screenplay reads use canonical database state only.
The import record prevents discard/deletion/replacement of its exact source
Asset File so provenance cannot be broken accidentally.

Character-cue and Scene-heading candidates are command output derived during
mapping, not additional persisted copies of canonical screenplay text.

## Core Commands And Adapter Boundary

Core exposes focused operations:

- `readScreenplay`
- `createScreenplay` for an empty screenplay
- `applyScreenplayOperations` with the closed operation union
- `readScene`
- `addScene`, `updateScene`, `deleteScene`, `moveScene`
- `addScreenplaySection`, `updateScreenplaySection`,
  `moveScreenplaySection`, `deleteScreenplaySection`
- `addScreenplayReference`, `removeScreenplayReference`
- `readScreenplayStructure`
- existing screenplay revision list/read/restore against the new aggregate
- `importFdxScreenplay` in Plan 0168

The closed operation union contains the same focused intents for atomic agent
batches. It is not an arbitrary state-patch API. Core resolves placement,
validates all targets/ranges/entities, applies transactions, and emits resource
keys. CLI and HTTP only parse, delegate, serialize, and translate diagnostics.

Studio HTTP uses one screenplay resource module with focused internal route
modules. New reads are organized around `/screenplay/structure`,
`/screenplay/sections/:sectionId`, and `/screenplay/scenes/:sceneId`. Old
Act/Sequence ancestry routes are removed directly.

## Studio Behavior Contract

### Sidebar and navigation

- The sidebar group is **Scenes**, not **Acts**.
- Root Scenes, root Sequences, Acts with direct Scenes, and Acts with Sequences
  all render.
- Acts and Sequences share one row geometry, disclosure control, selection
  behavior, hover behavior, count treatment, and keyboard behavior.
- They use distinct meaningful icons while remaining instances of the same
  section component.
- Selecting a section and expanding/collapsing it are separate actions.
- Sections are read-only in this MVP.
- Previous/next navigation follows Core canonical Scene traversal, independent
  of section boundaries.

### Narrative

The current `urban-basilica` Narrative is the visual and interaction baseline.
The new implementation preserves:

- Scene Heading presentation;
- application-owned Action, Transition, Shot, Title Card, Super, Special
  Heading, Note, Cast List, and Lyrics conventions;
- dialogue cards, pointer hover, keyboard focus, action affordances, and audio
  status;
- the dialogue-generation editor's separate editable audio text, live card
  preview, Takes, Advanced options, estimates, generation, and file playback;
- Cast and Location name/image hover behavior, extended to Props;
- Beats, Shot Plans, Generations, Scene design, Story Arc, and previous/next
  navigation; and
- URL-owned selected Scene/section state and resource refresh.

The screenplay itself remains read-only on this surface. Editing audio
generation text does not mutate `DialoguePart` text.

Exact subject-reference ranges drive inline hover links. Studio stops parsing
`@handles`. Presence references enrich Scene/Beat/Shot/agent context but do not
invent highlighted text.

Dual Dialogue renders as two coordinated dialogue columns on desktop because
simultaneity is semantic. It is not reduced to sequential cards. Each turn
retains its own audio action.

Non-empty `Screenplay.opening` renders above the first Scene's heading using
the same app-owned text-block components. It is visually attached to the
beginning of the screenplay but remains outside the Scene data, counts, Beats,
and production actions.

ScriptNotes have no UI.

## Sister Skills Contract

The sister project at `/Users/keremk/Projects/aitinkerbox/studio-skills` is part
of the cutover, not a vague follow-up.

Plan 0166 updates:

- `screenplay-drafter/SKILL.md`;
- all three `screenplay-drafter/references/*` contracts/guides;
- every `screenplay-drafter/samples/urban-basilica/**` JSON sample;
- `screenplay-analyst/SKILL.md`, guidance, contract, workflow, and sample so
  analytical three-act critique does not require stored Act sections;
- `scene-beat-designer/SKILL.md`, contract, workflow, guidelines, and samples
  to use stable Block IDs and include relevant Prop references;
- `shot-planner` workflow/guidance where screenplay context currently assumes
  Cast/Location-only references or block indexes; and
- `movie-director` department map and handoff guidance for the new Screenplay,
  Project metadata, and Prop-aware context.

The screenplay drafter authors plain screenplay text and separate references.
It no longer creates duplicate Cast/Location objects inside screenplay JSON or
inserts `@handles` into prose.

Plan 0168 updates the import/enrichment workflow:

- `screenplay-drafter` invokes the deterministic FDX command and owns
  screenplay binding after Project facts exist;
- `movie-director` routes imported character candidates to Casting Director
  and location/prop candidates to Production Designer;
- `casting-director` creates or updates Cast Member facts, not screenplay
  content;
- `production-designer` creates or updates Location and Prop facts, not
  screenplay content; and
- the screenplay drafter then uses focused reference commands to bind speakers,
  settings, exact mentions, and presence with the user's collaboration.

Agent instructions may use semantic judgment. The importer and Studio runtime
do not.

## FDX Research Basis

The plan is based on official Final Draft behavior plus representative FDX and
open-source importer evidence:

- Final Draft defines a Scene from one Scene Heading to the next:
  <https://kb.finaldraft.com/hc/en-us/articles/27589900322964-How-do-I-select-all-of-the-text-in-a-document-or-a-scene>
- Final Draft's main script elements distinguish Scene Heading, Action,
  Character, Dialogue, Parenthetical, and Transition:
  <https://kb.finaldraft.com/hc/en-us/articles/27646947570196-What-are-script-elements>
- Final Draft Dual Dialogue represents simultaneous side-by-side speech:
  <https://kb.finaldraft.com/hc/en-us/articles/27675427097748-How-do-I-use-dual-dialogue-side-by-side-dialogue>
- Final Draft describes ScriptNotes as non-printing margin comments used for
  revision and feedback:
  <https://www.finaldraft.com/learn/final-draft-quick-start/cloud/using-scriptnotes>
- Final Draft tagging is customizable production breakdown metadata, not an
  authoritative Cast/Location/Prop identity system:
  <https://kb.finaldraft.com/hc/en-us/articles/27791794216340-What-is-tagging>
- Final Draft keyboard documentation confirms additional element categories
  such as General, Shot, Cast List, New Act, End of Act, Summary, Outline,
  Note, and Sequence:
  <https://kb.finaldraft.com/hc/en-us/articles/27977488282644-What-keyboard-shortcuts-can-I-use-in-Final-Draft>
- Final Draft permits numbers-then-letters, letters-then-numbers, manual Scene
  numbers, and nonstandard number text, so imported Scene numbers cannot be
  restricted to Renku's former numeric-suffix grammar:
  <https://kb.finaldraft.com/hc/en-us/articles/27810301418132-How-do-I-number-scenes>
- representative FDX files show content such as `FADE IN:` before the first
  Scene Heading and Text runs split for styling:
  <https://gist.github.com/rnkn/25464556345b4843b3474958b8c2c96a>
- Beat's open-source Final Draft importer provides practical evidence for
  Content, TitlePage, ScriptNotes, TagDefinitions, Text Style, Lyrics, Shot,
  Transition, Outline, and DualDialogue version variability:
  <https://github.com/lmparppei/Beat/tree/master/Frameworks/BeatFileExport>

Final Draft does not publish a complete public schema for every proprietary FDX
extension. Plan 0168 therefore defines and tests a bounded supported subset; it
does not claim universal FDX compatibility.

## Explicit Non-Goals Across All Three Plans

- No Word-like or Final Draft-like page editor.
- No user-defined screenplay typography or layout.
- No FDX export.
- No re-import, change comparison, merge, overwrite, or conflict UI.
- No automatic identity creation or name-based merging of Cast Members,
  Locations, or Props.
- No automatic Act or Sequence inference from screenplay length or analysis.
- No section-organization UI in this MVP.
- No ScriptNote, revision-mark, page-lock, production-tag, or scene-color
  feature.
- No Title Page designer or contact-information model introduced merely
  because FDX can carry one.
- No compatibility DTOs, aliases, old routes, fallback readers, or dual schema.
- No generic folder hierarchy beyond the accepted Act/Sequence containment.
- No production work owned by an organizational section.
- No runtime dependency on the retained FDX source file.

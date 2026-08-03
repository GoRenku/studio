# 0168 Deterministic FDX Screenplay Import

Status: proposed
Date: 2026-08-03

Canonical backend model:
[0166 — Scene-First Screenplay Data Model And Backend](0166-scene-first-screenplay-data-model-and-backend.md#canonical-data-model).

Cross-phase behavior and research context:
[Scene-First Screenplay And FDX Import — Shared Design Context](assets/0166-0168-screenplay/shared-design-context.md).

Hard dependencies: Plans 0166, 0167, and 0169 are complete. The canonical
model, hierarchy-independent Screenplay Analysis, migrated sample, complete
Narrative renderer, and full workspace gates must already be stable before
importer work begins.

## Summary

Add a deterministic CLI/Core import path for the supported main-script subset
of Final Draft XML (`.fdx`).

The command:

- reads and hashes the exact source bytes;
- safely parses XML without AI or external entity resolution;
- maps supported semantic screenplay content into the Plan-0166 model;
- preserves Scene order, Scene Headings, Action, complete Dialogue and
  Parentheticals, cue extensions, Transitions, Shots, Lyrics, Cast Lists,
  visible Notes, Dual Dialogue, Title Cards, Supers, Special Headings, optional
  Scene numbers, opening content, and supported explicit Sections;
- copies the original file unchanged into Project-owned Asset storage;
- stores one import record with SHA-256, importer version, provenance, and a
  developer-only technical log;
- returns semantic candidates for later agent/user reconciliation; and
- writes nothing unless the full canonical aggregate and source Asset can
  commit successfully.

It deliberately does not import Final Draft formatting, ScriptNotes, revision
presentation, page layout, editor state, or arbitrary proprietary extensions.
Those remain in the retained source file and produce no user-facing noise.

## Requirement Ledger

| Requirement | Import behavior | Owner |
| --- | --- | --- |
| Deterministic extraction | Same bytes and importer version produce identical canonical content and source-derived IDs. | Core FDX mapper |
| Semantic fidelity | Every supported visible/structural element maps explicitly; no meaningful visible content is silently dropped. | Core parser/mapper |
| Formatting boundary | Text-run styling, alignment, fonts, margins, pagination, revisions, colors, and editor state are discarded from canonical data. | Core mapper |
| ScriptNotes boundary | ScriptNotes are skipped silently and create no canonical record, diagnostic, log entry, count, or Studio UI. | Core parser |
| Opening boundary | Supported content before the first Scene Heading maps to `Screenplay.opening`, not Scene 1. | Core mapper |
| Optional Sections | Only supported explicit source markers create Act/Sequence Sections; otherwise structure is flat. | Core organization mapper |
| Identity safety | Import creates no Cast Member, Location, or Prop and performs no automatic name match/binding. | Core import command |
| Agent handoff | Character cues, Scene Headings, and useful non-authoritative tag evidence are available as candidates. | Import report/record |
| Exact source | Original bytes are copied unchanged, and SHA-256 is calculated before parsing. | Core Asset/file service |
| Canonical runtime | Screenplay reads never query or parse the retained FDX after import. | Core resources |
| Empty target | Import succeeds only when the Project has no screenplay opening, Scenes, Sections, structure entries, references, or prior import record. | Core import command |
| Atomicity | Parse/map/validate occurs before writes; database and copied-file failures leave neither screenplay nor source Asset residue. | Core command/write set |
| Technical diagnostics | Only semantic extraction normalizations enter the internal log; deliberate exclusions are not enumerated. | Core import record |
| CLI boundary | `renku screenplay import-fdx` is a thin file/flag/report adapter. | CLI screenplay module |
| Comprehensive verification | A fixture matrix covers accepted variants, ignored editor data, unsafe/invalid input, determinism, and failure cleanup. | Core/CLI tests |
| Agent workflow | The agent invokes import, collaborates on Project facts, and binds references through focused commands. | `studio-skills` |

## Product Behavior

### Command

```bash
renku screenplay import-fdx --file /absolute/path/to/script.fdx
renku screenplay import-fdx --file /absolute/path/to/script.fdx --json
```

The active Project comes from the existing project-selection rules. The file
must be a regular readable `.fdx` file. The command has no overwrite, merge,
replace, dry-run-with-different-semantics, or AI flag.

Human output reports only useful successful facts: source filename, SHA-256,
Scene count, Section counts, block/dialogue counts, optional Scene-number count,
and candidate counts. It does not mention ScriptNotes, formatting, ignored
proprietary state, or a list of things Renku chose not to import.

JSON output adds stable IDs and the semantic candidate handoff. It does not
expose the developer technical log as product feedback.

If the screenplay is non-empty, Core returns `SCREENPLAY_NOT_EMPTY` before
copying the file or writing import state. Existing Cast Members, Locations,
Props, Lookbooks, and other Project facts do not make the screenplay non-empty
and are not modified.

If a `screenplay_import` row already exists, Core returns
`SCREENPLAY_FDX_IMPORT_EXISTS` even if later authoring removed every Scene.
This iteration has no command for replacing or deleting provenance to make a
second import possible.

### Semantic paragraph mapping

The supported FDX mapping is normative in the shared design context. The
parser operates
on the ordered Final Draft `Content` stream, not on rendered coordinates.

Important grouping rules:

- a Scene Heading starts a new Scene; the previous Scene ends immediately
  before it;
- supported non-dialogue paragraphs before the first Scene Heading go to
  `Screenplay.opening`;
- Character starts a Dialogue turn and following Parenthetical/Dialogue
  paragraphs become ordered parts until the next non-dialogue element;
- Parentheticals remain in their exact semantic order, including between
  multiple speech parts;
- one conventional pair of outer parentheses is removed from imported
  Parenthetical text because Plan 0166 stores the semantic direction and the
  Renku renderer supplies the screenplay notation; punctuation inside the
  direction is preserved;
- character cue extensions such as `V.O.` and `O.S.` are extracted into
  `extensions` while `characterName` retains the cue name;
- a valid DualDialogue container maps to one wrapper with exactly two turns;
- Text nodes/runs concatenate in source order with XML entities decoded, while
  styling attributes are ignored;
- the Final Draft Scene Number on a Scene Heading maps directly to
  `Scene.productionNumber` and is validated as an exact non-empty string for
  uniqueness; the importer applies no Renku numeric-suffix grammar, case
  normalization, allocation, or renumbering;
- content after the final Scene Heading remains in that final Scene; and
- a screenplay with no Scene Heading is rejected for this main-script subset.

Opening Dialogue, orphan Dialogue/Parenthetical paragraphs, malformed
DualDialogue, duplicate Scene numbers, and unknown visible content that cannot
map safely are errors. The importer does not fabricate a Scene, speaker,
Section, or block type to continue.

Final Draft `General` paragraphs follow the accepted bounded normalization:

- recognized opening transition forms such as `FADE IN:` map to Transition;
- other visible General prose maps to Action with exact plain text preserved;
  and
- the normalization is recorded in the internal technical log.

### Sections

Files without supported explicit Act/Sequence markers import as a flat Scene
structure.

When a tested explicit structural element is present:

- New Act starts a root Act Section;
- Sequence starts a Sequence under the current Act or at root when no Act is
  active;
- End of Act closes the current structural scope; and
- marker text supplies the Section title when present.

Section descriptions remain empty because FDX does not supply Renku's optional
agent/user-authored description. Structural marker text consumed as a Section
is not duplicated into a Scene block. A visually authored Special Heading that
is not an explicit structure element remains a `specialHeading` block and does
not create a Section.

Scene `title` is Renku planning metadata rather than FDX screenplay content.
The deterministic importer leaves it absent; later user/agent collaboration may
author it without changing imported prose.

Because `ScreenplaySection.title` is required, an explicit structural marker
without a non-empty title is rejected. The importer does not fabricate
“Untitled Act,” ordinal names, or other sidebar copy.

Invalid nesting or ambiguous marker order fails through the same Core structure
validator used by all authoring paths.

### Deliberately noncanonical FDX data

These are recognized and skipped silently:

- ScriptNotes;
- Title Page layout and unmapped fields;
- Text-run typography and paragraph formatting;
- pagination, page locking, revision marks/colors, scene colors, and omitted
  presentation;
- arbitrary custom element styles;
- editor/workspace state; and
- inert proprietary extensions outside `Content`.

They do not create warnings or technical-log inventory entries. Their original
bytes remain in the retained FDX and are included in its hash.

Production breakdown tags are not authoritative identity. When a supported tag
has a label/category and an unambiguous content target, the importer may expose
it as candidate evidence for the agent. It never creates or binds a Project
entity from that tag.

Unknown visible elements inside the screenplay `Content` stream are not
treated like inert metadata. They fail with source location and paragraph type
so the importer cannot claim success after dropping screenplay content.

### Candidate and agent workflow

The import result provides evidence, not decisions:

```ts
interface ScreenplayImportCandidates {
  characterCues: Array<{
    characterName: string;
    turnIds: DialogueTurnId[];
  }>;
  sceneHeadings: Array<{
    sceneId: SceneId;
    heading: string;
  }>;
  taggedSubjects: Array<{
    label: string;
    category: string;
    target: ScreenplayReferenceTarget;
  }>;
}
```

After import, the agent:

1. reads the canonical Screenplay plus existing Project Cast/Location/Prop
   facts;
2. asks the user when identity, aliases, composite locations, or Prop status is
   ambiguous;
3. uses Casting Director to create/update Cast facts;
4. uses Production Designer to create/update Location and Prop facts; and
5. uses screenplay reference commands to bind speakers, settings, exact
   mentions, and presence.

The agent may recognize that `YOUNG MARA` and `MARA` are one Cast Member or that
“the bronze mouth” is the Great Bombard Prop. The deterministic importer must
not make those judgments.

### Source retention and hashing

Core reads the source as bytes and calculates lowercase SHA-256 before XML
decoding. The exact file is copied without normalization to:

```text
screenplay/sources/<sha256>.fdx
```

It is registered as a Project-owned Asset:

- Asset type: `screenplay_source`;
- file role: `source`;
- media kind: `document`;
- MIME type: `application/xml`;
- origin: `imported`; and
- content hash: the same SHA-256.

The original basename may be retained as internal Asset title/provenance, but
normal Studio UI does not expose a source-file card in this iteration.

`screenplay_import` stores source Asset/File IDs, importer version 1,
timestamp, and technical log. Candidate cues/headings are returned by the
import command but not persisted as a duplicate of canonical screenplay text.
The existing
`AssetFile.contentHash` is the one persisted SHA-256 source of truth; import
reports join and expose it as `sha256` rather than storing a duplicate hash
column. There is one import row in this MVP
because import requires an empty screenplay. Future re-import can compare the
hash, but no current runtime path implements that behavior.

The import row has durable dependencies on the source Asset and exact source
Asset File. Core rejects discard, deletion, or file replacement while the
import row exists. Otherwise the promised provenance and future hash comparison
could disappear even though the canonical Screenplay remained.

### Atomicity

The command follows this order:

1. resolve and validate the source file;
2. read bytes, enforce size limits, and hash;
3. parse to a bounded FDX syntax representation;
4. map to `Screenplay`, candidates, numbers, and technical log;
5. validate the complete Plan-0166 contract and empty-target precondition;
6. allocate deterministic IDs and the source destination;
7. copy the source through the existing Project Asset file write-set;
8. within one SQLite transaction, insert the Asset/File membership, import
   record, Screenplay, Scenes, Sections, structure, references, and numbers;
9. commit the write-set only after the transaction succeeds; and
10. remove the copied file through write-set rollback if persistence fails.

No partially imported screenplay, orphan file, orphan Asset, or import row is
an accepted result. A manually conflicting destination file fails rather than
being reused by guess.

## Explicit Non-Goals

- No Studio upload or import UI.
- No FDX export.
- No re-import, hash comparison command, diff, merge, overwrite, or conflict
  resolution.
- No import into a non-empty screenplay.
- No AI in parsing, semantic type selection, ID generation, validation, or
  persistence.
- No automatic Cast/Location/Prop creation or name matching.
- No Scene-title or Section-description generation.
- No formatting, ScriptNote, revision, page, scene-color, omission, Title Page,
  or production-tag feature.
- No Final Draft Number/Renumber command, locked-number workflow, or automatic
  A/B insertion policy; import preserves the authored number but does not act
  as a screenplay numbering editor.
- No promise to support every Final Draft version or proprietary extension.
- No fallback that turns unknown visible content into a Note or silently drops
  it.
- No second source of truth read from the retained FDX.
- No general XML import framework or format registry for hypothetical formats.

## Context And Evidence

The external research basis and precise semantic/presentation distinction are
recorded in the shared design context.

Implementation must also inspect and reuse:

- Plan-0166 Screenplay schemas, commands, persistence, structure, references,
  Scene numbers, resources, and diagnostics;
- existing Project-owned Asset membership and Project Asset file write-set;
- existing file destination/path guards and content-hash conventions;
- the Plan-0166 CLI screenplay module;
- the current project-selection and structured JSON report conventions; and
- Plan-0167 fixtures that prove every imported block/reference variant renders.

The Core package currently has no declared XML parser dependency. This plan
adds `saxes` as a direct Core dependency rather than relying on a transitive
lockfile copy. It is used only for bounded non-networked FDX parsing. Its
official documentation confirms strict XML parsing and basic predefined entity
handling; Renku additionally rejects every DOCTYPE/entity declaration before
feeding bytes to the parser: <https://github.com/lddubeau/saxes>.

## Right-Sized Change Decision

### Parse in the CLI

Rejected. It would make the CLI own semantics, prevent reuse by agents/server
workflows, and duplicate validation/persistence rules.

### Add a focused Core FDX importer

Accepted. It reuses the accepted Screenplay, Asset, transaction, diagnostics,
and project-selection owners while isolating format-specific syntax/mapping.

### Build a generic screenplay-format framework

Rejected. No second import format or export requirement exists. The module is
bounded to FDX, and future formats must earn their own design rather than
forcing a speculative registry now.

## Architecture Shape Gate

### Core module layout

```text
packages/core/src/server/screenplay/
  commands/
    fdx-import.ts

  fdx/
    index.ts
    contracts.ts
    limits.ts
    source.ts
    identifiers.ts
    parser/
      document.ts
      content.ts
      dialogue.ts
    mapping/
      screenplay.ts
      blocks.ts
      dialogue.ts
      sections.ts
      candidates.ts
    persistence/
      import-record.ts
      source-asset.ts

packages/core/src/server/schema/screenplay/
  imports.ts
```

- `fdx/index.ts` is the thin internal module entrypoint.
- `commands/fdx-import.ts` owns orchestration and the atomic boundary; it does
  not implement XML events or paragraph mapping.
- `parser/*` converts XML events into a small FDX-specific syntax structure and
  applies resource/security limits. It knows nothing about SQLite or Project
  facts.
- `mapping/*` converts syntax to the canonical Plan-0166 contract. Each
  semantic branch is focused and exhaustively tested.
- `identifiers.ts` is the sole source-derived ID function.
- `source.ts` reads/hashes the file and rejects invalid source envelopes.
- `persistence/*` reuses Asset membership/file write-set and stores the import
  record and its source-Asset deletion dependency; it does not decide
  screenplay semantics.
- `schema/screenplay/imports.ts` owns the import row only.

No parser or mapper enters `client/`; FDX is a server/file-boundary concern.
Public import report types are exported through the Core server entrypoint.

### CLI module layout

```text
packages/cli/src/commands/screenplay/
  index.ts
  fdx-import.ts
```

`fdx-import.ts` reads `--file`, calls `importFdxScreenplay`, and formats human
or JSON output. `screenplay/index.ts` only registers the subcommand. No XML,
hash, mapping, ID, Asset, or identity logic lives in CLI.

### Parser and dispatch shape

The parser uses `saxes` with DTD/entity declarations rejected, no network or
filesystem resolution, and fixed limits for source bytes, XML depth, total
paragraph count, aggregate semantic text, and per-element attributes/text.
Limits live in one `limits.ts` and have boundary tests.

Paragraph and DualDialogue mapping use small typed dispatch tables keyed by
the bounded FDX element names. Unknown inert elements outside `Content` are
skipped. Unknown visible `Content` elements produce a structured error with
source location.

The dispatch tables may select focused mapping functions; they may not become a
single switch that parses XML, maps semantics, allocates IDs, writes Assets,
and formats reports.

### Existing files that remain thin or shrink

- Plan-0166 Core/CLI screenplay `index.ts` files gain only one export/
  registration.
- Asset and project-file services gain a focused `screenplay_source`
  destination/type capability, not FDX parsing branches.
- schema root index imports the bounded screenplay import table.
- no Studio browser or Studio Hono route changes are required.

### Forbidden shapes and stop conditions

Stop and revise if:

- XML parsing or semantic mapping enters CLI, Studio, Skills, or Asset helpers;
- the parser creates Project Cast/Location/Prop rows;
- canonical blocks receive formatting fields to make mapping easier;
- ScriptNotes appear in data, diagnostics, technical log, report, tests of UI,
  or copy;
- unknown visible content is discarded or converted through a catch-all block;
- the retained source is rewritten before hashing/copying;
- the source file becomes a runtime read dependency;
- file and database writes are not rollback-safe;
- `fdx/index.ts`, the command, or a mapping file becomes a monolith; or
- a generic import plugin/registry appears without another accepted format.

## Public Contracts

The importer adds these durable identities and record contracts. `AssetId` and
`AssetFileId` are the existing opaque Asset-domain string identities; they are
shown here so no importer field is left undefined.

```ts
type ScreenplayImportId = string;
type AssetId = string;
type AssetFileId = string;

interface ScreenplayImportLogEntry {
  type: "paragraphNormalization";
  sourceParagraphIndex: number;
  sourceParagraphType: "General";
  targetBlockType: "action" | "transition";
}

interface ScreenplayImport {
  id: ScreenplayImportId;
  sourceAssetId: AssetId;
  sourceAssetFileId: AssetFileId;
  importerVersion: 1;
  importedAt: string;
  technicalLog: ScreenplayImportLogEntry[];
}
```

All three IDs are durable, opaque, non-empty strings. `sourceParagraphIndex`
is the zero-based position in the parsed FDX `Content` paragraph stream.
`importedAt` is an ISO-8601 UTC timestamp generated at commit time. The closed
technical-log entry records only the two accepted `General` paragraph
normalizations; skipped formatting, ScriptNotes, and proprietary editor state
never create entries. Expanding the log requires an explicit schema/importer-
version decision rather than accepting arbitrary messages.

`ScreenplayImport` is the persisted provenance record. It intentionally has no
hash property: its exact Asset File owns `contentHash`, and reports obtain the
hash by joining that file.

The candidate contract defined above has these exact meanings:

- `characterCues` groups each exact imported cue name, after cue extensions are
  separated, with every matching Dialogue Turn ID in screenplay order;
- `sceneHeadings` lists every imported Scene ID and its exact heading in
  screenplay order; and
- `taggedSubjects` carries non-authoritative source label/category evidence and
  an exact canonical screenplay target, without a Project subject ID.

All three candidate arrays are present even when empty. Counts in the report
below are non-negative integers. `sha256` is exactly 64 lowercase hexadecimal
characters, and `resourceKeys` are the existing Core resource identifiers
invalidated by the successful commit.

### Core command

```ts
interface ImportFdxScreenplayInput {
  projectName: string;
  sourcePath: string;
}

interface ImportFdxScreenplayReport {
  valid: true;
  project: { id: ProjectId; projectName: string };
  screenplayImport: {
    id: ScreenplayImportId;
    sourceAssetId: AssetId;
    sourceAssetFileId: AssetFileId;
    sha256: string;
    importerVersion: 1;
    importedAt: string;
  };
  counts: {
    scenes: number;
    acts: number;
    sequences: number;
    blocks: number;
    dialogueTurns: number;
    productionSceneNumbers: number;
  };
  candidates: ScreenplayImportCandidates;
  resourceKeys: string[];
}
```

The internal `technicalLog` is persisted but absent from the normal report.
Deliberate exclusions do not enter it.

Core exports closed `screenplayImportSchema`,
`screenplayImportLogEntrySchema`, `screenplayImportCandidatesSchema`, and
`importFdxScreenplayReportSchema` objects from the server-only importer module.
Every object branch uses `additionalProperties: false`; IDs and source strings
are non-empty; `sourceParagraphIndex` and every count are non-negative
integers; `sha256` matches `^[0-9a-f]{64}$`; `importedAt` uses the repository's
accepted ISO timestamp validation; and the schemas reuse Plan 0166's canonical
ID/target schemas rather than copying them. Persistence validates the record
and technical log before write and after read. CLI serializes Core's validated
report and owns no parallel schema.

### Persistence

The Drizzle schema adds one `screenplay_import` table:

| Column | Definition |
| --- | --- |
| `id` | Text primary key; public `ScreenplayImportId`. |
| `singleton_key` | Internal integer constrained to `1` with a unique index, enforcing at most one import row. |
| `source_asset_id` | Required foreign key to the Project-owned source Asset. |
| `source_asset_file_id` | Required foreign key to the exact retained FDX Asset File and unique in this table. |
| `importer_version` | Required integer constrained to `1`. |
| `imported_at` | Required ISO-8601 UTC timestamp text. |
| `technical_log_json` | Required JSON array validated by the closed `ScreenplayImportLogEntry` schema; defaults to `[]`. |

This MVP permits at most one row because import requires an empty Screenplay.
Core additionally validates that the referenced Asset File belongs to
`source_asset_id`, has the accepted `screenplay_source` membership, and owns
the SHA-256 hash-addressed FDX path. Asset/file deletion and replacement check
this dependency in Core before writing.

### Diagnostics

- `SCREENPLAY_FDX_SOURCE_NOT_FOUND`
- `SCREENPLAY_FDX_SOURCE_NOT_FILE`
- `SCREENPLAY_FDX_SOURCE_TOO_LARGE`
- `SCREENPLAY_FDX_UNSAFE_XML`
- `SCREENPLAY_FDX_INVALID_XML`
- `SCREENPLAY_FDX_INVALID_DOCUMENT`
- `SCREENPLAY_FDX_LIMIT_EXCEEDED`
- `SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT`
- `SCREENPLAY_FDX_INVALID_DIALOGUE`
- `SCREENPLAY_FDX_INVALID_SECTION_STRUCTURE`
- `SCREENPLAY_FDX_DUPLICATE_SCENE_NUMBER`
- `SCREENPLAY_FDX_IMPORT_EXISTS`
- `SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT`
- existing `SCREENPLAY_NOT_EMPTY`

Diagnostics include the source file and XML/paragraph location when available.
They describe the current supported contract, not an obsolete schema.

## Implementation Slices

### Slice 1 — Establish licensed fixtures and parser limits

- Add small handcrafted fixtures for every supported/invalid behavior and
  representative appropriately licensed real-world fixtures.
- Record fixture provenance/licenses.
- Add `saxes` as a direct Core dependency.
- Implement byte/depth/paragraph/text limits and unsafe XML rejection before
  semantic mapping.

### Slice 2 — Parse the bounded FDX syntax

- Parse root/document metadata needed to recognize FDX.
- Parse ordered Content paragraphs, Text runs, Scene properties/numbers,
  DualDialogue containers, explicit structural elements, and supported tag
  evidence.
- Skip deliberate noncanonical regions silently, especially ScriptNotes.
- Preserve source locations for actionable semantic errors.

### Slice 3 — Map every accepted semantic variant

- Map opening, Scenes, structure, every text block, normal Dialogue,
  Parenthetical order, cue extensions, Dual Dialogue, and optional numbers.
- Implement General normalization and unknown-visible-content failure.
- Create no Sections without explicit evidence and no descriptions/titles that
  are not supplied.
- Generate candidates without binding Project identity.

### Slice 4 — Add deterministic IDs and full validation

- Derive import, Asset/File, opening element, Scene, Section, structure entry,
  Block, Dialogue Turn, and Dialogue Part IDs from SHA-256 plus stable semantic
  source paths and importer version.
- Validate the complete canonical aggregate, numbers, candidates, and empty-
  target precondition before any write.
- Prove repeated identical paragraphs remain distinct through source paths.

### Slice 5 — Persist source Asset and import atomically

- Add `screenplay_source` Project Asset capability and hash-addressed
  destination.
- Add `screenplay_import` schema/persistence.
- Compose Asset file write-set with one SQLite transaction and rollback.
- Emit normal Screenplay/Project resource keys only after commit.

### Slice 6 — Add the thin CLI command

- Register `renku screenplay import-fdx` in the screenplay command module.
- Format concise human success and full agent JSON reports.
- Translate structured Core errors with no parser logic or ignored-feature
  commentary.

### Slice 7 — Update the agent enrichment workflow

- Update `screenplay-drafter` Skill, workflow, and guidance for deterministic
  import plus later bindings.
- Update `movie-director` routing, department map, playbooks, and handoff
  checklists.
- Update `casting-director` Cast-authoring guidance for imported cue candidates.
- Update `production-designer` Location/Prop authoring guidance for imported
  heading/tag/text candidates.
- Add evals proving the agent does not ask the importer to create identities,
  does not report ScriptNotes, asks the user about ambiguous identity, and uses
  focused binding commands after facts exist.

### Slice 8 — Run real representative and UI journeys

- Import supported fixtures into temporary Projects and compare deterministic
  database/report results.
- Open representative imported Scenes in Plan-0167 Studio to verify every
  semantic renderer, opening, structure, Props, and Dual Dialogue.
- Do not import over the real migrated `urban-basilica` screenplay; use a
  disposable project/copy for import verification.

## Tests And Guardrails

### Parser and safety matrix

- UTF-8 text, XML entities, Unicode/surrogate pairs, whitespace, empty Text
  runs, and styling-split runs;
- malformed XML, wrong root/document type, missing Content, and no Scene
  Heading;
- DTD, external/internal entity declarations, deep nesting, oversized source,
  excessive paragraphs/text/attributes;
- inert unknown extensions outside Content; and
- unknown visible Content elements with precise failure location.

### Semantic fixture matrix

- flat screenplay and every accepted explicit Section arrangement;
- opening Action/Transition and opening reordering independence;
- every text-block discriminator;
- normal Dialogue, multiple speech parts, multiple/mid-turn Parentheticals,
  cue extensions, and adjacent speakers;
- Dual Dialogue with independent turn IDs;
- scene numbers, missing numbers, duplicate numbers, custom words,
  letters-before-numbers, and mixed forms such as `4aA`;
- Scene `title` remaining absent after import;
- General-to-Transition and General-to-Action normalization;
- Title Page, ScriptNotes, formatting, revisions, page state, and scene color
  having no canonical/report/log effect;
- tag evidence becoming candidates but not Project rows/references;
- orphan Dialogue/Parenthetical, malformed DualDialogue, invalid Sections, and
  visible unsupported content failing before writes.

### Determinism and persistence

- same bytes/version produce byte-equivalent canonical JSON, IDs, counts, and
  candidates apart from `importedAt`;
- different bytes produce a different SHA-256/source path/import identity;
- repeated identical paragraphs receive distinct stable IDs;
- exact source bytes equal the stored Asset file and stored content hash;
- generic Asset discard/delete and file replacement reject the active import
  source dependency;
- runtime Screenplay read succeeds with the source file unavailable in a test
  copy, proving no dependency;
- database failure, file-copy failure, destination conflict, and validation
  failure leave no rows/files;
- non-empty screenplay or existing import record fails before copy/write; and
- Project facts and other production data remain unchanged.

### CLI tests

- file/flag parsing, active Project resolution, human report, JSON report, and
  structured error formatting;
- no ScriptNote/ignored-feature output;
- no parser/mapping behavior duplicated in CLI tests; and
- representative CLI-to-Core import journey.

### Agent evals

- clean import followed by collaborative Cast/Location/Prop creation/binding;
- aliases and ambiguous characters require user confirmation;
- indirect Prop presence is bound without rewriting text;
- existing facts are reused only after agent/user semantic judgment;
- no inferred Section creation when source is flat; and
- no attempt to re-import/overwrite in this iteration.

### Architecture guardrails

- FDX modules remain server-only and cannot be imported by browser-safe Core.
- CLI imports only the public Core server command/report.
- Asset helpers know the destination/type, not XML semantics.
- dispatch/complexity checks protect the focused parser/mapper split without
  freezing private helper names.

## Documentation

Update:

- CLI command reference for `renku screenplay import-fdx`;
- screenplay architecture/import documentation with the semantic support
  table and deliberate exclusions;
- Asset type/path documentation for `screenplay_source`;
- structured diagnostics reference;
- sister-skill workflow and handoff documentation; and
- the new screenplay-model ADR from Plan 0166 with source retention/importer
  consequences if that ADR deliberately spans all three phases.

Document the exact supported FDX subset and fixture provenance. State plainly
that ScriptNotes and formatting remain only in the source and are not reported
as omissions. Do not claim universal Final Draft compatibility.

## Final Verification

Run:

```bash
pnpm --dir packages/core test
pnpm --dir packages/cli test
pnpm build
pnpm test
pnpm lint
pnpm check
```

Then:

- run the deterministic fixture matrix twice and compare results;
- inspect stored source bytes/hash/path;
- run database/file rollback fault tests;
- exercise the CLI against a disposable empty Project;
- inspect imported output through Core read/analysis/Beat context;
- open representative imported Scenes in desktop Studio at the accepted
  viewport;
- run the sister-skill eval matrix;
- inspect `git diff --stat`, the complete diff, and newly large files;
- verify `index.ts` files remain thin and no generic import framework emerged;
  and
- confirm the browser/runtime does not read the retained FDX.

## Completion Checklist

### Review Area

- [ ] Confirm every import requirement and shared semantic boundary is implemented exactly once.
- [ ] Confirm the importer is deterministic and AI-free.
- [ ] Confirm centralized Core ownership did not become a parser/mapper/persistence monolith.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.

### Parser And Semantic Mapping

- [ ] Add licensed/provenanced fixtures for every accepted and invalid case.
- [ ] Declare and use the direct bounded XML parser dependency.
- [ ] Reject unsafe/oversized/malformed XML before writes.
- [ ] Map opening, Scenes, every accepted block/dialogue form, exact `Scene.productionNumber` values, and explicit Sections.
- [ ] Preserve Parenthetical order, cue extensions, and Dual Dialogue turn identity.
- [ ] Normalize General only through the accepted bounded rules.
- [ ] Fail unknown visible content rather than dropping or catch-all mapping it.
- [ ] Skip ScriptNotes and other deliberate exclusions silently with no log/report/UI trace.

### Identity, Candidates, And Source

- [ ] Derive every source-owned ID through the one deterministic identifier function.
- [ ] Return candidate evidence without persisting duplicate screenplay text or creating Cast/Location/Prop rows or bindings.
- [ ] Hash exact original bytes before parsing and copy them unchanged.
- [ ] Keep SHA-256 in `AssetFile.contentHash` as the single persisted hash and expose it through import reports without a duplicate import column.
- [ ] Register the Project-owned `screenplay_source` Asset/File and import record.
- [ ] Protect the exact source Asset/File from discard, deletion, or replacement while the import exists.
- [ ] Keep the technical log internal and limited to semantic extraction events.
- [ ] Prove canonical runtime reads never query the retained FDX.

### Atomic Persistence And CLI

- [ ] Enforce the empty-screenplay and no-existing-import preconditions before file/database writes.
- [ ] Validate the complete canonical aggregate before persistence.
- [ ] Compose the existing Asset file write-set with one SQLite transaction.
- [ ] Roll back copied files and rows for every tested failure point.
- [ ] Add the thin `renku screenplay import-fdx` CLI handler and concise reports.
- [ ] Emit stable structured diagnostics with source locations where available.

### Agent And Sister Skills

- [ ] Update Screenplay Drafter import/binding instructions.
- [ ] Update Movie Director routing and specialist handoffs.
- [ ] Update Casting Director imported-cue fact workflow.
- [ ] Update Production Designer imported Location/Prop fact workflow.
- [ ] Add evals for ambiguity, existing facts, indirect Props, flat scripts, and no re-import.
- [ ] Confirm Skills never teach ScriptNote reporting or importer-owned identity judgment.

### Tests And Guardrails

- [ ] Pass the complete parser/security matrix.
- [ ] Pass the complete semantic fixture matrix.
- [ ] Pass determinism, exact-byte/hash, and repeated-paragraph tests.
- [ ] Pass database/file atomicity and non-empty-target tests.
- [ ] Pass CLI boundary and representative end-to-end tests.
- [ ] Pass server-only import-boundary and focused-module shape guardrails.

### Documentation

- [ ] Document the exact supported FDX semantic subset and deliberate exclusions.
- [ ] Document the CLI command, diagnostics, source Asset/path, and future-hash-only boundary.
- [ ] Record fixture provenance and avoid unsupported compatibility claims.
- [ ] Update current sister-skill workflow documentation.
- [ ] Do not edit historical plans or advertise unimplemented re-import behavior.

### Final Verification

- [ ] Run focused Core/CLI tests and every root gate.
- [ ] Run deterministic imports twice and compare canonical results.
- [ ] Inspect stored source bytes, SHA-256, Asset membership, import row, and rollback cleanup.
- [ ] Complete representative agent enrichment and desktop imported-Screenplay journeys.
- [ ] Review `git diff --stat` and the complete diff.
- [ ] Inspect newly large/heavily modified files and split them before completion when needed.
- [ ] Confirm `index.ts` files remain thin and no generic registry/framework appeared.
- [ ] Confirm no checklist item was satisfied by losing visible screenplay content or surfacing irrelevant FDX details.
- [ ] Only then mark Plan 0168 complete.

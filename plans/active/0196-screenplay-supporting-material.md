# 0196 Screenplay Supporting Material Import

Status: complete
Date: 2026-09-04

## Review Attention

- Add one new durable concept: **Screenplay Supporting Material**, meaning an
  exact imported source file used to enrich the first or a later explicit
  Cast Member, Location, or Prop authoring pass.
- Add one focused Core command and CLI path:
  `renku screenplay supporting-material import --file <absolute-path> --json`.
  Existing generic Asset listing reads the imported files; no parallel list
  service is added.
- Store each accepted file unchanged as a Project-owned
  `screenplay_supporting_material` Asset under `screenplay/`, beside the retained
  screenplay source when one exists. Runtime code validates only the file
  envelope and never parses, extracts, summarizes, or semantically validates its
  contents.
- Supporting material accepts any readable regular file. Core does not restrict
  extensions, MIME types, byte size, or media formats; PDFs, Markdown, DOCX,
  images of text, and unknown future formats all use the same opaque import
  path. Filesystem safety and persisted-byte integrity are the only validation.
- Add the neutral `file` Project media kind for this opaque envelope and record
  `application/octet-stream`; Renku does not pretend an arbitrary source is a
  document, image, audio, or video.
- Hashing for this unlimited-size import must stream bytes rather than loading
  the complete file into memory. Existing bounded FDX parsing remains unchanged.
- Any Renku Project may import supporting material before or after screenplay
  authoring, regardless of whether its Screenplay is empty, Renku-authored, or
  FDX-backed. There is no screenplay-source gate.
- Importing new material does not automatically rewrite existing descriptions.
  A user-directed casting or production-design pass rereads the canonical
  Screenplay, all active supporting material, and the current durable facts,
  then updates those facts through their existing commands.
- Raw supporting files are deliberately absent from Media Producer, character
  sheet, Location/Prop sheet, Scene Beats, Shot Plan, and generation-context
  workflows. Those consumers continue from the durable Cast Member, Location,
  Prop, and department-design descriptions, preventing duplicate context.
- “Story arcs” means the existing Cast Member `arc` field in this iteration.
  Screenplay Analysis does not receive the raw source material and remains a
  later product decision.
- No database migration, Settings change, Studio route/UI, FDX parser change,
  automatic agent dispatch, source-content extraction, file deletion, or
  existing Project data cleanup is planned.

## Summary

Let a user import research, notes, biographies, historical references, and
other source files that support a screenplay. Preserve the exact files in the
Project's `screenplay/` folder and register them through Core so an agent can
discover their safe Project paths without scanning the filesystem. Supporting
material may arrive before the screenplay and remains independent of its source
ownership.

The new importer Skill performs the file handoff only. `screenplay-drafter`
uses these sources for initial screenplay creation or explicit Renku-authored
revision. `casting-director` and `production-designer` consume the canonical
Screenplay and these sources when creating or explicitly revising Cast Member,
Location, and Prop facts. They write the useful result into today's durable
Screenplay, description, arc, and design contracts. Later production Skills
continue to read those durable outputs and do not receive the original source
documents.

## Requirement Ledger

| ID | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Import any readable regular file that supports a screenplay, without a type or size allowlist or screenplay-source gate. | User | Core command, CLI adapter, importer Skill | Core and CLI import tests; Skill eval |
| R2 | Preserve imported material as-is under `screenplay/`, beside the screenplay source when one exists. | User | Core project-file and Asset persistence | Byte/hash/path integration tests |
| R3 | Use imported material to author the actual Screenplay, and use the canonical Screenplay plus imported material to author richer Cast Member, Location, and Prop descriptions and the existing Cast Member `arc`. | User | Screenplay Drafter, Casting Director, and Production Designer Skills | Skill evals and realistic workflow check |
| R4 | Allow an explicit later enrichment pass after more material is imported. | User | Existing fact update commands plus Skill guidance | Update workflow eval |
| R5 | Do not send raw source documents into character sheets, Location/Prop sheets, Scene Beats, Shot Plans, or generation workflows. | User | Skill boundaries | Negative Skill/release-contract checks |
| R6 | Keep FDX authority, parsing, refresh, and read-only behavior unchanged. | Current architecture | Existing FDX module | Regression tests and diff inspection |
| R7 | Keep creative source contents opaque to Studio runtime code. | Hard architecture rule | Core import envelope only | Tests prove no extraction or semantic fields |

## Product Behavior

### Import

The user invokes the new `screenplay-supporting-material-importer` Skill with
one or more local files. For each file, the Skill:

1. resolves the current Project without inspecting screenplay source ownership
   or requiring screenplay content;
2. calls the focused CLI import command with an absolute source path;
3. reads back the returned Asset and exact Project-relative path; and
4. reports imported versus already-present material.

Core accepts any readable regular file. It does not inspect or reject the
extension, MIME type, byte size, content, or actual media format. It hashes the
exact bytes before persistence, copies them with external-file naming into
`screenplay/`, registers a Project-owned opaque-file Asset, and verifies the
persisted hash before committing. A source extension is retained regardless of
whether Renku recognizes it; an extensionless source receives the neutral
`.bin` extension rather than being classified as another media type.

Importing byte-identical material is an `unchanged` no-op that returns the
existing Asset. A different file with the same basename is retained with the
existing collision suffix convention (`-2`, `-3`, and so on). A changed edition
of a source is a new immutable Asset; it does not replace or mutate the earlier
edition.

### Authoring and later enrichment

Before initial Screenplay, Cast Member, Location, or Prop authoring,
`screenplay-drafter`, `casting-director`, and `production-designer` read:

- `renku screenplay show --json` for the complete canonical screenplay;
- the active Project-owned Assets with type
  `screenplay_supporting_material`; and
- each returned exact Project file using whatever document, image, text, or
  other reader the active agent harness supports.

The agents reconcile source evidence with the user's direction, preserve
ambiguity instead of inventing identity, and author the result through the
existing screenplay, cast, location, prop, and department-design commands. Imported
material is evidence, not a runtime invariant and not an automatic mutation.
An FDX-backed Screenplay remains source-authoritative and is not revised from
these files.

After more material is imported, the user may request an explicit enrichment
pass. The same Skills reread the complete source set and current facts, then
author focused updates. Import alone never changes a Cast Member, Location,
Prop, Screenplay, or design document.

### Downstream boundary

The raw sources stop at Screenplay/fact/design authoring. The following remain
unchanged and do not receive `screenplay_supporting_material` Assets:

- `media-producer` and every image/audio/video generation context;
- Character Sheet and Cast Profile workflows;
- Location Sheet/Hero/World and Prop Sheet/Hero workflows;
- Scene Beats and Shot Plans; and
- Lookbook and Storyboard generation.

These workflows use current durable Cast Member, Location, Prop, Cast Design,
Location Design, and Prop Design values as they do today.

## Explicit Non-Goals

- Parsing, classifying, indexing, converting, or previewing source files inside
  Core.
- Persisting extracted text, summaries, embeddings, citations, or per-subject
  links.
- Automatically deciding which passages apply to which Cast Member, Location,
  or Prop.
- Automatically updating facts when a file is imported.
- Adding a source-material viewer, uploader, or management screen to Studio.
- Adding replace, reorder, tag, delete, or archive operations specific to
  supporting material.
- Changing the FDX import report, canonical Screenplay, source-authority gate,
  or refresh algorithm.
- Requiring an FDX import, a Renku-authored Screenplay, or any existing
  screenplay content before supporting-material import.
- Supplying raw material to downstream media generation or production planning.

## Context And Evidence

- `docs/architecture/screenplay-fdx-import.md` keeps the retained FDX exact,
  makes the canonical database projection authoritative for runtime reads, and
  prevents FDX import from creating Cast Members, Locations, or Props.
- `packages/core/src/server/screenplay/fdx/persistence/source-asset.ts` already
  proves the exact-source Asset/File and transactional write-set pattern.
- `packages/core/src/server/project-asset-files/destinations/screenplay-source.ts`
  already owns external basename allocation under `screenplay/`.
- Generic `listAssetPage` and `renku asset list --owner project --type ...`
  already expose Project-owned Asset files; a second list contract would be
  duplication.
- `casting-director` and `production-designer` already own the durable facts and
  designs that downstream workflows consume. Their initial source-driven
  workflows need the complete screenplay; this is especially important for FDX
  imports, which deliberately create no durable subject references.
- `screenplay-drafter` already owns initial and focused Renku-authored
  Screenplay mutations, so source-informed script work belongs in its agent
  workflow rather than a new runtime context contract.
- The Urban Basilica Project currently has no registered Screenplay source or
  supporting-material Asset, so it supplies realistic Cast/Location/Prop data
  for read-only contract inspection without implying an FDX prerequisite.
- Completed Plan 0179 remains the FDX baseline. Plans 0191 and 0195 keep
  generation context and Media Producer configuration separate and are not
  reopened by this work.

### Right-sized choice

1. **Reuse unchanged:** insufficient because Skills must not copy durable files
   directly and generic media import is generation-purpose specific.
2. **Extend existing owners:** accepted. Add one focused screenplay import
   command, reuse generic Asset listing and project-file persistence, and update
   only the authoring Skills that need the source.
3. **Add a research/context subsystem:** rejected. A parsed dossier, searchable
   corpus, per-subject links, embeddings, automatic refresh, or new UI would be
   larger than the requested as-is import workflow.

## Architecture Shape Gate

### Core ownership and module layout

`packages/core/src/server/screenplay/supporting-material/` owns the new
boundary:

- `contracts.ts`: `ImportScreenplaySupportingMaterialInput` and report types;
- `source.ts`: readable regular-file checks and streaming SHA-256 identity
  only;
- `persistence.ts`: exact Project-owned Asset/File creation, deduplication, and
  persisted-hash verification;
- `commands.ts`: Project resolution and transaction/write-set orchestration;
  and
- `index.ts`: thin public exports only.

`packages/core/src/server/screenplay/index.ts` remains the screenplay module
entrypoint and exports the focused command. Project Data Service wiring adds
only `importScreenplaySupportingMaterial`.

The screenplay destination becomes a small domain module at
`packages/core/src/server/project-asset-files/destinations/screenplay.ts`. It
owns the shared `screenplay/` root plus the two semantic destination kinds
`screenplay.source` and `screenplay.supportingMaterial`. The current
`screenplay-source.ts` implementation moves there and its registry caller is
updated directly; no compatibility re-export remains.

### CLI and Skill ownership

`packages/cli/src/commands/screenplay/supporting-material.ts` is a thin adapter
for `renku screenplay supporting-material import`. It resolves the Project,
requires `--file`, calls Core, and formats the typed report. It does not inspect
the source file or construct its destination path.

The sister repository adds:

```text
skills/screenplay-supporting-material-importer/
  SKILL.md
  agents/openai.yaml
  evals/project-supporting-material-import.md
  references/workflow.md
```

`SKILL.md` remains operational; detailed command, authoring handoff, and
downstream-exclusion guidance lives in `references/workflow.md`.

Update the existing `screenplay-drafter`, `movie-director`,
`casting-director`, and `production-designer` instructions and their focused
source-authoring/handoff evals. Screenplay Drafter reads the sources for initial
creation or explicit Renku-authored revision. Do not update Media Producer or
production-planning Skills to read source material.

### Forbidden shapes and stop conditions

Do not:

- add supporting-material fields to every context DTO;
- store source bytes or extracted content in SQLite;
- parse or summarize creative source content in Core, CLI, or Studio;
- let Skills copy directly into `screenplay/` or write Asset rows;
- branch Media Generation Context on the new Asset type;
- couple supporting material to screenplay ownership, one FDX revision, or
  per-subject relations;
- put source safety checks, file persistence, report formatting, and Skill
  workflow logic into one function; or
- turn the screenplay CLI entrypoint into a larger catch-all dispatcher.

Stop and revise the plan if implementation requires a new database table,
Screenplay schema/source-ownership field, Settings policy, Studio route,
raw-material generation context, or automated description rewrite.

## Public Contracts

### Core

```ts
interface ImportScreenplaySupportingMaterialInput
  extends RenkuConfigPathOptions {
  projectName: string;
  sourcePath: string;
}

interface ImportScreenplaySupportingMaterialReport {
  valid: true;
  warnings: [];
  status: 'imported' | 'unchanged';
  project: {
    id: string;
    projectName: string;
    projectFolder: string;
  };
  material: Asset;
  resourceKeys: [];
}
```

The Asset contract is:

- owner: `{ kind: 'project' }`;
- type: `screenplay_supporting_material`;
- media kind: new neutral `file` value, deliberately independent of extension
  or contents;
- origin: `imported`;
- availability: `ready`;
- title: normalized source filename;
- one file with role `source`, exact content hash, recorded size,
  `application/octet-stream` MIME type, and normalized Project-relative path.

`ProjectMediaKind` adds `file` for this opaque source envelope. The value does
not claim that the source is a document, image, audio, or video and does not
control which reader an agent uses.

The async Core hashing path used by this import reads as a stream so accepting
an unrestricted file size does not require buffering the complete file. This is
an operational integrity change, not a content-size policy.

### CLI

```text
renku screenplay supporting-material import \
  --file /absolute/path/to/material.pdf \
  --json

renku asset list \
  --project <project-name> \
  --owner project \
  --type screenplay_supporting_material \
  --json
```

Package-boundary diagnostics:

- `SCREENPLAY_SUPPORTING_MATERIAL_INVALID_SOURCE`; and
- `SCREENPLAY_SUPPORTING_MATERIAL_DESTINATION_CONFLICT`.

## Implementation Slices

### 1. Lock the contract and filesystem destination

Add the Core types, neutral `file` media kind, source envelope, semantic
destination kind, exact storage rules, and streaming async hashing. Move the
existing FDX destination implementation into the shared screenplay destination
module without changing FDX behavior.

### 2. Add the Core import command

Implement Project-scoped byte-identity no-op, Asset/File persistence, write-set
rollback, and the typed report. Reuse current Asset membership, file
persistence, hashing, and external collision allocation. Do not read the
Screenplay or `screenplay_import` row.

### 3. Add the thin CLI adapter

Add the nested screenplay command, help/docs copy, JSON and human reports, and
focused adapter tests. Keep file validation and persistence inside Core.

### 4. Create and connect the importer Skill

Use the repository's Skill Creator workflow to scaffold the Skill, then add its
focused workflow reference and eval. Update Movie Director and Screenplay
Drafter to route supporting-material import to it.

### 5. Enrich only the owning authoring Skills

Update Screenplay Drafter to read active supporting-material Assets before
initial creation or explicit Renku-authored revision. Update Casting Director
and Production Designer to read the complete canonical Screenplay and active
supporting-material Assets before fact creation or explicit refresh work. Teach
them to persist useful results once and to exclude raw documents from downstream
handoffs.

### 6. Align documentation and run realistic verification

Document the exact Asset/storage/CLI/Skill boundary and verify empty,
Renku-authored, and FDX-backed cases in disposable Projects. Use Urban Basilica
only for read-only regression inspection unless the user separately authorizes
importing material into it.

## Tests And Guardrails

### Core owning layer

- Imports exact PDF, Markdown, DOCX, image, unknown-extension, extensionless,
  empty, and large-file bytes through the same opaque Asset envelope.
- Rejects only missing, unreadable, or non-regular sources before any write;
  there is no format, MIME, extension, contents, or byte-size rejection.
- Imports successfully when the Screenplay is empty, Renku-authored, or
  FDX-backed.
- Returns `unchanged` for byte-identical material without new rows or files.
- Allocates a collision suffix for the same basename with different bytes.
- Rolls back rows and copied files when persistence fails.
- Streams large-file hashing without buffering the complete source.
- Detects a missing or hash-mismatched existing deduplication target.
- Leaves the canonical Screenplay, FDX import pointer, and revisions unchanged.

### CLI adapter

- Requires `--file`, delegates the absolute path unchanged, and renders both
  typed statuses.
- Maps Core structured diagnostics without duplicating file rules.
- Existing FDX CLI tests continue to pass unchanged.

### Skill and workflow guardrails

- The importer never copies durable files itself and never authors facts.
- Screenplay Drafter reads materials before initial creation or explicit
  source-driven Renku-authored revision; it does not revise FDX-backed content.
- Casting/Production Design read both canonical Screenplay and materials before
  initial fact creation or an explicit refresh pass.
- Ambiguous identity remains a user question.
- Downstream handoffs contain durable facts/designs, not source file paths or
  copied source text.
- Media Producer, Scene Beats, Shot Planner, and sheet-generation evals do not
  acquire a supporting-material read step.

Architecture tests protect import boundaries and runtime behavior, not private
helper names or a complete function inventory.

## Documentation And ADR Effects

Update:

- `docs/architecture/screenplay-fdx-import.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/cli/commands.md`; and
- the Studio Skills README and relevant Skill references/evals.

A new ADR is not required because the approved behavior remains a focused
extension of exact screenplay source retention, generic Asset ownership, opaque
creative content, and CLI-backed Skills. Add an ADR only if later work expands
the feature into parsed/indexed context, automatic rewrites, Screenplay
Analysis, or broader screenplay ownership.

## Final Verification

Run focused Core and CLI tests, the Studio Skills release-contract/eval tests,
then root `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` in the Studio
repository. Run the sister repository's declared test command without adding
dependencies.

Across disposable empty, Renku-authored, and FDX-backed Projects:

1. import a representative PDF, Markdown file, DOCX, image, unknown extension,
   extensionless file, empty file, and large file without format rejection;
2. reimport one identical file and verify an exact no-op;
3. import changed bytes with the same basename and verify collision-safe
   retention;
4. list the Assets and open every returned Project-relative path;
5. confirm identical import behavior across all three Screenplay states;
6. run one Cast Member and one Location/Prop enrichment workflow;
7. verify the durable descriptions contain the accepted useful facts; and
8. verify a subsequent Media Producer context/report contains the durable facts
   but no supporting-material Asset or raw source text.

Finally inspect both repositories' `git diff --stat` and complete diffs, inspect
new or heavily modified files, confirm the two `index.ts` entrypoints remain
thin, and confirm no broad dispatcher, catch-all context DTO, or semantic
runtime parser was introduced.

## Completion Checklist

### Review Area

- [x] Confirm import works for any Project without reading or restricting
      Screenplay source ownership or content state.
- [x] Confirm no file type, extension, MIME, contents, or byte-size allowlist was
      introduced.
- [x] Confirm story-arc enrichment is limited to `CastMember.arc` and does not
      add raw source material to Screenplay Analysis.
- [x] Confirm raw source files stop after Screenplay/fact/design authoring.
- [x] Confirm no unrequested UI, Settings, parsing, indexing, or automation was
      added.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.

### Architecture And Contracts

- [x] Add the exact Core input/report and Asset envelope.
- [x] Add the neutral `file` media kind and streaming async hash path without
      changing bounded FDX parsing.
- [x] Add the semantic `screenplay.supportingMaterial` destination while keeping
      the shared destination module focused.
- [x] Keep package-boundary failures structured.
- [x] Reuse generic Asset listing rather than adding a parallel list contract.
- [x] Preserve FDX source authority, Renku screenplay authoring, and opaque
      creative-content rules without coupling material to either source mode.

### Core And CLI Implementation

- [x] Implement source envelope validation and exact hashing.
- [x] Implement immutable import, byte deduplication, and collision allocation.
- [x] Keep database/file writes atomic with write-set rollback.
- [x] Wire the focused Project Data Service method.
- [x] Add the thin nested CLI command and help/docs text.

### Skills

- [x] Scaffold and complete `screenplay-supporting-material-importer`.
- [x] Route the intent from Movie Director and Screenplay Drafter.
- [x] Update Screenplay Drafter to read material for initial creation and
      explicit Renku-authored revision.
- [x] Update Casting Director to read Screenplay plus material for fact/design
      creation and explicit refresh.
- [x] Update Production Designer with the same rule for Locations and Props.
- [x] Keep raw material out of every downstream media and planning handoff.
- [x] Add positive and negative workflow evals.

### Tests And Documentation

- [x] Add complete Core owning-layer coverage.
- [x] Add focused CLI delegation/report tests.
- [x] Keep existing FDX regression coverage green.
- [x] Update current architecture, storage, CLI, and Skill docs.
- [x] Run the disposable-project workflow and downstream non-duplication check.

### Final Verification

- [x] Run focused tests and both repositories' declared verification commands.
- [x] Review `git diff --stat` and the complete diffs in both repositories.
- [x] Inspect all new or heavily modified files.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item was satisfied by accepting a god file, broad
      dispatcher, catch-all helper, duplicated context contract, or runtime
      semantic parser.

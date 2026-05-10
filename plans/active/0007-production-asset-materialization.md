# 0007 Production Asset Export

Date: 2026-05-10

Status: draft

## Goal

Export the selected assets needed for final production into a clean, editor-safe
`Production Assets/` tree.

The working project folder remains the place where users and agents iterate. It
contains takes, selects, helper references, character sheets, visual-language
assets, temporary localization work, and other production support material.

The production export folder is different. It contains only the selected assets
that are intentionally needed by the final edit, localization handoff, sound
work, subtitles, graphics, or other downstream production tools such as
DaVinci Resolve.

This plan builds on:

- `0005-project-storage-foundation.md`
- `0006-asset-commands-and-selects.md`

## Motivation

The regular project asset tree is deliberately messy in a useful way.

During production, a clip may have many video takes, several selected reference
images, a selected motion take, helper character sheets, prompt notes, temporary
subtitles, visual-language boards, and generated scratch files. Some of those
selected assets are important inputs for future generation, but they are not
assets an editor should import into the final timeline.

For final production, Renku needs a separate export operation that:

- gathers the selected assets that are actually required for production;
- excludes selected helper assets that should not be handed to an editor;
- mirrors the familiar project hierarchy so folders and filenames remain
  meaningful outside Renku;
- supports master and localized production variants;
- updates the export quickly by copying only changed files;
- removes stale exported files when an asset is deleted, changed back to a take,
  or no longer belongs in production.

## Product Shape

Production export is one job.

Users should not need to run one command per clip, per asset role, or per
locale. Studio should not expose one export button per asset. The desired
product surface is:

- one CLI command for the whole export job;
- one Studio action that starts the same export job;
- one export summary that reports copied, skipped, pruned, and failed files.

The export job may accept filters for advanced or test workflows, but those
filters must not become the primary user path.

## Deliverable

Given a project with registered assets and take/select state, core/CLI can run a
production export job that:

- builds an export plan from SQLite metadata rather than path inference;
- includes only selected assets whose role is production-exportable;
- excludes helper selects such as character sheets, visual-language references,
  prompts, notes, and generation inputs unless their role is explicitly marked
  as production-exportable;
- writes master production assets under `Production Assets/Master/`;
- writes localized production assets under
  `Production Assets/Localized/<locale>/`;
- preserves the project narrative hierarchy for clip-specific assets;
- places reusable production assets under the appropriate `Shared/` folder;
- computes a Merkle-style export tree so unchanged subtrees can be skipped
  quickly;
- copies only new or changed files;
- removes files from the export tree when they are no longer part of the current
  export plan;
- records a manifest for the latest export so repeated exports are fast and
  stale files can be pruned safely.

## References

- `docs/architecture/project-files-and-assets.md`
- `docs/architecture/project-relative-paths.md`
- `docs/architecture/domain-vocabulary.md`
- `docs/architecture/structured-diagnostics.md`

## Terminology

Use **production export** for the user-facing job.

The older term **materialization** is still useful as an implementation detail:
the export job materializes selected production assets into a clean folder tree.
Do not expose per-asset materialization as the main product concept.

## Production Export Rules

Selection alone is not enough.

An asset belongs in the production export only when all of these are true:

1. The asset relationship has `selection = 'select'`.
2. The asset has at least one ready file.
3. The relationship role is production-exportable.
4. The asset's locale context matches the requested export variant.
5. The asset's target can be placed in the production hierarchy.

This distinction matters because selected helper assets are common. Examples:

- selected character sheets may be needed for generation continuity but should
  not be imported into DaVinci;
- selected visual-language boards may guide future clips but are not final
  timeline media;
- selected prompt or Markdown assets may be useful context but not production
  handoff files;
- selected scratch reference images may be important inputs but not final
  graphics.

The first implementation should use an explicit role allowlist in core, not
filename conventions. Example production-exportable roles:

- clip video;
- narration;
- dialogue;
- subtitles;
- word timing;
- music;
- sound effect;
- final graphic;
- title card;
- locale video override;
- locale audio override.

The exact role strings should match the role vocabulary created by the asset
implementation slice. Avoid generic role names such as `file`, `output`, or
`data`.

## Export Variants

The export job supports one master variant and zero or more localized variants.

The default job should export:

- the master production tree;
- every configured locale that has production-exportable selected assets.

CLI and Studio may allow selecting a subset of locales for faster focused work,
but that is a job option, not a different command family.

Rules:

- master assets with no locale context go under `Production Assets/Master/`;
- locale-specific assets go under
  `Production Assets/Localized/<locale>/`;
- localized clip assets mirror the same sequence/scene/clip hierarchy as the
  master assets;
- localized replacements should use recognizable filenames that make their role
  clear when viewed outside Renku.

## Target Folder Shape

Clip-specific master asset:

```text
Production Assets/
  Master/
    Sequences/
      01-logistics/
        Scenes/
          01-foundry-at-night/
            Clips/
              001-cannon-inspection/
                video.mp4
                narration.wav
```

Clip-specific localized asset:

```text
Production Assets/
  Localized/
    tr-TR/
      Sequences/
        01-logistics/
          Scenes/
            01-foundry-at-night/
              Clips/
                001-cannon-inspection/
                  narration.wav
                  subtitles.vtt
                  video-override.mp4
```

Shared assets:

```text
Production Assets/
  Master/
    Shared/
      Music/
      Sound Effects/
      Graphics/
      Audio/

  Localized/
    tr-TR/
      Shared/
        Music/
        Sound Effects/
        Audio/
        Subtitles/
        Graphics/
        Video Overrides/
```

The folder tree is for people and editing tools. SQLite remains the source of
truth for identity, relationships, locale context, and selection state.

## Export Manifest

Each export run should write a machine-readable manifest under the production
tree.

Suggested location:

```text
Production Assets/
  Manifest/
    production-export-manifest.json
```

The manifest should include enough information to make the next export fast and
to prune stale files safely:

```ts
type ProductionExportManifest = {
  schemaVersion: 1;
  projectId: string;
  exportedAt: string;
  variants: ProductionExportVariantManifest[];
};

type ProductionExportVariantManifest = {
  variant: 'master' | 'localized';
  localeId: string | null;
  rootProjectRelativePath: ProjectRelativePath;
  treeHash: string;
  files: ProductionExportFileManifest[];
};

type ProductionExportFileManifest = {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  sourceProjectRelativePath: ProjectRelativePath;
  targetProjectRelativePath: ProjectRelativePath;
  sourceContentHash: string;
  sourceSizeBytes: number;
  sourceModifiedAt: string | null;
  role: string;
};
```

The manifest is an export cache and audit aid, not the source of truth. A
missing manifest is valid for the first export, but a missing, corrupt, or
unsupported manifest must not cause unsafe pruning. In that case, the export job
should either run without pruning and report unmanaged existing files, or fail
with structured diagnostics when the user requested a strict synchronized
export.

## Incremental Export Algorithm

The export job should be a synchronize operation, not a blind copy.

Merkle-style tree hashing is part of the first implementation, not a later
optimization. Large media projects can contain many files, and export should be
fast from the beginning instead of relying on a future performance pass.

High-level algorithm:

1. Read project metadata and selected asset relationships.
2. Build the desired export file set for the requested variants.
3. Validate every source file and target path before writing anything.
4. Load the previous export manifest when one exists.
5. Compute or reuse source file hashes.
6. Build a desired Merkle export tree for each requested variant.
7. Compare the desired tree hashes with the previous manifest's tree hashes.
8. Skip unchanged subtrees without checking every file under them.
9. For changed subtrees, copy only files whose target is missing or whose
   content hash changed.
10. Skip files whose target already has the expected content hash.
11. Prune files that were written by a previous export but are no longer in the
   desired file set.
12. Write the new manifest only after the file operations succeed.

The tree hash model should be explicit:

- each file hash covers file content plus source identity and target path;
- each folder hash covers child hashes;
- each variant hash covers the full desired tree.

That gives the export job a cheap way to skip whole unchanged subtrees without
changing the user-facing behavior.

If the first implementation needs to stay small, it may use a simple in-memory
tree assembled from the desired export file set and persisted in the manifest.
It should not defer tree hashing entirely.

## Hashing Rules

Asset files may already store `contentHash` from registration. The export job
should use that when it is present and still valid.

When a hash is missing, the export job should compute it and persist it through
the asset-file metadata path owned by core.

When a source file's size or modified time differs from the stored metadata, the
export job should recompute the hash before deciding whether to copy.

Hashing should be content-based, not path-based. A renamed source file with the
same bytes may still require a target path update, but it should not force a
large media copy when the target already contains the same bytes.

Merkle node hashes should be deterministic:

- file nodes hash source content hash, source asset identity, target path, role,
  and size;
- folder nodes hash sorted child names and child hashes;
- variant nodes hash the variant identity and root folder hash.

Sorting is required so the same desired export tree produces the same hash
regardless of database query order or filesystem directory order.

## Pruning Rules

The export tree must represent the current export plan, not an accumulation of
past selects.

The export job should remove target files when:

- the source asset was deleted;
- the asset is no longer selected;
- the asset role is no longer production-exportable;
- the asset moved to a different target path;
- the locale is no longer included in the export job;
- the previous selected take was replaced by a new selected take.

Pruning must only remove files that Renku knows it wrote during a previous
export. It should not delete unrelated files a user manually placed under
`Production Assets/`.

To make this safe, pruning should compare against the previous manifest. Files
outside the previous manifest are reported as unmanaged and left alone.

## Path Allocation

Path allocation should reuse the project-relative path helper from plan 0005.

Target paths are based on metadata:

- target kind;
- narrative hierarchy labels and ordering;
- locale context;
- production-exportable role;
- source file extension;
- selected order when multiple selected production assets share the same role.

Do not infer target paths from source folder names.

Do preserve familiar folder labels and meaningful filenames. Editors only see
folders and filenames in tools such as DaVinci Resolve, so generated names must
be readable without the Renku database.

When multiple selected production assets would produce the same target filename,
fail with a structured target path conflict diagnostic unless the role has a
documented naming rule for ordered outputs.

## Core Structure

Add production export modules:

```text
packages/core/src/project/
  production-export-contracts.ts

packages/core/src/node/project/production-export/
  production-export-service.ts
  production-export-planner.ts
  production-export-paths.ts
  production-export-manifest.ts
  production-export-hashing.ts
  production-export-file-sync.ts
  production-export-diagnostics.ts
```

Avoid a generic `export-manager.ts` or broad utility module. Keep the names tied
to the production export domain.

## Core Contracts

Illustrative contracts:

```ts
type ProductionExportVariant =
  | { kind: 'master' }
  | { kind: 'localized'; localeId: string };

type ProductionExportInput = {
  projectName: string;
  variants?: ProductionExportVariant[];
  fresh?: boolean;
  dryRun?: boolean;
};

type ProductionExportSummary = {
  copiedFileCount: number;
  skippedFileCount: number;
  prunedFileCount: number;
  unmanagedFileCount: number;
  variants: ProductionExportVariantSummary[];
};

type ProductionExportVariantSummary = {
  variant: ProductionExportVariant;
  rootProjectRelativePath: ProjectRelativePath;
  treeHash: string;
  copiedFileCount: number;
  skippedFileCount: number;
  prunedFileCount: number;
};
```

Core should expose a single production export operation through
`ProjectDataService`, such as:

```ts
exportProductionAssets(input: ProductionExportInput):
  Promise<ProductionExportSummary>;
```

The exact method name can change during implementation, but it should describe a
whole production export job.

## CLI Shape

Use one command:

```bash
renku production export --project constantinople
```

Useful options:

```bash
renku production export --project constantinople --locale tr-TR
renku production export --project constantinople --all-locales
renku production export --project constantinople --dry-run
renku production export --project constantinople --fresh
renku production export --project constantinople --json
```

Rules:

- no per-asset export command;
- no required per-clip export command for normal use;
- CLI remains a thin adapter over core;
- dry run reports copied/skipped/pruned/unmanaged files without writing.

## Studio UI Shape

Studio should expose production export as one action.

The first UI can be simple:

- one `Export production assets` button;
- optional locale selection in the export dialog or panel;
- progress while the job runs;
- final summary showing copied, skipped, pruned, unmanaged, and failed files.

Feature code in `packages/studio` must use local shadcn-style controls from
`packages/studio/src/ui`. Do not use raw `<button>`, `<input>`, `<select>`,
`<textarea>`, or similar browser controls.

The UI should call the same core-backed server operation as the CLI. It must not
implement separate export planning, hash comparison, pruning, or path allocation
rules in the browser.

## Diagnostics

Use structured diagnostics for:

- no production-exportable selects;
- selected asset file missing;
- selected asset has no ready files;
- selected asset role is not production-exportable;
- localized asset references an unknown locale;
- requested locale does not exist;
- target path conflict;
- invalid project-relative source path;
- invalid project-relative target path;
- previous manifest is missing when pruning would be unsafe;
- previous manifest schema is unsupported;
- target file exists with different content but is not managed by Renku;
- pruning candidate is outside the previous manifest;
- source file changed while export was running.

Diagnostics should explain concrete impact. For example:

> The Turkish narration select for clip `001-cannon-inspection` points to a
> missing source file, so the localized `tr-TR` export would be incomplete.

## Verification

Run focused verification for the touched packages:

- `pnpm test:core`
- `pnpm test:cli`

Tests should prove:

- one export job writes selected master clip video and narration under
  `Production Assets/Master/Sequences/.../Clips/...`;
- one export job writes selected Turkish subtitle and narration under
  `Production Assets/Localized/tr-TR/Sequences/.../Clips/...`;
- selected helper assets such as character sheets and visual-language boards are
  excluded when their roles are not production-exportable;
- localized clip-specific assets do not land in a flat arbitrary language
  bucket;
- shared production assets land under the correct `Shared/` folder;
- unchanged files are skipped on the second export;
- unchanged subtrees are skipped through Merkle tree comparison;
- changed source content is copied on the next export;
- a previous selected take is pruned after it becomes a take again;
- a deleted asset's previously exported file is pruned;
- unmanaged files under `Production Assets/` are reported but not deleted;
- missing selected files fail with structured diagnostics;
- `--dry-run` reports the planned copy/skip/prune operations without writing.

## Non-Goals

- No DaVinci/Final Cut/Premiere/CapCut project file export.
- No timeline assembly.
- No final render pipeline.
- No cloud sync.
- No dependency graph or automatic downstream regeneration.
- No per-asset export buttons.
- No path-based relationship inference.

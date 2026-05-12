# 0006 Asset Commands And Selects

Date: 2026-05-10

Status: ready for implementation

## Goal

Add the first public core and CLI operations for registering project-local files
as assets and marking attached assets as selected.

This plan builds on:

- `0005-project-storage-foundation.md`

## Deliverable

A user or agent can:

- register an existing project-local file as an asset;
- list assets attached to a project, visual language, cast member, sequence,
  scene, or clip;
- mark an attached asset as a select;
- update a selected asset's order;
- change a selected asset back to a take without deleting the asset;
- list selects after closing and reopening the project database.

## References

- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/project-relative-paths.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/drizzle-migrations.md`

## Implementation Decision Summary

This plan closes the open syntax and behavior questions as follows:

- Asset registration is a project mutation owned by `studio-core/node`.
- The CLI namespace is `renku asset`.
- CLI target syntax is `kind:id`, except project-level assets use `project`.
- CLI file input is always a project-relative path through `--file`.
- The registered file must already exist inside the project folder.
- A registered asset is attached to exactly one target in this slice.
- The take/select classification is stored on the matching domain asset
  relationship row.
- Multiple selected assets are allowed for the same target and role by default.
- No role gets a uniqueness policy in this slice.
- Removing a select changes the relationship back to a take. It does not delete
  `asset`, `asset_file`, or the relationship row.
- Production asset materialization remains in `0007-production-asset-materialization.md`.

## Schema Change

First, clean up the asset naming introduced by the storage foundation. These
renames should happen directly in this implementation slice:

```text
asset.asset_type -> asset.type
asset.status -> asset.availability

project_asset.asset_role -> project_asset.role
visual_language_asset.asset_role -> visual_language_asset.role
cast_asset.asset_role -> cast_asset.role
sequence_asset.asset_role -> sequence_asset.role
scene_asset.asset_role -> scene_asset.role
clip_asset.asset_role -> clip_asset.role
```

Then add these take/select fields to every domain asset relationship table:

```text
project_asset
visual_language_asset
cast_asset
sequence_asset
scene_asset
clip_asset

columns:
  selection text not null default 'take'
  selection_order integer nullable
```

Rules:

- `selection = 'take'` means the row is a persisted candidate or option.
- `selection = 'select'` means this attached asset is currently selected for
  that target.
- `selection` may only be `take` or `select`.
- `selection_order` is required when `selection = 'select'`.
- `selection_order` must be null when `selection = 'take'`.

`selection_order` exists only to order multiple selected assets with the same
target, role, and locale. For example, a clip may temporarily carry three
selected narration candidates while the product workflow is still choosing how
to collapse or materialize them later.

Use the Drizzle Kit workflow from `docs/architecture/reference/drizzle-migrations.md`.
Do not hand-write a TypeScript migration registry, and do not copy generated SQL
into TypeScript.

The schema should be represented in Drizzle with camelCase field names:

```ts
type: text('type').notNull(),
availability: text('availability').notNull(),
role: text('role').notNull(),
selection: text('selection').notNull().default('take'),
selectionOrder: integer('selection_order'),
```

SQLite check constraints can be added if the current Drizzle setup supports
them cleanly. If adding those constraints creates migration friction, enforce the
invariant in core command validation for this slice and cover it with tests.

## Core Contracts

Public browser-safe contracts should live under `packages/core/src/project/`.
Node command implementations should live under `packages/core/src/node/project/`.

Use these domain contracts:

```ts
type AssetTarget =
  | { kind: 'project' }
  | { kind: 'visualLanguage'; visualLanguageId: string }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string }
  | { kind: 'clip'; clipId: string };

type AssetLocaleContext = {
  localeId?: string | null;
};

type RegisterAssetInput = {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string | null;
  projectRelativePath: ProjectRelativePath;
  fileRole: string;
  role: string;
};

type AssetReference = {
  assetId: string;
  relationshipId: string;
  target: AssetTarget;
};

type Asset = AssetReference & {
  localeId: string | null;
  type: string;
  selection: Selection;
  availability: Availability;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  role: string;
  sortOrder: number;
  files: AssetFile[];
  createdAt: string;
  updatedAt: string;
};

type Selection =
  | { kind: 'take' }
  | { kind: 'select'; order: number };

type Availability = 'ready';

type AssetFile = {
  id: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: string;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

```

Do not expose Drizzle record types as command or query contracts.

## Core Commands And Queries

Add these methods to `ProjectDataService`:

```ts
registerAsset(input: RegisterAssetInput): Promise<Asset>;

listAssets(input: {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
  includeFiles?: boolean;
}): Promise<Asset[]>;

createAssetSelect(input: {
  projectName: string;
  target: AssetTarget;
  assetId: string;
  selectionOrder?: number;
}): Promise<Asset>;

updateAssetSelect(input: {
  projectName: string;
  target: AssetTarget;
  assetId: string;
  selectionOrder?: number;
}): Promise<Asset>;

removeAssetSelect(input: {
  projectName: string;
  target: AssetTarget;
  assetId: string;
}): Promise<Asset>;

listAssetSelects(input: {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
}): Promise<Asset[]>;
```

The implementation should switch on `target.kind` and use the matching
relationship table:

```text
project -> project_asset
visualLanguage -> visual_language_asset
castMember -> cast_asset
sequence -> sequence_asset
scene -> scene_asset
clip -> clip_asset
```

Those rows are relationship rows, not competing asset stores. The asset itself
is always inserted once into `asset`, its file rows are inserted into
`asset_file`, and exactly one domain relationship row gives that asset its
scope, role, order, locale context, and take/select classification.

Do not add:

- a polymorphic attachment table;
- a separate `asset_select` table;
- a `project_locale_asset` table;
- a generic `source_asset_id`;
- path-based owner, locale, or select inference.

## Selection Versus Availability

`selection` and `asset.availability` answer different questions:

- `selection` is relationship-level take/select classification. It says whether
  this asset is a `take` or a `select` for a specific target.
- `asset.availability` is asset-level readiness. It says whether the asset
  record itself is usable.

For this slice, registered assets are existing files that must already be present
inside the project folder, so the only supported asset availability is:

```text
ready
```

Do not introduce additional asset availability values in this plan. Future
generation work may add availability values such as queued, generating, failed,
or missing if they become part of a defined generation/task lifecycle.

## Register Asset Behavior

`registerAsset` should:

1. Resolve the project folder from `projectName`.
2. Normalize `projectRelativePath` through the existing project-relative path
   helper.
3. Resolve the path against the project folder.
4. Fail if the resolved path is outside the project folder.
5. Fail if the file does not exist.
6. Fail if the target row does not exist.
7. Fail if `locale.localeId` is present and does not reference a project locale.
8. Insert one `asset` row.
9. Insert one `asset_file` row for the provided file.
10. Insert the matching domain asset relationship row.
11. Return the full `Asset` projection.

Initial inserted values:

```text
asset.origin = imported
asset.availability = ready
asset_file.role = input.fileRole
relationship.role = input.role
relationship.sort_order = next order for target + role + locale
relationship.selection = 'take'
relationship.selection_order = null
```

The command registers one existing file. Compound assets and multi-file asset
registration are not part of this slice.

## Select Behavior

`createAssetSelect` should:

- find the relationship row for `target + assetId`;
- fail if the asset is not attached to that target;
- set `selection = 'select'`;
- set `selection_order` to `input.selectionOrder` when provided;
- otherwise set `selection_order` to the next selected order for that target,
  role, and locale;
- update the relationship `updated_at` timestamp;
- return the full `Asset` projection.

`updateAssetSelect` should:

- fail if the asset relationship is not already in `selection = 'select'`;
- update `selection_order`;
- update the relationship `updated_at` timestamp;
- return the full `Asset` projection.

`removeAssetSelect` should:

- fail if the asset is not attached to the target;
- set `selection = 'take'`;
- clear `selection_order`;
- update the relationship `updated_at` timestamp;
- return the full `Asset` projection.

`listAssetSelects` should return only attached assets whose relationship row has
`selection = 'select'`, ordered by:

```text
selection_order asc
relationship.sort_order asc
asset.title asc
```

No select uniqueness constraints are added in this slice. For example, a clip
can have several selected assets with `role = "narration"` until a later
product decision creates a role-specific uniqueness policy.

## CLI Shape

Add this command namespace:

```bash
renku asset <subcommand>
```

Subcommands:

```bash
renku asset register --project <project-name> --target <target> \
  --type <asset-type> --media-kind <media-kind> --role <asset-role> \
  --file-role <file-role> --file <project-relative-path> --title <title> \
  [--summary <one-line-summary>] [--locale <locale-id>] [--json]

renku asset list --project <project-name> --target <target> \
  [--locale <locale-id>] [--json]

renku asset select --project <project-name> --target <target> \
  [--order <number>] <asset-id> [--json]

renku asset select-update --project <project-name> --target <target> \
  --order <number> <asset-id> [--json]

renku asset select-remove --project <project-name> --target <target> \
  <asset-id> [--json]

renku asset selects --project <project-name> --target <target> \
  [--locale <locale-id>] [--json]
```

Target syntax:

```text
project
visual-language:<visual-language-id>
cast:<cast-member-id>
sequence:<sequence-id>
scene:<scene-id>
clip:<clip-id>
```

Examples:

```bash
renku asset register \
  --project constantinople \
  --target clip:clip_001 \
  --type narration \
  --media-kind audio \
  --role narration \
  --file-role primary \
  --file "Working Assets/Base/Sequences/01-logistics/Scenes/01-foundry-at-night/Clips/001-cannon-inspection/Narration/take-1.wav" \
  --title "Narration take 1"

renku asset select \
  --project constantinople \
  --target clip:clip_001 \
  asset_abc123

renku asset selects --project constantinople --target clip:clip_001 --json
```

Human output should be short and actionable:

```text
Registered asset: asset_abc123
Attached to clip: clip_001
File: Working Assets/Base/Sequences/.../take-1.wav
```

JSON output should serialize the returned core projection directly:

```json
{
  "assetId": "asset_abc123",
  "relationshipId": "clip_asset_abc123",
  "target": { "kind": "clip", "clipId": "clip_001" },
  "type": "narration",
  "selection": { "kind": "take" },
  "availability": "ready",
  "mediaKind": "audio",
  "title": "Narration take 1",
  "role": "narration",
  "files": [
    {
      "role": "primary",
      "projectRelativePath": "Working Assets/Base/Sequences/.../take-1.wav",
      "mediaKind": "audio"
    }
  ]
}
```

The CLI is a thin adapter over core. It parses flags and target syntax, calls one
core method, and formats the result. It must not validate target existence,
inspect SQLite directly, infer relationships from paths, or implement select
rules itself.

## Code Structure

Use a focused asset command area:

```text
packages/core/src/project/
  asset-contracts.ts

packages/core/src/node/project/assets/
  asset-service.ts
  asset-commands.ts
  asset-queries.ts
  select-commands.ts
  asset-diagnostics.ts
```

Data-layer files stay under:

```text
packages/core/src/node/project/data/
  asset-records.ts
  asset-file-records.ts
  project-asset-records.ts
  visual-language-asset-records.ts
  cast-asset-records.ts
  narrative-asset-records.ts
```

CLI command file:

```text
packages/cli/src/commands/asset-command.ts
```

Do not make generic modules such as:

- `asset-manager.ts`
- `file-helper.ts`
- `storage-utils.ts`
- `select-helper.ts`

## Diagnostics

Use structured diagnostics for all package-boundary failures. Prefer stable
domain-prefixed codes from the `PROJECT_DATA###` range for core and `CLI###` for
CLI parsing failures.

Required failures:

- invalid asset target syntax;
- unsupported asset target kind;
- missing target ID;
- missing `--project`, `--target`, `--file`, `--type`, `--media-kind`, `--role`,
  `--file-role`, or `--title` where required;
- invalid project-relative path;
- file path resolves outside the project folder;
- missing file;
- target row does not exist;
- locale row does not exist;
- asset row does not exist;
- asset is not attached to the requested target;
- updating a select for an attached asset whose relationship is still a take;
- invalid asset selection;
- invalid select order;
- empty type, media kind, title, file role, or role.

Example core diagnostic:

```text
[PROJECT_DATA080] Asset is not attached to the requested target.
Suggestion: Run `renku asset list --project <project> --target <target> --json`
to see valid asset IDs for this target.
```

## Validation Rules

The first slice uses deliberately small vocabularies but does not freeze final
product taxonomy.

Allowed `mediaKind` values:

```text
markdown
text
image
audio
video
json
folder
other
```

`type`, `role`, and `fileRole` are required non-empty strings. They are not
limited to a hard-coded enum in this slice because active generation work is
still defining model-specific roles.

All role strings should be trimmed before storage. Empty-after-trim is invalid.

## Verification

Run focused checks:

```bash
pnpm test:core
pnpm test:cli
```

Add tests proving:

- registering a valid project-local fixture creates one `asset`, one
  `asset_file`, and one matching domain relationship row;
- registering an outside file fails with a structured diagnostic;
- registering a missing file fails with a structured diagnostic;
- registering against a missing target fails with a structured diagnostic;
- selecting an asset updates the matching domain asset relationship row;
- selecting an asset attached to a different target fails;
- updating a select changes `selection_order`;
- removing a select changes `selection` back to `take` without deleting the
  asset;
- list commands return JSON;
- `selection` and `selection_order` survive closing and reopening the project
  database.

If schema files change, also run:

```bash
pnpm build:core
```

## Non-Goals

- No production materialization.
- No generated-take workflow.
- No multi-file or compound asset registration.
- No sample project fixture builder.
- No Studio UI editing.
- No external file linking outside the project.
- No select uniqueness policy.
- No asset deletion command.
- No file move or rename command.

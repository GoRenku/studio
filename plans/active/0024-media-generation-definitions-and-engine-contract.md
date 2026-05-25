# 0024 Media Purpose Context, Generation, And Import

Date: 2026-05-25

Status: review draft

## Goal

Design the first coherent architecture for generating and attaching media
in Renku Studio.

The first implementation target is **Lookbook Image**. The plan also sketches
Cast Portrait, Cast Character Sheet, and Scene Narration Audio so the shared
shape does not overfit Lookbook.

This plan makes three hard separations:

1. **Context**: Renku gathers domain-specific context for the agent.
2. **Generation**: Renku executes model calls through `packages/engines`.
3. **Import**: Renku attaches an existing media file to a domain object.

Import does not care whether the file came from Renku generation, manual upload,
or a download. If a Renku generation receipt is provided, import can record
verified generated provenance. Without a receipt, the file is still valid
imported media.

## Required Direction

- Do not add `renku lookbook image generate`.
- Do not add `renku generation attach`.
- Do not create one skill per media purpose.
- Do not preserve the old Lookbook image command once the new import command is
  implemented.
- Do not plan transitional coexistence. This is pre-customer software; update
  callers directly and remove the old path in the same implementation slice.

## Public Names

These names are part of the proposed interface and should be reviewed before
implementation.

| Name | Meaning |
| --- | --- |
| Media Purpose Key | Stable key for what a media file is for inside the project, such as `lookbook.image` or `cast.portrait`. It is not tied to whether the media was generated. |
| Media Purpose Context | Core-built JSON package that gives the agent enough project context for one media purpose and target. |
| Generation Policy | Binding user-selected provider, model, and locked model parameters. |
| Generation Request | Agent-authored executable model call using model-native payload fields. |
| Generation Estimate | Dry-run validation and cost estimate for one request under one policy. |
| Generation Receipt | Renku-written JSON receipt for one generation run and its staged outputs. |
| Media Import | Core-owned operation that copies/registers a file and attaches it to a media purpose target. |

## References Reviewed

- `plans/active/0023-visual-language-lookbook-cli-and-skill.md`
- `plans/active/0006-asset-commands-and-selects.md`
- `plans/active/0020-visual-language-inspiration-lookbook-data-model.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `packages/cli/src/commands/lookbook-command.ts`
- `packages/cli/src/commands/asset-command.ts`
- `packages/core/src/server/commands/lookbook-commands.ts`
- `packages/core/src/server/commands/register-asset.ts`
- `packages/core/src/server/database/access/asset-relationships/`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/lookbook-designer/SKILL.md`

## Implemented Replacement

Lookbook image import now uses the generic media import path:

```bash
renku media import --purpose lookbook.image --target lookbook:<lookbook-id> --source <project-relative-path> --sections <sections> --json
renku lookbook image set-sections --image <lookbook-image-id> --sections <sections> --json
renku lookbook image delete --image <lookbook-image-id> --json
renku lookbook card-image set --lookbook <lookbook-id> --image <lookbook-image-id> --json
renku lookbook card-image clear --lookbook <lookbook-id> --json
```

The implementation keeps the proven Lookbook attachment model:

- source image is copied into `visual-language/lookbook/`;
- an `asset` row is created;
- an `asset_file` row is created;
- a `lookbook_image` row is created;
- `lookbook_image_section` rows place the image in Lookbook sections.

`lookbook image set-sections`, `lookbook image delete`, and card image commands
can remain Lookbook-specific domain editing commands because they edit existing
Lookbook image relationships. They are not generation commands.

## Command Surface

### Generation Commands

Generation commands create staged outputs only. They do not attach files to
Lookbook, cast, scene, or any other domain object.

```bash
renku generation context --purpose <media-purpose-key> --target <target> --json
renku generation model list --media-kind <image|audio|video|text|json> --json
renku generation model show --provider <provider> --model <model> --json
renku generation policy validate --file <policy-json> --json
renku generation estimate --policy <policy-json> --request <request-json> --json
renku generation run --policy <policy-json> --request <request-json> --approval-token <token> --json
renku generation run --policy <policy-json> --request <request-json> --simulate --json
```

`generation context` calls core. It does not call a provider.

`generation model`, `generation policy`, `generation estimate`, and
`generation run` call engines.

### Media Import Command

Media import attaches an existing file to a media purpose target.

```bash
renku media import \
  --purpose <media-purpose-key> \
  --target <target> \
  --source <absolute-or-project-relative-path> \
  --title <title> \
  --json
```

Optional shared flags:

```text
--summary <one-line-summary>
--receipt <generation-receipt-json>
--locale <project-locale-id>
```

Optional domain-specific flags are accepted by the shared parser and validated
by the media purpose handler:

```text
--sections <comma-separated-lookbook-section-keys>
--role <asset-relationship-role>
```

The parser should not try to understand every domain meaning. It should collect
known shared flags and a small map of purpose options, then the
`MediaPurposeKey` handler validates what applies.

### Lookbook Image Example

Context:

```bash
renku generation context \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --sections palette,lighting \
  --json
```

Generate staged file:

```bash
renku generation estimate \
  --policy policy.json \
  --request request.json \
  --json

renku generation run \
  --policy policy.json \
  --request request.json \
  --approval-token <token> \
  --json
```

Import generated or uploaded image:

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source .renku/tmp/generations/<run-id>/outputs/horror-palette.png \
  --sections palette,lighting \
  --title "Horror Palette Hallway" \
  --receipt .renku/tmp/generations/<run-id>/receipt.json \
  --json
```

Import a manually downloaded image:

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source ~/Downloads/horror-palette.png \
  --sections palette,lighting \
  --title "Horror Palette Hallway" \
  --json
```

The same import command works in both cases. The receipt only changes
provenance.

## Package Structure

### Core Browser Contracts

Add:

```text
packages/core/src/client/media-purpose.ts
packages/core/src/client/generation.ts
```

`media-purpose.ts` exports JSON-safe media purpose contracts:

```ts
export type MediaPurposeKey =
  | 'lookbook.image'
  | 'cast.portrait'
  | 'cast.character-sheet'
  | 'scene.narration-audio';

export type MediaPurposeTarget =
  | { kind: 'lookbook'; lookbookId: string }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'scene'; sceneId: string };

export interface MediaPurposeContextRequest {
  projectName: string;
  purpose: MediaPurposeKey;
  target: MediaPurposeTarget;
  options?: Record<string, unknown>;
}

export interface MediaPurposeImportRequest {
  projectName: string;
  purpose: MediaPurposeKey;
  target: MediaPurposeTarget;
  sourcePath: string;
  title: string;
  oneLineSummary?: string | null;
  receiptPath?: string | null;
  localeId?: string | null;
  options?: Record<string, unknown>;
}
```

`generation.ts` exports JSON-safe generation execution contracts:

```ts
export interface GenerationPolicy {
  kind: 'generationPolicy';
  purpose: MediaPurposeKey;
  mediaKind: 'image' | 'audio' | 'video' | 'text' | 'json';
  provider: string;
  model: string;
  lockedPayload: Record<string, unknown>;
  maxEstimatedCostUsd?: number;
}

export interface GenerationRequest {
  kind: 'generationRequest';
  purpose: MediaPurposeKey;
  mediaKind: 'image' | 'audio' | 'video' | 'text' | 'json';
  provider: string;
  model: string;
  payload: Record<string, unknown>;
  output: {
    title: string;
    fileName?: string;
  };
}
```

These are public interface names. Do not rename them during implementation
without updating this plan first.

### Core Server Media Purpose Modules

Add:

```text
packages/core/src/server/media-purpose/
  media-purpose-registry.ts
  media-purpose-targets.ts
  media-file-import.ts
  purposes/
    lookbook-image.ts
```

Responsibilities:

- `media-purpose-registry.ts`
  - maps each `MediaPurposeKey` to its context and import handler;
  - fails fast when a key is unknown;
  - exports the small resolver used by CLI and server adapters.

- `media-purpose-targets.ts`
  - parses CLI target strings such as `lookbook:<id>`,
    `castMember:<id>`, and `scene:<id>`;
  - validates that the target kind is allowed for the chosen media key.

- `media-file-import.ts`
  - owns shared file copy and asset insertion mechanics;
  - accepts absolute source paths and project-relative source paths;
  - copies media into a destination folder chosen by the media purpose handler;
  - allocates unique readable filenames;
  - inspects file metadata;
  - inserts `asset` and source `asset_file`;
  - inserts receipt `asset_file` when supplied and valid;
  - returns inserted asset IDs and destination paths.

- `purposes/lookbook-image.ts`
  - gathers Lookbook image context;
  - imports a file as a Lookbook image;
  - validates section options;
  - writes `lookbook_image` and `lookbook_image_section`.

- `purposes/cast-portrait.ts`
  - gathers cast portrait context;
  - imports a file as a cast portrait using `cast_asset`.

- `purposes/cast-character-sheet.ts`
  - gathers character sheet context;
  - imports a file using `cast_asset`.

- `purposes/scene-narration-audio.ts`
  - gathers narration context;
  - imports an audio file using `scene_asset` and locale context.

### Media Purpose Definition Interface

Use a small TypeScript interface for each media purpose key:

```ts
interface MediaPurposeDefinition {
  key: MediaPurposeKey;
  label: string;
  mediaKind: 'image' | 'audio' | 'video' | 'text' | 'json';
  allowedTargetKinds: MediaPurposeTarget['kind'][];
  defaultAssetType: string;
  defaultAssetRole: string;
  defaultFileRole: string;
  destinationFolder(input: MediaPurposeImportRequest): ProjectRelativePath;
  buildContext(input: MediaPurposeContextRequest): Promise<MediaPurposeContextReport>;
  importMedia(input: MediaPurposeImportRequest): Promise<MediaPurposeImportReport>;
}
```

This interface is intentionally about context and import. It does not include
provider calls, model mappings, or prompt templates.

Adding a new media purpose key means:

1. Add the key to `MediaPurposeKey`.
2. Add one server module under `packages/core/src/server/media-purpose/purposes/`.
3. Register the definition in `media-purpose-registry.ts`.
4. Add context tests.
5. Add import tests.
6. Add skill reference guidance under the shared Media Producer skill.

## Detailed First Key: `lookbook.image`

### Purpose

Create or import an image that demonstrates a project Lookbook or specific
Lookbook sections.

The image may demonstrate:

- palette behavior;
- lighting strategy;
- texture and grain;
- composition pattern;
- camera language;
- emotional application of the visual language;
- contrast between different story phases.

The domain contract does not encode those creative possibilities as required
schema fields. They belong in the agent prompt guidance and conversation.

### Context Request

```bash
renku generation context \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --sections palette,lighting \
  --json
```

Core parses:

```ts
{
  purpose: 'lookbook.image',
  target: { kind: 'lookbook', lookbookId: string },
  options: {
    sections?: LookbookSection[]
  }
}
```

### Context Report

The report should include:

```ts
interface LookbookImageContextReport {
  valid: true;
  project: {
    name: string;
    projectFolder: string;
  };
  purpose: 'lookbook.image';
  target: {
    kind: 'lookbook';
    lookbookId: string;
  };
  lookbook: {
    id: string;
    name: string;
    isActive: boolean;
    sections: LookbookSections;
  };
  targetSections: LookbookSection[];
  existingImages: LookbookImage[];
  imagesBySection: Record<LookbookSection, LookbookImage[]>;
  cardImage: LookbookImage | null;
  sourceInspirations: LookbookSourceInspiration[];
  importRequirements: {
    command: 'renku media import';
    requiredFlags: ['--purpose', '--target', '--source', '--title'];
    optionalFlags: ['--sections', '--receipt', '--summary'];
    allowedSections: LookbookSection[];
    destinationFolder: 'visual-language/lookbook';
  };
  guidance: {
    skill: 'media-producer';
    purposeReference: 'references/purposes/lookbook-image.md';
  };
  resourceKeys: string[];
}
```

Notes:

- Do not include a generic `referenceImages` field.
- Existing images and Inspiration folders are context, not required inputs.
- The agent decides how to use context based on the selected model and guidance.
- Invalid section keys produce structured diagnostics.

### Import Request

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source <path> \
  --sections palette,lighting \
  --title "Horror Palette Hallway" \
  --summary "Palette and lighting test for dread scenes." \
  --receipt <optional-receipt-json> \
  --json
```

Core parses:

```ts
{
  purpose: 'lookbook.image',
  target: { kind: 'lookbook', lookbookId: string },
  sourcePath: string,
  title: string,
  oneLineSummary?: string,
  receiptPath?: string,
  options: {
    sections: LookbookSection[]
  }
}
```

### Import Behavior

`lookbook-image.ts` should:

1. Validate the Lookbook exists.
2. Validate section keys.
3. Call `media-file-import.ts` with:
   - media kind: `image`;
   - asset type: `lookbook_image`;
   - destination folder: `visual-language/lookbook/`;
   - file role: `source`;
   - origin: `generated` only when receipt is valid, otherwise `imported`.
4. Insert one `lookbook_image` row.
5. Insert `lookbook_image_section` rows.
6. Return a `MediaImportReport` with the imported Lookbook image.
7. Emit the same Studio resource keys as other Lookbook image mutations.

The public core service method is `importMediaForPurpose`. There is no separate
Lookbook image import service method.

### Import Report

The shared `renku media import` command should return the domain report:

```json
{
  "valid": true,
  "project": {
    "name": "urban-basilica",
    "projectFolder": "/Users/example/Renku/urban-basilica"
  },
  "purpose": "lookbook.image",
  "target": {
    "raw": "lookbook:lookbook_abc",
    "kind": "lookbook",
    "id": "lookbook_abc"
  },
  "imported": {
    "id": "lookbook_image_abc",
    "sections": ["palette", "lighting"]
  },
  "resourceKeys": ["resource:visual-language:lookbook:lookbook_abc"]
}
```

The exact `LookbookImage` shape should reuse the current core contract instead
of inventing a new image DTO.

## Other Keys To Validate The Shape

These keys should be designed at a higher level before implementation starts.
They do not need full context contracts in this first slice.

### `cast.portrait`

Purpose:

- image portrait for a cast member.

Context should include:

- cast member name, role, and description;
- existing cast assets;
- selected/pinned portrait when available;
- relevant Lookbook summary;
- screenplay appearances when useful.

Import should:

- target `castMember:<id>`;
- use media kind `image`;
- use asset type `cast_portrait`;
- use asset relationship role `portrait`;
- use destination folder under `cast/`;
- reuse the generic `asset` + `asset_file` + `cast_asset` path.

### `cast.character-sheet`

Purpose:

- visual continuity sheet for a cast member.

Context should include:

- cast member description;
- existing portraits and sheets;
- costume, prop, and body-language notes when available;
- relevant Lookbook summary;
- reference set context when implemented.

Import should:

- target `castMember:<id>`;
- use media kind `image` in the first pass;
- use asset type `cast_character_sheet`;
- use relationship role `sheet`;
- reuse `cast_asset`;
- leave compound folder support for a later explicit slice.

### `scene.narration-audio`

Purpose:

- narration audio for a scene.

Context should include:

- scene title and summary;
- screenplay text or narration draft;
- locale;
- voice direction;
- existing voice samples when available.

Import should:

- target `scene:<id>`;
- use media kind `audio`;
- use asset type `narration_audio`;
- use relationship role `narration`;
- use `scene_asset`;
- include locale context when supplied.

## Engines Execution Structure

Add:

```text
packages/engines/src/generation/
  contracts.ts
  estimates.ts
  index.ts
  model-discovery.ts
  request-hash.ts
  runner.ts
```

Responsibilities:

- `model-discovery.ts`
  - list models by media kind;
  - show model schema, pricing, and affordances;
  - expose model-specific adjustable parameters.

- `contracts.ts`
  - validate `GenerationPolicy`;
  - require request provider/model/media kind to match policy;
  - define request, estimate, run result, and receipt contracts.

- `estimates.ts`
  - calculate cost from existing model pricing config;
  - generate deterministic approval tokens.

- `runner.ts`
  - call `ProviderRegistry`;
  - support live and simulated modes;
  - write staged output files under `generated/media/` for project imports;
  - bypass provider client creation in simulated mode.

- `request-hash.ts`
  - hashes the exact policy and request used for approval tokens and receipts.

Engines must not import Lookbook, cast, scene, or other domain mutation code.

## CLI Implementation Structure

Add:

```text
packages/cli/src/commands/generation-command.ts
packages/cli/src/commands/media-command.ts
```

`generation-command.ts` handles:

- `context`
- `model list`
- `model show`
- `policy validate`
- `estimate`
- `run`

`media-command.ts` handles:

- `import`

Root help should add only:

```text
generation          Gather generation context and run model calls
media               Import media files into project domains
```

Do not add one root command per media purpose key.

## Skill Structure

Add one shared skill:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/
```

The name is user-facing and understandable for directors and cinematographers.
It describes the job: produce media for the project.

Implemented starter structure:

```text
media-producer/
  SKILL.md
  references/
    workflow.md
    lookbook-image.md
    future-purpose-sketches.md
  samples/
    lookbook-image-policy.json
    lookbook-image-request.json
```

Progressive disclosure:

1. Read `workflow.md`.
2. Read the purpose reference for the requested `MediaPurposeKey`.
3. Read selected model guidance only after the user chooses or confirms a
   model.
4. Use Renku context output as the project source of truth.
5. Write `GenerationPolicy`.
6. Write `GenerationRequest`.
7. Run estimate.
8. Get user approval.
9. Run generation.
10. Import the output with `renku media import`.

The existing Lookbook Designer skill should not absorb image generation. It
should hand off to Media Producer when the user wants generated Lookbook images.

## Documentation Updates Completed

- Updated `0023` to remove the old Lookbook-specific generation direction.
- Updated `0023` command examples from old Lookbook-specific import to
  `media import --purpose lookbook.image`.
- Updated `docs/architecture/reference/domain-vocabulary.md` so Generation
  Definition does not imply code-owned provider/model selection when
  `GenerationPolicy` is present.
- Updated Lookbook Designer skill docs to point to Media Producer.

## Implementation Checklist

### Planning Decisions

- [x] Approve `MediaPurposeKey`.
- [x] Approve `GenerationPolicy`.
- [x] Approve `GenerationRequest`.
- [x] Approve `GenerationReceipt`.
- [x] Approve `renku generation context`.
- [x] Approve `renku generation run`.
- [x] Approve `renku media import`.
- [x] Approve skill name `media-producer`.

### Core Contracts

- [x] Add `packages/core/src/client/media-purpose.ts`.
- [x] Add `packages/core/src/client/generation.ts`.
- [x] Export approved public contracts from the core browser-safe entry point.
- [x] Validate generation policy/request/receipt files at command boundaries
  through strict model lookup, media-kind matching, required flag checks, and
  approval-token hashing.

### Core Media Purpose

- [x] Add `packages/core/src/server/media-purpose/media-purpose-registry.ts`.
- [x] Add `packages/core/src/server/media-purpose/media-purpose-targets.ts`.
- [x] Add `packages/core/src/server/media-purpose/media-file-import.ts`.
- [x] Accept generation receipts on media import reports.
- [x] Add `packages/core/src/server/media-purpose/purposes/lookbook-image.ts`.
- [x] Implement Lookbook image context report.
- [x] Implement Lookbook image import through shared media-file import.
- [x] Replace the previous public Lookbook image import service usage with the
  media import path.
- [x] Delete the old `lookbook image import` CLI path.
- [x] Keep Lookbook section editing and card-image commands as domain editing
  commands.

### Engines

- [x] Add `packages/engines/src/generation/model-discovery.ts`.
- [x] Add `packages/engines/src/generation/contracts.ts`.
- [x] Add `packages/engines/src/generation/estimates.ts`.
- [x] Add `packages/engines/src/generation/runner.ts`.
- [x] Add `packages/engines/src/generation/request-hash.ts`.
- [x] Extend model catalog entries with affordances and adjustable parameters.
- [x] Enforce policy fields by merging policy parameters after request
  parameters.
- [x] Estimate costs from current pricing config.
- [x] Generate and validate approval tokens.
- [x] Write staged outputs and receipts.
- [x] Support simulated runs without provider API keys.

### CLI

- [x] Add `packages/cli/src/commands/generation-command.ts`.
- [x] Add `packages/cli/src/commands/media-command.ts`.
- [x] Add root `generation` command.
- [x] Add root `media` command.
- [x] Add `renku generation context`.
- [x] Add `renku generation model list`.
- [x] Add `renku generation model show`.
- [x] Add `renku generation policy validate`.
- [x] Add `renku generation estimate`.
- [x] Add `renku generation run`.
- [x] Add `renku media import`.
- [x] Remove `renku lookbook image import`.
- [x] Update CLI tests and help text.

### Skills

- [x] Add `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`.
- [x] Add general workflow reference.
- [x] Add `lookbook-image.md` domain reference.
- [x] Add higher-level drafts for cast portrait, cast character sheet, and
  scene narration audio.
- [x] Add policy/request samples for Lookbook Image.
- [x] Update Lookbook Designer to hand off generated image requests to Media
  Producer.

### Verification

- [x] Run focused core tests for Lookbook image context.
- [x] Run focused core tests for Lookbook image import.
- [x] Run engines generation model and estimate tests.
- [x] Run CLI tests for `generation` and `media`.
- [x] Run `pnpm test:engines`.
- [x] Run `pnpm test:cli`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm check`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Exercise the Lookbook Image flow in CLI tests:
  1. `renku generation context --purpose lookbook.image`
  2. `renku generation model list --media-kind image`
  3. `renku generation estimate`
  4. `renku generation run --simulate`
  5. `renku media import --purpose lookbook.image`
  6. `renku lookbook show`

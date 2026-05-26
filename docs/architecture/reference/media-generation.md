# Media Generation

Date: 2026-05-26

Status: current

Role: reference

## Purpose

This reference defines the current persisted media generation and media import
contract.

Decision history:

- `../../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`

## Current Purpose

The first implemented media generation purpose is:

```text
lookbook.image
```

Target format:

```text
lookbook:<lookbook-id>
```

Core contract target shape:

```ts
{
  kind: 'lookbook';
  id: string;
}
```

## Generation Commands

Current CLI surface:

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose lookbook.image --target lookbook:<id> --json

renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose lookbook.image --target lookbook:<id> --json

renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku generation run --spec <spec-id> --simulate --json
```

The CLI command names are generic. The implementation is currently a direct
Lookbook Image vertical slice.

## Lookbook Image Context

`generation context` returns factual project context. It does not choose a
model or infer provider parameters.

The context includes:

- purpose and target;
- project name, title, and aspect ratio;
- the Lookbook sections;
- source Inspiration folders;
- existing Lookbook images;
- images by Lookbook section;
- card image;
- defaults for take count, seed, image frame, detail, and output format;
- Studio resource keys.

It does not return generic model requirements, prompt instructions, provider
capability summaries, or an import contract.

## Lookbook Image Spec

The generation spec is persisted before estimate or execution.

```json
{
  "purpose": "lookbook.image",
  "target": { "kind": "lookbook", "id": "lookbook_abc" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A horror hallway showing the Lookbook palette under dread lighting.",
  "focusSections": ["palette", "lighting"],
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Horror palette hallway"
}
```

Binding fields:

- `modelChoice`
- `takeCount`
- `seed`
- `imageFrame`
- `detail`
- `outputFormat`

Agents must not override these fields after the user selects them.

Supported model choices:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/nano-banana-2`
- `fal-ai/xai/grok-imagine-image`
- `fal-ai/bytedance/seedream/v5/lite/text-to-image`

Supported image frames:

- `project`
- `1:1`
- `3:4`
- `4:3`
- `16:9`
- `9:16`
- `21:9`

Supported details:

- `draft`
- `standard`
- `high`

Supported output formats:

- `png`
- `jpeg`
- `webp`

Model-specific validation may reject a supported product option when the chosen
model cannot execute it. For example, some models reject `21:9` or seeds.

## Estimate And Run

Estimate and run both use the persisted spec.

The command sequence is:

1. Read the persisted spec.
2. Build current Lookbook Image context.
3. Validate the spec against that context.
4. Build the final provider payload.
5. Validate the provider payload against the model JSON Schema.
6. Estimate cost through engines.
7. Require the approval token for live execution.

No live provider call should happen when the estimate is unknown or unapproved.

Generation runs store:

- spec snapshot;
- provider and model;
- provider payload;
- estimate snapshot;
- approval token;
- simulation flag;
- status;
- outputs;
- diagnostics;
- start and completion timestamps.

## Persistence

The first implementation uses two tables:

```text
media_generation_spec
media_generation_run
```

`media_generation_spec.spec_json` stores editable user choices.

`media_generation_run.spec_snapshot_json` and
`media_generation_run.provider_payload_json` make each run understandable later,
even after the spec is edited.

`media_generation_run.outputs_json` stores output paths, returned seeds,
revised prompts, imported asset ids, and per-take metadata for now. Do not add a
separate output table until a concrete UI or query needs it.

## Media Import

Import is separate from generation.

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source <project-relative-path> \
  --sections palette,lighting \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

For Lookbook Images, import registers an asset, creates the Lookbook image
relationship, stores section placement, and emits Lookbook resource keys.

The current CLI expects a project-relative source path. Importing absolute paths
can be reconsidered in a future implementation slice, but it is not the current
contract.

For generated Lookbook images, agents must inspect the generated image before
import and choose section tags based on what the image visibly demonstrates.
`focusSections` is generation intent, not placement truth.

## Future Purpose Rule

When adding the next purpose, add a second concrete implementation file and
direct switch cases. Do not introduce a registry or adapter framework until
multiple concrete purposes prove that shared code would remove real complexity.

Do not add model capability YAML, schema overlays, or inferred model support.
Provider model JSON Schemas validate final payloads only.


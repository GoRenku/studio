# Generation Preview Purpose Bindings

Date: 2026-07-06

Status: current

Role: architecture decision note

## Purpose

This note defines how saved media-generation specs become generation preview
payloads.

The preview dialog exists so the user can verify what Renku Studio will send
before generation runs:

1. which model and provider route will receive the request;
2. which prompt and reference media will be sent;
3. which actual model/provider configuration parameters will be sent or relied
   on.

For image generations, Core must not understand the creative contents of the
generated image. A Lookbook image, Location sheet, Cast profile, Scene
Storyboard sheet, and shot input image are different product purposes, but the
creative meaning lives in opaque prompt text, reference assets, and the
agent/user workflow. Core's preview responsibility is the generation envelope:
purpose, target, selected model, provider route, prompt field, reference asset
ids, provider payload, and model-specific parameters.

Decision history:

- `../decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `../decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `../decisions/0044-use-media-generation-module-boundaries.md`
- `../decisions/0045-use-generation-preview-purpose-bindings.md`

## Decision

Saved image generation previews use one shared image preview path for the
common preview envelope and model-configuration rows.

Individual image purposes may still have purpose-specific preview bindings, but
those bindings do not own image model-configuration row logic. They bind the
purpose's existing domain contract to the shared image preview path.

Final `shot.video-take` previews are separate because they target video models
with route-specific video parameters and image/audio/video input slots. They use
the shot-video route contract rather than the image model schema helper.

## Shared Image Preview Path

The shared image preview path owns:

- the common `GenerationPreviewRequest` envelope;
- selected model and provider route display;
- prompt placement in `finalPrompt`;
- provider preview metadata;
- Config rows derived from provider route schema descriptors and the actual
  provider payload;
- schema default labeling when Core intentionally relies on provider defaults.

Image Config rows should represent actual model/provider parameters, such as:

- `image_size`;
- `aspect_ratio`;
- `quality`;
- `resolution`;
- `output_format`;
- `seed`;
- `num_images`.

Studio-level spec controls such as `imageFrame`, `sheetFrame`, `heroFrame`,
`shotFrame`, `detail`, `outputFormat`, and `takeCount` are inputs to purpose
provider-payload builders. They should not be duplicated as separate Config
rows by default. If they matter to the generated media, the user should verify
the effective provider/model parameter they map to, such as `aspect_ratio`,
`image_size`, `quality`, `output_format`, `seed`, or `num_images`.

## Purpose Bindings

Purpose bindings answer questions the shared image preview path cannot answer
safely:

- how to read and validate the saved spec;
- which current project context the spec must be checked against;
- which existing provider payload builder owns the provider request;
- which project assets are real references for the purpose;
- which target and title the preview should use.

The difference between image purposes is therefore mostly context and reference
ownership, not model-configuration ownership.

Examples:

| Purpose | Shared Preview Path | Purpose Binding Responsibility |
| --- | --- | --- |
| `lookbook.image` | model, prompt, Config from provider payload | Read Lookbook context, call the Lookbook Image provider payload builder, and return real selected references only if they exist. |
| `cast.profile` | model, prompt, Config from provider payload | Validate Cast Member ownership, call the Cast Profile provider payload builder, and resolve selected/source cast image references. |
| `location.hero` | model, prompt, Config from provider payload | Validate Location ownership, call the Location Hero provider payload builder, and include the selected Location Sheet asset as a reference. |
| `scene.storyboard-sheet` | model, prompt, Config from provider payload | Validate Scene/Shot List context, call the Scene Storyboard Sheet provider payload builder, and resolve selected Lookbook sheet references without inspecting sheet contents. |
| `shot.first-frame` and related shot input image purposes | model, prompt, Config from provider payload | Validate Shot Video Take context, call the shot input provider payload builder, and resolve the shot input reference bundle. |

A purpose binding should be small and explicit:

```ts
return buildSavedImageGenerationPreview({
  specRecord,
  project: context.project,
  target: specRecord.target,
  title: specRecord.title,
  modelChoice: spec.modelChoice,
  modelLabel,
  provider: plan.provider,
  providerModel: plan.model,
  mode: plan.mode,
  prompt: spec.prompt,
  references: resolvedReferences,
  payload: plan.payload,
});
```

If a purpose binding hand-builds rows for `aspect_ratio`, `quality`,
`image_size`, `resolution`, or other image model parameters, that is a review
smell. Those rows belong in the shared provider-schema/payload configuration
path.

## References

References are not Config rows.

The preview References tab should show real media references using durable
asset and asset-file ids. A shared preview helper must not infer references
from provider payload URLs, prepared project-relative paths, or prompt text.

Each purpose binding owns durable reference resolution because each purpose has
different domain relationships:

- a Cast Profile can reference selected/source Cast image assets;
- a Location Hero references a source Location Sheet asset;
- shot input images use the shot input reference bundle;
- Scene Storyboard Sheet references come from selected Lookbook sheet context
  when real asset/file ids exist.

If a purpose has no selected asset-backed references, it returns an empty
`references` array.

## Shot Video Preview

Final `shot.video-take` is not an image preview with a different label.

It uses video route metadata:

- selected video model;
- selected input mode;
- selected provider route;
- route parameters;
- normalized route settings;
- prepared image/audio/video inputs as References.

Preview rows must use the existing shot-video route helpers:

- `requireShotVideoTakeRoute(...)`;
- `parametersForRoute(...)`;
- `normalizeRouteSettingsForContext(...)`.

Do not create a preview-only video route parameter map.

## Runtime Boundaries

Core preview runtime may validate:

- purpose;
- target;
- selected model;
- provider route;
- provider parameter shape;
- prompt field presence/type;
- reference asset ids and asset file ids.

Core preview runtime must not:

- parse prompt text for creative instructions;
- inspect image contents;
- validate storyboard panels, captions, labels, shot coverage, or visual
  matching;
- show raw provider payload JSON as Config content;
- show local paths or provider upload URLs;
- add compatibility support for retired array-shaped `configuration`.

## Review Checklist

Use this checklist when reviewing generation preview changes:

- Image preview Config rows come from provider schema descriptors and actual
  provider payload/defaults.
- Purpose bindings do not duplicate image model-parameter row construction.
- Purpose bindings resolve references through durable asset/file ids.
- Prompt text appears in the Prompt tab, not Config.
- Reference media appears in References, not Config counts.
- Final `shot.video-take` Config rows use shot-video route metadata.
- Studio renders `preview.configuration.sections` without provider-model
  branching.
- CLI and Studio do not translate old preview shapes or compensate for missing
  Core preview builders.

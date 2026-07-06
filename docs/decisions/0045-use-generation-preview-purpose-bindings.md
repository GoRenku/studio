# 0045 Use Purpose Bindings For Saved Generation Previews

Date: 2026-07-06

Status: accepted

## Context

Saved media-generation specs need preview payloads so users can verify a
generation before it runs.

For image generations, the preview dialog should show:

- the selected model and provider route;
- the prompt and any reference images;
- the actual model/provider configuration parameters, such as `aspect_ratio`,
  `image_size`, `quality`, `resolution`, `output_format`, `seed`, or
  `num_images`.

The different image purposes have different creative intent, but that creative
intent belongs to opaque prompt text, reference assets, and agent/user workflow
guidance. Core runtime must not inspect or validate the creative contents of
prompts or generated/reference media.

At the same time, a fully generic saved-image preview builder cannot safely
resolve references. Preview references require durable `assetId` and
`assetFileId` values, and those relationships are purpose-specific.

## Decision

Use one shared saved-image preview path for the common image preview envelope
and image model-configuration rows.

Use small purpose-specific preview bindings to connect each purpose's saved
spec, context, provider payload builder, target/title data, and durable
reference assets to the shared preview path.

Purpose bindings do not own image model-configuration row construction. Image
Config rows come from provider route schema descriptors and the actual provider
payload/defaults.

Final `shot.video-take` previews use a separate shot-video route preview path,
because final video generation has video route parameters and image/audio/video
input slots rather than an image model schema.

## Consequences

- Core owns saved-spec preview construction.
- CLI and Studio remain thin consumers of Core preview payloads.
- Studio renders `preview.configuration.sections` and does not inspect provider
  payloads or branch on provider model ids.
- Purpose bindings resolve references through durable project asset/file ids.
- Purpose bindings must not infer references from paths, provider URLs, prompt
  text, or generated media contents.
- Image Config rows show actual model/provider parameters, not duplicated
  Studio-level spec controls such as `imageFrame`, `sheetFrame`, `detail`, or
  `takeCount`.
- Final `shot.video-take` preview rows must use the existing shot-video route
  helpers, not a preview-only route map.

## Reference

The implementation guidance is in
`../architecture/generation-preview-purpose-bindings.md`.

# Media Generation Architecture

Date: 2026-05-26

Status: current

Role: topic overview

## Purpose

Media generation is the Renku Studio path for creating AI media from project
context while preserving user choices, cost approval, and project metadata
boundaries.

The implemented purposes are `lookbook.image`, `cast.character-sheet`,
`cast.profile`, `location.environment-sheet`, `scene.storyboard-sheet`, the
shot-video input purposes, and `shot.video-take`. Precise contracts live in
`reference/media-generation.md`.

## Current Shape

Generation and import are separate.

Generation reads project context, lists supported models for a purpose, persists
the user's generation spec, estimates cost, and returns a structured approval
summary. That approval covers both the estimated cost and the provider transfer
needed to run the exact request. A live run then uses the approval token from
that estimate, creates staged outputs, and records a durable generation run.

Import attaches an existing file to a project domain target. The file may come
from a Renku generation run, an external tool, a manual upload, or a download.
The domain target does not care how the file was produced.

For all current purposes, the CLI surface is generic:

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose lookbook.image --target lookbook:<id> --json
renku generation spec create --file <spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku media import --purpose lookbook.image --target lookbook:<id> --source <path> --json
```

Internally, the common lifecycle is registry-backed. Core owns a media
generation purpose registry and shared generation service for purpose lookup,
spec persistence, prepare, estimate, run, and run recording. Purpose definitions
still own context construction, spec validation, provider payloads, output
names, dependency declarations, and import behavior.

Shot-video take planning reuses the shared dependency-map, dependency-pricing,
and plan-line contracts. A generated file still does not become project
metadata until an explicit media import succeeds.

Location environment sheets add an agent-owned post-processing step after
generation. Core asks the selected text-to-image model for a four-azimuth
contact sheet. The media-producer agent then inspects the returned composite,
crops four view files, and imports the composite plus the already-sliced views.
SQLite stores the grouped asset and azimuth relationships; it does not store
crop boxes, extraction confidence, extraction methods, or extraction
diagnostics.

## Related References

- `reference/media-generation.md`
- `reference/studio-skills.md`
- `visual-language.md`
- `../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `../decisions/0025-use-shared-media-generation-purpose-architecture.md`

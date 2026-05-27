# Media Generation Architecture

Date: 2026-05-26

Status: current

Role: topic overview

## Purpose

Media generation is the Renku Studio path for creating AI media from project
context while preserving user choices, cost approval, and project metadata
boundaries.

The implemented purposes are `lookbook.image`, `cast.character-sheet`,
`cast.profile`, and `location.environment-sheet`. Precise contracts live in
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

Internally, this is a direct vertical slice rather than a generic media-purpose
framework.

Location environment sheets add a reusable post-processing step after
generation. Core asks the selected text-to-image model for a four-azimuth
contact sheet, then uses
`packages/core/src/server/image-processing/` to derive tolerant azimuth crops,
confidence metadata, and a diagnostic overlay before import groups the
composite and views in SQLite.

## Related References

- `reference/media-generation.md`
- `reference/studio-skills.md`
- `visual-language.md`
- `../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`

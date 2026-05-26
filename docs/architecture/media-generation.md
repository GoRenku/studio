# Media Generation Architecture

Date: 2026-05-26

Status: current

Role: topic overview

## Purpose

Media generation is the Renku Studio path for creating AI media from project
context while preserving user choices, cost approval, and project metadata
boundaries.

The first implemented purpose is `lookbook.image`. Precise contracts live in
`reference/media-generation.md`.

## Current Shape

Generation and import are separate.

Generation reads project context, lists supported models for a purpose, persists
the user's generation spec, estimates cost, and runs the approved spec. It
creates staged outputs and durable run records.

Import attaches an existing file to a project domain target. The file may come
from a Renku generation run, an external tool, a manual upload, or a download.
The domain target does not care how the file was produced.

For Lookbook Images, the CLI surface is generic:

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

## Related References

- `reference/media-generation.md`
- `reference/studio-skills.md`
- `visual-language.md`
- `../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`


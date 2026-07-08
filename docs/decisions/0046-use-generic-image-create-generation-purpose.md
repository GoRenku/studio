# Use Generic Image Create Generation Purpose

Date: 2026-07-08

Status: accepted

## Context

Shot Video Take first frames, last frames, reference images, and video prompt
sheets used to be modeled as separate media generation purposes. Those names
mixed two different responsibilities:

- creating an image with a provider;
- attaching the resulting image to a Shot Video Take input slot.

That made generic image creation hard to reuse and encouraged Shot-specific
generation contracts to own provider details that are not actually Shot domain
rules.

## Decision

Renku Studio uses `image.create` as the generic Renku-managed image creation
purpose.

`image.create` is project-scoped. It supports text-to-image and
reference-to-image specs, validates provider parameters and project image
references, prepares provider payloads, estimates cost, creates generated
files, and records Media Generation Runs.

Shot Video Take input roles are no longer media generation purposes.
First-frame, last-frame, reference-image, and video-prompt-sheet are dependency
or import kinds. Shot input files are attached through:

```bash
renku media import --purpose shot.input --kind <input-kind> ...
```

## Consequences

- Core keeps provider image creation in the media generation lifecycle while
  keeping Shot Video Take attachment in Shot-owned import and selection
  commands.
- Agents materialize authored Shot input dependency drafts into `image.create`
  specs, then import approved outputs into the requested Shot input kind.
- Generation previews for generic image creation use purpose `image.create`.
- Runtime code does not preserve compatibility aliases for the retired
  `shot.first-frame`, `shot.last-frame`, `shot.reference-image`, or
  `shot.video-prompt-sheet` generation purposes.

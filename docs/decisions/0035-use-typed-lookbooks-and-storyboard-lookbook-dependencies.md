# 0035 Use Typed Lookbooks And Storyboard Lookbook Dependencies

Date: 2026-06-20

Status: accepted

## Context

Renku Studio originally modeled one project-level Lookbook selection. That was
enough when Lookbooks only described the cinematic visual language, but it was
too vague for storyboard generation.

Storyboard images need two kinds of guidance:

- the Movie Lookbook, which describes the intended finished-film look;
- the Storyboard Lookbook, which describes how storyboard panels should be
  drawn, labeled, valued, and kept readable.

Using one global selected Lookbook for both concerns made agents guess whether
a Lookbook was cinematic direction or drawing-style direction. It also let
`scene.storyboard-sheet` generation proceed without a concrete storyboard style
reference image.

## Decision

Lookbooks are typed durable visual-language documents. The current types are
`movie` and `storyboard`.

Authoring files use explicit tagged documents:

```json
{
  "kind": "movieLookbook",
  "movieLookbook": {
    "name": "Cold Civic Glow"
  }
}
```

```json
{
  "kind": "storyboardLookbook",
  "storyboardLookbook": {
    "name": "Graphite Production Boards"
  }
}
```

Movie Lookbooks keep the cinematic sections: thesis, palette, tone and mood,
composition, lighting, texture, and camera.

Storyboard Lookbooks own the storyboard drawing sections: style brief, line and
finish, value and accent, panel and notation, continuity and clarity, and
guardrails.

Selection is type-specific. A project may have one selected Movie Lookbook and
one selected Storyboard Lookbook. Selection uses:

```bash
renku lookbook select --type movie --lookbook <lookbook-id> --json
renku lookbook select --type storyboard --lookbook <lookbook-id> --json
```

The shared `lookbook.image` and `lookbook.sheet` purposes remain shared
purposes. Their validation, focus sections, and prompt construction dispatch
from the owning Lookbook type.

`scene.storyboard-sheet` requires a selected Storyboard Lookbook. It declares a
required `lookbook-sheet` dependency whose subject is the selected Storyboard
Lookbook id. Supported provider routes receive the selected Storyboard Lookbook
sheet as an image/reference input. The selected Movie Lookbook may still inform
cinematic intent, but it is not the storyboard style source of truth.

## Consequences

- Lookbook type, section validation, typed selection, and generation dependency
  rules live in `packages/core`.
- Studio server routes and CLI handlers remain thin adapters over core
  commands.
- React feature code displays typed reports and sends typed selection intent
  instead of enforcing Lookbook business rules locally.
- Existing development Movie Lookbooks are transformed one way into typed
  Movie Lookbook rows by the Drizzle migration.
- Agents and Studio skills must create/select the correct Lookbook type before
  generating storyboard media.
- A Movie Lookbook sheet cannot satisfy the `scene.storyboard-sheet`
  Storyboard Lookbook sheet dependency.

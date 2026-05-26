# 0019 Use Durable Lookbooks As Project Visual Direction

Date: 2026-05-26

Status: accepted

## Context

Lookbooks turn reference analysis, user direction, screenplay context, and
creative conversation into the working visual language for a project. They are
not neutral summaries of source references. They guide later image and video
generation, UI review, and production decisions.

Lookbooks also need to remember which Inspiration folders influenced them and
where generated example images belong without mixing those concerns into the
Lookbook prose JSON.

## Decision

Lookbooks are durable project visual direction. They are created, validated,
updated, activated, and shown through top-level `renku lookbook` commands.

Agent-authored Lookbook input must be a tagged document:

```json
{
  "kind": "lookbook",
  "lookbook": {},
  "sourceInspirationFolderIds": []
}
```

The Lookbook document owns the visual-language sections: thesis, palette, tone
and mood, composition, lighting, texture, and camera. It must not contain
`imageFiles`. Example images are attached through Lookbook image relationships,
not by editing the Lookbook JSON.

Source Inspiration folders are durable ordered relationships. They are stored
separately from the Lookbook section JSON so that agents and UI can query
source folders directly and so deleting a folder can clean up the relationship.
Lookbooks do not copy Inspiration Analysis JSON into their own document.

At most one Lookbook can be active for the project. Creating a Lookbook does not
make it active automatically. The agent or user must explicitly call:

```bash
renku lookbook set-active --lookbook <lookbook-id> --json
```

Lookbook example images are registered project assets. Section placement is
stored in `lookbook_image_section`, and the card image is stored through an
explicit card-image relationship.

## Consequences

- A Lookbook can be authored from Inspiration folders, existing analyses, raw
  folder images, named references, screenplay context, or direct user art
  direction.
- Updating a Lookbook requires reading the existing Lookbook first and
  intentionally revising the requested parts.
- Source Inspiration relationships stay visible without turning the Lookbook
  into a copied analysis bundle.
- Generated or imported example images can appear in one or more Lookbook
  sections without changing the Lookbook JSON schema.
- The old `visual-language lookbook ...` command shape, old `read` naming, and
  old `set-card-image --file` shape are obsolete and are not preserved as
  compatibility aliases.


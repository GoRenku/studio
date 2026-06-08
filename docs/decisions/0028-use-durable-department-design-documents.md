# ADR 0028: Use Durable Department Design Documents

Status: accepted

Date: 2026-06-07

## Decision

Renku Studio uses first-class department documents for casting and production
design:

- Cast Design, stored in `cast_design` with active state in
  `cast_design_state`;
- Location Design, stored in `location_design` with active state in
  `location_design_state`.

Cast Member and Location facts are authored through `renku cast` and
`renku location`. Screenplay JSON references those existing facts by durable ids
and does not create, update, delete, or move them.

## Rationale

Screenplay facts and department design serve different jobs.

The screenplay needs durable narrative references such as who speaks, where a
scene happens, and what the story beat is. Casting and production design need
richer, department-specific guidance: performance interpretation, appearance,
costume continuity, voice casting notes, spatial grammar, set dressing, props,
and continuity risks.

Keeping those concerns in separate validated documents prevents screenplay
fields such as `description`, `visualNotes`, or `voiceNotes` from becoming vague
buckets.

## Consequences

- Stored department JSON is validated before writes and after reads.
- Unknown fields are rejected for Cast Design and Location Design.
- Agents must use the CLI command family that owns the durable concept.
- Media generation remains separate. Department documents can guide generation,
  but generated files are imported as Assets through media-purpose commands.
- Costume-variant media, voice media, and prop media remain future work until
  those concepts have explicit durable targets and import contracts.

# 0060 Use Stable Production Scene Numbers

Date: 2026-07-21

Status: superseded by Decision 0071

Decision 0071 removes the reservation registry. Production numbers are now
optional exact non-empty values stored directly on current Scenes and are not
normalized, allocated, reserved after deletion, or used as identity/order.

## Context

Scenes already have durable ids used by storage, URLs, relationships, CLI
commands, and agent-authored artifacts. Those ids are correct for identity but
awkward in production conversation. Act, Sequence, and Scene positions are also
the wrong reference because structural edits can change them.

Film production uses a continuous scene-number reference. Once assigned, an
existing scene keeps its number; a later scene inserted after 22 is numbered
22A so the following scenes do not need to be renumbered.

## Decision

Renku Studio stores production scene numbers in a separate Core-owned registry:

- `scene_production_number.production_number` is the canonical reference;
- `scene_production_number.scene_id` uniquely identifies the Scene it reserves;
- a Scene id remains the identity used by creative JSON, relationships, URLs,
  existing `--scene` inputs, and revision documents;
- production numbers are projection metadata and are not added to the creative
  `Scene` contract.

Canonical storage uses `[1-9][0-9]*[A-Z]*`, such as `1`, `22A`, and `22AA`.
Human-facing display pads only the numeric stem to at least two digits, such as
`01`, `09A`, and `100`. Resolution accepts leading zeroes and lowercase
suffixes, then normalizes them to the canonical form.

Initial numbering follows global screenplay order: Act position/id, then
Sequence position/id, then Scene position/id. Subsequent lifecycle rules are:

- surviving and moved Scenes retain their assigned number;
- appended new Scenes receive consecutive whole numbers after the highest
  numeric stem ever reserved;
- a new run inserted after an existing Scene receives the next unused suffixes
  in that numeric family, including `Z` to `AA`;
- removed Scenes leave their reservation intact, so omitted numbers are never
  reused;
- restoring the same durable Scene id makes its reserved number active again;
- a new run placed before the first current Scene receives new whole numbers,
  after which it may remain at that position without changing them;
- insertion before an already suffixed Scene in the same numeric family fails
  before any write because the accepted grammar cannot express the ordering
  without renumbering or compound revision forms.

Omitted status is derived by joining the immutable registry to current Scene
rows. It is not a second stored lifecycle state. The registry deliberately has
no foreign key to `scene`: deletion must preserve the reservation, while Core
commands enforce that every current Scene has exactly one canonical mapping.

Core owns allocation, synchronization, integrity validation, and structured
diagnostics. CLI and Studio consume Core reports and projections. The CLI adds
`renku screenplay scene-number list` and
`renku screenplay scene-number resolve --number`; Studio presents labels such
as `01 - Bombardment` while routing by the durable Scene id.

## Consequences

- Users and agents can refer to a Scene with a stable production number without
  changing the identity contract.
- Structural edits no longer cause existing production references to drift.
- Removed numbers remain meaningful as omitted references and cannot silently
  identify a different Scene later.
- This slice has no manual numbering, lock/draft state, renumber command,
  prefix form, or compound insertion syntax. Expanding that convention requires
  a separate product and architecture decision.
- Existing projects require a one-time deterministic backfill. Creative
  screenplay and revision JSON remain unchanged.

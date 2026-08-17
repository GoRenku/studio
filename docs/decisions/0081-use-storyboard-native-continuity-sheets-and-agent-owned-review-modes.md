# 0081 Use Storyboard-Native Continuity Sheets And Agent-Owned Review Modes

Date: 2026-08-17

Status: accepted

## Context

Beat Storyboards need exact Character, Location, and Prop continuity references,
but realistic Production sheets can leak their finish into a stylized
Storyboard even when the Storyboard Lookbook is named as appearance authority.
The existing scalar Asset `purpose` also cannot describe several intended uses
or expose those uses in the Generation Context where an agent makes an exact
request-scoped reference choice.

The existing unconditional one-pass image review rule is appropriate for
cost-conscious default behavior but prevents a user from explicitly delegating
a deliberate generate, inspect, revise, and regenerate loop.

## Decision

Storyboard continuity sheets reuse the existing `character_sheet`,
`location_sheet`, and `prop_sheet` Asset types and their current generation
purposes. A Storyboard-native sheet uses the exact accepted Production subject
sheet as canonical content authority and the current Storyboard Lookbook Sheet
as sole appearance authority. No new Asset type, owner, selection, dependency,
GenerationPurpose, or bulk job is added.

Asset intended-use metadata is `tags: string[]`, stored as non-null SQLite JSON
text with `[]` as the default. Core trims entries, rejects empty or non-string
entries, removes exact duplicates in first-authored order, preserves case, and
does not interpret tag meaning. Migration 0077 preserves every non-null scalar
`purpose` as one exact list entry and maps null to `[]`. Runtime recognizes only
the current `tags` contract.

The exact lowercase tag `storyboard` is an agent workflow convention for
Storyboard continuity sheets, not a Core enum or classifier. Generation
reference candidates expose Asset summary, reference name, and tags. Core does
not filter, sort, or select by them. Agents prefer a suitable same-owner sheet
whose complete tag list contains exact `storyboard`, but still inspect pixels,
state, and available provenance. A stale or wrong-state tagged sheet is not
trusted. When no suitable tagged sheet exists, the best usable same-owner sheet
remains a valid continuity-only fallback and the agent reports style-leakage
risk without blocking solely on the missing tag.

Focused single-file attachment accepts optional nested Asset metadata and
persists it atomically with the Asset, ownership, file, and provenance.
`renku media import` and `renku asset update` accept repeatable `--tag`;
`asset update --clear-tags` explicitly stores `[]`. The scalar flag and public
field are removed directly.

Character Sheets use one agent-owned universal layout in Production and
Storyboard rendering: a large straight-on face close-up with compact known
metadata and applicable accessory details below it, followed by full-length
front, back, left profile, and right profile views plus a labeled height ruler.
Rendering mode changes appearance authority only. Missing height is never
invented; the user may explicitly proceed without it after the limitation is
reported. The layout remains creative prompt and review guidance, not runtime
schema or image validation.

Generated-image review has two task-scoped agent modes:

- review-first is the default: inspect one result, show it with passes,
  concerns, and a recommendation, then wait for accept, regenerate, or discard;
- strict iterative review requires explicit user opt-in and deliberately
  changed, newly reviewed requests until the result passes, the user stops or
  accepts, or a real blocker or approval boundary is reached.

Both modes keep quality findings advisory. An informed user may accept and
attach an imperfect result. Every strict creative attempt retains ordinary
Preview, confirmation, estimate/token or external freeze, concurrency, and
provenance rules. A visual-quality failure never causes a blind identical retry,
and no QA state, attempt counter, queue, scheduler, spend bypass, prompt parser,
or image validator is added to runtime.

Scene Storyboard batching, one-/two-/three-/four-Beat layouts, placeholder
rules, vision-guided cropping, occupied-cell-only import, and request-scoped
exact reference persistence remain unchanged.

## Consequences

- Storyboard continuity can preserve canonical subject facts without making
  Production rendering finish the default.
- Assets can express several intended uses without a parallel tag entity or
  runtime tag semantics.
- Agents have the metadata needed for a deliberate exact choice while all
  eligible same-owner candidates remain visible and unselected.
- Users retain a cost-conscious default and may explicitly delegate careful
  iteration without weakening approval or provenance boundaries.
- Studio UI, routes, Project Settings, and creative runtime opacity remain
  unchanged except for public Asset contract fallout from `purpose` to `tags`.

This decision supersedes Decision 0080 only where that decision required an
unconditional one-pass/no-automatic-iteration workflow under every user intent.
All other Decision 0080 behavior remains accepted.

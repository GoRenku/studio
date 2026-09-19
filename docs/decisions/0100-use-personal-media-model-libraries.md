# 0100 — Use personal media model libraries

Date: 2026-09-19
Status: accepted

## Decision

Keep globally shared personal media discovery outside installed runtime and
Skills distributions. Core owns a bounded revision-checked route document with
only `provider`, exact `apiId`, and `name`. CLI exposes focused list/show/import/
remove commands composed with Engines' registered provider identities.

Skills own research and optional plain Markdown. Missing advice never blocks
adding, selecting, or preparing a route. Provider schemas remain just in time in
Engines and its current caches; library membership is not an execution allowlist.
No capability matrix, local schema, research envelope, or compatibility audit is
introduced. Existing protocol limits, including ElevenLabs music, remain intact.

Personal route names win exact discovery collisions. Guidance precedence is
independent: current bundled curation supplies defaults, personal notes add
advice, and explicit user preferences take priority. Plugin replacement and
later bundled adoption never rewrite user files or suppress newer curation.

## Consequences

An initial runtime/plugin release enables the workflow; subsequent route additions
within supported provider protocols need no release. Effective name/route hashes
keep existing selector caches truthful. Guide edits do not invalidate schemas.
Preview, confirmation policy, final live validation, attachment, Settings, and
safe provenance keep their existing contracts. No database migration is needed.

See [storage and ownership](../architecture/media-model-library.md) for the exact
contract and concurrency recovery procedure. This extends ADRs 0086 and 0091.

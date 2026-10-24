# 0127 Cast Looks, Costumes And Casting Rounds

Date: 2026-10-23

Status: accepted

Updates [ADR 0064](0064-use-exclusive-asset-membership-and-scoped-selection.md),
[ADR 0118](0118-separate-renku-generation-confirmation-from-host-approval.md)
and [ADR 0125](0125-store-character-arcs-as-one-json-document-per-cast-member.md).
Applies [ADR 0041](0041-keep-ai-artifacts-and-prompts-opaque.md) and
[ADR 0114](0114-describe-models-as-skill-data-in-codex-panels.md).
Implemented by plan 0242.

## Context

Directors could not audition looks. The only image of a character was a
Character Sheet, a layout tuned for video-model consistency and made one at a
time on one model. Costume variants were labels inside one version of a Cast
Design document, so a sheet could not belong to a costume and nothing knew
which costume a scene used. Age versions of one person were sometimes
separate Cast Members joined by a shared arc (Big Fish's Young Edward Bloom),
and sometimes one Cast Member with the ages only described in text (Sintel).

## Decision

- **One person is one Cast Member at every age.** A visible age change or a
  large change in physique is a **Cast Look** of that Cast Member, covering a
  list of scenes. A scene belongs to at most one Look of a Cast Member.
  Screenplay-to-cast authoring resolves character cues to people before
  creating Cast Members; age variants become Looks. Consolidating Big Fish's
  existing duplicates is a one-time local data conversion, not a product
  command.
- **Casting comes before character sheets.** A **Casting Round** belongs to
  one Look and records the models, per-model counts, concurrency, references
  and estimated cost the director confirmed. Each candidate is an Asset of
  type `casting_candidate` owned by the Cast Member and linked to its round,
  generated with purpose `cast.casting-candidate` targeting the round.
  Candidates carry a durable status: candidate, shortlisted or hidden.
- **Casting is a scoped selection.** The new selection target `castLook`
  selects the Look's cast candidate; only a candidate of that Look's own
  rounds may be selected.
- **Costumes are records.** A **Cast Costume** belongs to one Look and lists
  its scenes, wardrobe and continuity notes; a Cast Member wears one costume
  per scene, and a costume's scenes are within its Look's scenes. Cast Design
  keeps only `costume.baseWardrobeLogic`.
- **Character sheets are made per costume.** `cast.character-sheet` targets a
  Cast Costume. The new selection target `castCostume` picks one
  `character_sheet` of the Cast Member for each costume; this supersedes the
  ADR 0064 rule that Character Sheets are never selected, for this scope
  only. Scene generation context reports each Cast Member's Look, costume and
  picked sheet, and the picked sheet is the first, workflow-selected
  Cast continuity suggestion.
- **One confirmation per round.** The Casting Round panel shows the brief,
  models, counts and estimate; its consumed Generate is the Renku
  confirmation for every candidate in that round, replacing per-generation
  review for casting. In harnesses without inline panels the round is set up
  as chat text and the user's reply confirms it. The Route Chooser is not
  used for casting rounds.
- **Casting defaults live in Project Settings** (`casting.routes`, version 8),
  written by the round panel's save box or `renku settings casting set`.
- **Shared arcs are removed.** `characterArcReference` and its delete guard
  are gone; the turning point sheet field is `characterSheetAssetFileId`.
- **Studio stays model-neutral and opaque.** Panels receive model labels and
  one-line strength notes as Skill data, and display Engines estimates.
  Studio never inspects briefs or candidate images. The candidate layout (a
  face close-up beside a full-length figure in one 4:3 image) is a
  Studio-owned output shape described in the media-producer skill.
- **Casting reuses the generation estimator and display envelope.** The Skill
  supplies a prepared one-candidate native request for every offered paid
  model/provider, with its intended operation route, count and output settings. Codex never
  synthesizes an empty request from the Default Model List. Missing prepared
  requests fail before the panel opens, with structured issues listing every
  model/provider to prepare. A provider estimate that has no known price remains
  selectable and displays its explanation. Each option carries
  `GenerationCostEstimate` unchanged, including warnings, source,
  observation time and request hash. Core's `estimateCastingRoundCost` aggregates
  those estimates by candidate count for both Codex and React. Host plan usage
  bypasses provider estimation. Studio uses the shared estimate view for each
  candidate's cost; the saved round keeps the confirmed total.

## Consequences

- Panels never generate; every round still runs in the agent with the normal
  media skills, importing each candidate as it finishes so the board fills in
  live.
- Existing projects get their active costume variants as costumes under one
  "Main" Look with no scenes; re-running Casting Director splits Looks and
  assigns scenes. Earlier design revisions lose their variants.
- `castMember.delete` refuses while Scene Beats revisions or Looks name the
  Cast Member, so no reference is left dangling.

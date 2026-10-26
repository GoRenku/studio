# 0127 Cast Looks, Costumes And Casting Rounds

Date: 2026-10-23

Status: accepted

Updates [ADR 0064](0064-use-exclusive-asset-membership-and-scoped-selection.md),
[ADR 0118](0118-separate-renku-generation-confirmation-from-host-approval.md)
and [ADR 0125](0125-store-character-arcs-as-one-json-document-per-cast-member.md).
Applies [ADR 0041](0041-keep-ai-artifacts-and-prompts-opaque.md) and
[ADR 0114](0114-describe-models-as-skill-data-in-codex-panels.md).
Implemented by plans 0242, 0244, 0246, 0247 and 0248.

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
  Candidates carry a durable status: candidate (kept) or hidden. Hide is the
  only mark the director makes (plan 0247); hidden candidates leave the
  default views and can be shown again or cast at any time.
- **Casting is a scoped selection.** The new selection target `castLook`
  selects the Look's cast candidate; only a candidate of that Look's own
  rounds may be selected.
- **Costumes are records.** A **Cast Costume** belongs to one Look and lists
  its scenes, wardrobe and continuity notes; a Cast Member wears one costume
  per scene, and a costume's scenes are within its Look's scenes. Cast Design
  keeps only `costume.baseWardrobeLogic`.
- **Character sheets are made in rounds per costume** (plan 0248). A Casting
  Round has one subject: a Look (casting candidates) or a costume (a
  character sheet round). `cast.character-sheet` targets a costume's round,
  and each sheet is linked to it with the same candidate/hidden status as a
  casting candidate. The selection target `castCostume` picks one
  `character_sheet` per costume, only from that costume's rounds; this
  supersedes the ADR 0064 rule that Character Sheets are never selected, for
  this scope only. A sheet round needs its costume's Look to be cast; a
  costume with sheet rounds keeps its Look, and removing it deletes its
  rounds while the sheets stay in Assets. Scene generation context reports
  each Cast Member's Look, costume and picked sheet, and the picked sheet is
  the first, workflow-selected Cast continuity suggestion.
- **One confirmation per round.** The Casting Round panel shows the brief,
  models, counts and estimate; its consumed Generate is the Renku
  confirmation for every image in that round, replacing the Route Chooser and
  per-generation review for casting candidates and character sheets. One
  panel can cover several costumes of one Look: the count is per costume and
  each ticked costume gets its own round. In harnesses without inline panels the round is set up
  as chat text and the user's reply confirms it. The Route Chooser is not
  used for casting rounds.
- **Casting defaults live in Project Settings** (version 10):
  `casting.candidateRoutes` for Look rounds and `casting.characterSheetRoutes`
  (per costume) for sheet rounds, written by the round panel's save box for
  the subject it was opened for, or by `renku settings casting set`. With no
  saved routes a panel opens on the image lane model with 10 candidates or 2
  sheets per costume.
- **Shared arcs are removed.** `characterArcReference` and its delete guard
  are gone; the turning point sheet field is `characterSheetAssetFileId`.
- **Studio stays model-neutral and opaque.** Panels receive model labels and
  one-line strength notes as Skill data, and display Engines estimates.
  Studio never inspects briefs or candidate images. The candidate layout (a
  face close-up beside a full-length figure in one 4:3 image) is a
  Studio-owned output shape described in the media-producer skill.
- **The Studio Casting tab shows one Look at a time** (plan 0246). A row of
  Look cards (picture, name, one status) picks the Look; a text-free scene
  bar lights up its scenes. Once the Look is cast and has costumes, a second
  row shows a Casting card with the cast picture and one card per costume
  with its picked sheet (plan 0248); one box below shows the picked card's
  rounds, with the only Compare button in its header, and the scene bar
  brightens the picked costume's scenes. At most one "Ask your agent" card is on screen,
  for the picked Look's next step; optional follow-ups are a quiet copy line.
  Candidate tiles show their controls on hover or keyboard focus, and the
  image viewer keeps Close alone and puts Hide and Cast (or Pick) in its
  floating zoom pill. Hidden candidates fold away behind "Show N hidden".
- **The Codex sheet board is the casting board for costumes** (plan 0248):
  `casting.board.open` in sheets mode takes a Look, shows its costumes as
  cards and one costume's rounds at a time with Hide, Pick, Compare and "More
  like these". Picks save directly and post no message.
- **Compare is one shared view.** The Codex casting board and the Studio
  Casting tab both open the same Compare over a Look's kept candidates or a
  costume's kept sheets (Pick in place of Cast): two
  equal sides, each stepping on its own past the other side's candidate, so
  one side can stay as the anchor. Each side has its own Hide and Cast; one
  zoom floats over both, side by side or stacked to show both larger.
- **"More like these" uses the kept candidates.** The Codex board's request
  carries every kept candidate of the Look as references for the next round;
  Studio offers the same request as a copy line.
- **Candidates and character sheets have a detail level** (plan 0244):
  `lowest`, `mid` or `highest`. Project casting settings hold
  `candidateDetail` (default `lowest`, since all but one candidate are
  discarded) and `characterSheetDetail` (default `highest`, since sheets are
  identity references). The Default Model List gives each image-lane provider
  route the native fields of every level, as opaque Skill data. The round
  panel opens on the candidate detail, prices every level, and the director
  may change it for one round; consume returns the `detail` the agent
  generates with.
- **Casting reuses the generation estimator and display envelope**
  ([ADR 0128](0128-estimate-generation-cost-from-saved-prices.md)). Codex
  prices every offered model/provider from its Default Model List route at the
  route's defaults; the agent prepares nothing. A provider estimate that has no
  known price remains selectable and displays its explanation. Each option
  carries `GenerationCostEstimate` unchanged, including warnings, source and
  observation time; host plan routes carry the plan usage estimate. Core's
  `estimateCastingRoundCost` aggregates those estimates by candidate count for
  both Codex and React. Studio uses the shared estimate view for each
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

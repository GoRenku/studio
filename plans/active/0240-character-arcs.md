# 0240 Character Arcs

Status: implemented
Date: 2026-10-20

## Decisions

The user accepted every recommendation on the review page on 2026-10-20.

- **Character sheets on cards:** each turning point may name its sheet
  through the optional `lookAssetFileId`, chosen by the agent. Sheets
  attached later are added by rewriting the arcs.
- **Story world row:** left out.
- **Writes:** replace the complete set.
- **"In scene" row:** hidden when the arc's Cast Members have no screenplay
  references.
- **Deleting a referenced arc owner:** fails with
  `CHARACTER_ARC_REFERENCE_IN_USE`.
- **Scope:** everything applies to every project; nothing is specific to
  Sintel or Big Fish.

## Summary

Studio has free-text Want, Need and Arc fields and a story-level Story Arc
chart. It has no structured, scene-anchored view of how a main character
changes.

This plan adds a per-Cast-Member Character Arc JSON document with a
Core-owned JSON Schema. The screenplay-analyst skill writes it alongside each
Screenplay Analysis, and a new Arc tab shows it with the timeline and cards
the user chose.

## Context

- Design study (published privately), approved on 2026-10-20:
  - Option 1 timeline with Option 2's sideways-scrolling cards. Looks
    appear on the cards, not as a timeline row (clarified by the user on
    2026-10-20).
  - Arc tab.
  - Protagonists and key supporting roles only.
  - Young Edward points to Edward.
  - No relationships.
  - JSON per Cast Member, no complex schemas.
  - Analysis is the trigger, and re-analysis updates the arcs.
- Research in the study:
  - The fields that recur across craft methods: want, need, false belief,
    wound, truth held, start and end states, turning points.
  - Flat ("holds firm") arcs change others.
  - Turns are described in words, with a rough position rather than scores.
  - Anchor to scene order, never to dates.
- Decisions:
  - `0072` Hierarchy-Independent Screenplay Analysis.
  - `0073` Keep Screenplay-Derived Artifacts Weak.
  - `0041` AI artifacts and prompts are opaque: Studio validates structure
    and references, never what the arc says.
- `docs/architecture/json-storage-validation.md` and
  `docs/architecture/reference/drizzle-migrations.md`.
- Existing code:
  - `packages/core/src/server/screenplay-analysis/*` (validation and
    freshness patterns);
  - `packages/core/src/server/screenplay/persistence/references.ts` (scene
    presence);
  - `packages/studio/src/features/movie-studio/story-arc/*` (beat labels and
    act bands).
- Sister repo: `studio-skills/skills/screenplay-analyst`.
- Real data:
  - Big Fish (202 scenes): Edward holds firm, Will grows.
  - Sintel (14 scenes, nonlinear).
  - Urban Basilica (has screenplay references).
- Plan 0239 changes the Details tab. This plan only adds a tab beside it.

## Product Behavior

### Who has an arc

A Cast Member has an arc when their arc column holds either:

- **their own arc** (`kind: "characterArc"`), or
- **a reference to another Cast Member's arc** (`kind:
  "characterArcReference"`).

Studio has no separate "main character" flag; the skill decides who gets an
arc. The Arc tab appears exactly when the Cast Member has one of the two.

### Arc tab

- **Header:**
  - name (30px, weight 800);
  - role (muted);
  - the arc type chip;
  - the "Interpretation" label;
  - "Needs refresh" with the help text "Screenplay changed since these arcs
    were written." when stale.
- **Shared arc.** For a reference, the line "Shared with <owner name>" links
  to the owner's Cast page. Everything below shows the owner's arc.
- **Starts → Ends** cards.
- **Key fields row.** Four columns from the arc's `spine`, each with scene
  chips ("Sc 31").
  - Changing arcs show Wants, Needs, False belief, Old wound.
  - Holds-firm arcs show Wants, Truth they hold, Tested by, Changes others.
  - Missing optional fields are omitted.
- **Timeline** (inline SVG, scene order on x):
  - **Act bands**, from the active analysis's `actSegments`.
  - **Beat labels**, from the analysis's `keyBeats`, using the Story Arc
    labels (Hook, Inciting Incident, First Turn, Midpoint, Crisis, Climax,
    Resolution). The pinch points are not shown, matching Story Arc's
    primary beats.
  - **"In scene" row:** speaks (bright) or present or mentioned (dim). It is
    hidden when no references exist for these Cast Members.
  - **Arc row:** the high end's words at the top and the low end's words at
    the bottom of the left label column.
    - It is a staircase line through the turning points, since a state holds
      until the next turn.
    - Numbered markers are nudged apart when closer than 26px, with a faint
      leader line to the true scene.
  - **Scene axis:** only act starts, beat scenes and the last scene, with
    labels that would collide skipped.
  - **Hover:** the scene heading and the turning point's text (SVG `title`).
  - **Without an active analysis**, there are no act bands or beat labels;
    the scene axis still comes from the current screenplay.
- **Cards:**
  - One per turning point, in a single sideways-scrolling row (Option 2),
    grouped under act names, or one group with no analysis.
  - Cards are 228px wide.
  - Each card shows:
    - **the look, when the turning point names a character sheet:** the
      whole sheet image (16:9, contained, never cropped, because Studio does
      not interpret sheet contents), with the sheet's asset title under it.
      With no sheet, the card starts with its number;
    - the number and scene chip;
    - the label and state;
    - the quote, in italics, if present;
    - a shift line ("▲ turns toward '<high end>'" or "▼ turns toward
      '<low end>'"), omitted for the first card and when the position is
      unchanged;
    - a slider with the dot at `position` and both end labels.

### Writing arcs (CLI)

`renku cast arc write --file arcs.json` replaces the complete set in one
transaction:

- the listed Cast Members get the given arc;
- every other Cast Member's arc is cleared;
- each touched member's updated time is set.

It emits the Studio resource keys `surface:castMember:<id>` for every Cast
Member whose arc changed, plus `character-arcs`.

### Deleting a Cast Member

A `castMember.delete` whose target owns an arc that another Cast Member
references fails with `CHARACTER_ARC_REFERENCE_IN_USE`. The error names the
referencing Cast Members and suggests re-running the analysis.

## Worked Examples

These are the arcs shown on the user's review page, written as stored
documents. They come from a full read of the Big Fish screenplay (202 scenes;
quotes checked against the script) and from Sintel's cast records.
`<scene N>` stands for the real scene id of production scene N. They are
examples only; nothing in Studio or the skill is specific to these films.

### Will Bloom: a changing arc (`positiveChange`, shown as "Grows")

```json
{
  "kind": "characterArc",
  "arcType": "positiveChange",
  "startState": "His father’s stories are lies that hide who he really is.",
  "endState": "The stories are who his father is, and Will can tell them himself.",
  "ends": {
    "high": "The stories are who he is",
    "low": "The stories are lies"
  },
  "spine": {
    "want": {
      "text": "The true versions of things: events, stories, his father.",
      "sceneIds": [
        "<scene 31>"
      ]
    },
    "need": {
      "text": "To accept his father on his own terms and become a storyteller himself.",
      "sceneIds": [
        "<scene 31>",
        "<scene 193>"
      ]
    },
    "falseBelief": {
      "text": "The stories hide the real man; maybe there is a second family.",
      "sceneIds": [
        "<scene 117>",
        "<scene 118>"
      ]
    },
    "wound": {
      "text": "His father was gone more than he was home, and he felt a fool for believing.",
      "sceneIds": [
        "<scene 31>",
        "<scene 117>"
      ]
    }
  },
  "turningPoints": [
    {
      "sceneIds": [
        "<scene 2>"
      ],
      "label": "Wide-eyed little believer",
      "state": "Age 3, enthralled by the fish tale.",
      "position": 4
    },
    {
      "sceneIds": [
        "<scene 3>",
        "<scene 4>"
      ],
      "label": "Bored, then embarrassed",
      "state": "Has heard it all: “Make him stop.”",
      "position": -2
    },
    {
      "sceneIds": [
        "<scene 5>",
        "<scene 6>"
      ],
      "label": "Wedding toast rupture",
      "state": "Furious at being a footnote; three years of silence.",
      "position": -5,
      "quote": "I am a footnote in that story."
    },
    {
      "sceneIds": [
        "<scene 14>"
      ],
      "label": "Flies home",
      "state": "Chemo stopped. Duty pulls him back; the rift is intact.",
      "position": -4
    },
    {
      "sceneIds": [
        "<scene 31>"
      ],
      "label": "Asks for the true versions",
      "state": "Wants facts before his father dies.",
      "position": -4,
      "quote": "I’d just like to know the true versions of things."
    },
    {
      "sceneIds": [
        "<scene 117>",
        "<scene 118>"
      ],
      "label": "The confrontation",
      "state": "Lowest point: “You tell lies.” Suspects a second life.",
      "position": -5
    },
    {
      "sceneIds": [
        "<scene 121>"
      ],
      "label": "The war telegram is real",
      "state": "First proof that some of the tales were true.",
      "position": -2
    },
    {
      "sceneIds": [
        "<scene 134>",
        "<scene 141>",
        "<scene 142>"
      ],
      "label": "The deed leads to Spectre",
      "state": "Investigates; accuses Jenny of an affair.",
      "position": -3
    },
    {
      "sceneIds": [
        "<scene 167>"
      ],
      "label": "Jenny’s truth",
      "state": "The second-family fear dissolves.",
      "position": 1
    },
    {
      "sceneIds": [
        "<scene 179>",
        "<scene 180>"
      ],
      "label": "The real birth story",
      "state": "The plain truth is dull; he starts listing the stories.",
      "position": 3
    },
    {
      "sceneIds": [
        "<scene 181>",
        "<scene 193>"
      ],
      "label": "Tells his father’s death",
      "state": "Becomes the storyteller; Edward dies happy.",
      "position": 5,
      "quote": "You become what you always were. A very big fish."
    },
    {
      "sceneIds": [
        "<scene 197>",
        "<scene 201>"
      ],
      "label": "The tale people are real",
      "state": "Karl and the twins exist; his own son retells the stories.",
      "position": 5
    }
  ]
}
```

What the Arc tab shows for this document:

- **Header:** the chip "Grows", Starts → Ends, and the four key fields
  (Wants, Needs, False belief, Old wound), each with its scene chips.
- **Arc line:** it starts high at scene 2 (the little believer), drops to the
  low end by scenes 5–6, stays low through the scene 117–118 confrontation,
  then climbs from scene 121 to the top at scenes 181–193.
- **Cards:** 12, grouped Act I (1–5), Act II (6–9) and Act III (10–12),
  using the active analysis's act scene lists.

### Edward Bloom: a holds-firm arc (`flat`, shown as "Holds firm")

The spine uses `truthHeld`, `testedBy` and `changesOthers` instead of `need`,
`falseBelief` and `wound`:

```json
{
  "kind": "characterArc",
  "arcType": "flat",
  "startState": "Telling your life as a story is being yourself.",
  "endState": "Unchanged; his son carries the story on.",
  "ends": {
    "high": "Certain of his story",
    "low": "Lost without it"
  },
  "spine": {
    "want": {
      "text": "A life as big as he is: a giant man can’t have an ordinary-sized life.",
      "sceneIds": [
        "<scene 35>"
      ]
    },
    "truthHeld": {
      "text": "Living your story is being yourself; courage beats fear; Sandra is his destiny.",
      "sceneIds": [
        "<scene 118>"
      ]
    },
    "testedBy": {
      "text": "Will’s demand for facts, and his own death arriving without a story.",
      "sceneIds": [
        "<scene 118>",
        "<scene 181>"
      ]
    },
    "changesOthers": {
      "text": "Will, Jenny, Karl, Norther Winslow, Amos and the town of Spectre.",
      "sceneIds": [
        "<scene 47>",
        "<scene 88>",
        "<scene 151>",
        "<scene 167>",
        "<scene 193>"
      ]
    }
  }
}
```

His turning points stay at positions 4–5, except two dips:

| Scenes | Turning point | Position |
|---|---|---|
| 76–95 | "Loses Sandra, refuses to quit" | 2 |
| 181 | "'Tell me how it happens'", scared and lost without his story | −2 |

On the chart this reads as a flat line with one deep dip. That shape is the
point of a holds-firm arc.

### Young Edward Bloom: a shared arc

```json
{ "kind": "characterArcReference", "castMemberId": "<Edward Bloom's cast id>" }
```

His Arc tab shows Edward's full arc, with "Shared with Edward Bloom" linking
to Edward's page. The "In scene" row is the union of both Cast Members'
scenes.

### Sintel: a disillusionment arc in a nonlinear film

```json
{
  "arcType": "disillusionment",
  "ends": {
    "high": "Open, caring",
    "low": "Hardened by the hunt"
  }
}
```

- **Shape:** her 12 turning points start low at scenes 1–2 (the present-day
  quest), rise through the remembered past (scenes 3–6), fall through the
  quest (scenes 8–13), and recover slightly at scene 14.
- **Order:** the chart stays in screenplay scene order, never in-story
  chronology.

### The write document the skill sends

```json
{
  "kind": "characterArcs",
  "arcs": [
    { "castMemberId": "<Edward Bloom>", "arc": { "kind": "characterArc", "arcType": "flat", "…": "…" } },
    { "castMemberId": "<Will Bloom>", "arc": { "kind": "characterArc", "arcType": "positiveChange", "…": "…" } },
    { "castMemberId": "<Young Edward Bloom>", "arc": { "kind": "characterArcReference", "castMemberId": "<Edward Bloom>" } }
  ]
}
```

With replace-all, every other Cast Member's arc is cleared by this write.

## Architecture Shape Gate

### Ownership

- **Core** owns:
  - the schema, the semantic rules and persistence;
  - the replace-all write;
  - resolving references, presence, act and beat structure, and freshness
    for the read resource.
- **The CLI** reads the file, calls Core and prints the result.
- **The Studio server route** reads params, calls Core and serializes the
  result.
- **Studio React** only renders the resource.
- **The skill** owns who gets arcs and how to write them well.

### File layout

**Core, browser-safe** (`packages/core/src/client/character-arcs/`):

- `model.ts` holds these types:
  - `CharacterArcType`
  - `CharacterArc`
  - `CharacterArcReference`
  - `CharacterArcDocument` (the union)
  - `CharacterArcSpine`
  - `CharacterArcSpineField`
  - `CharacterArcTurningPoint`
  - `CharacterArcsWriteDocument`
  - `CharacterArcsWriteReport`
  - `CastMemberCharacterArcResource`
- `schemas.ts` holds `characterArcDocumentSchema` and
  `characterArcsWriteDocumentSchema`.
- `client/index.ts` exports them; no new barrel.

**Core, server** (`packages/core/src/server/character-arcs/`):

| File | What it owns |
|---|---|
| `validation.ts` | The AJV shape check, then the semantic checks. Collects every issue. |
| `persistence.ts` | Reading and writing the two columns, plus read-back validation. The only module that touches them. |
| `commands.ts` | `validateCharacterArcs`, `writeCharacterArcs`, `listCharacterArcs`, `readCharacterArc` |
| `resource.ts` | `readCastMemberCharacterArcResource`: resolves the reference, then assembles the resource |
| `presence.ts` | Scene presence for a set of Cast Member ids, from screenplay references |
| `story-structure.ts` | Act segments and key beats from the active analysis, through the analysis persistence read, not its internals |
| `freshness.ts` | Compares `readLatestScreenplayRevisionSummary` with the arc's updated time |

**Core, other files:**

- `server/schema/cast-members.ts`: one nullable `character_arc` column storing
  `{ writtenAt, arc }`. This replaces the earlier two-column design, because a
  both-or-neither CHECK would have forced a SQLite rebuild of `cast_member`.
- Migration: `drizzle/<next>_cast_member_character_arc.sql`, generated by
  `drizzle-kit generate --name cast_member_character_arc`, plus the
  `user_version` bump.
- `server/commands/cast-commands.ts`: the delete-guard call into
  `character-arcs/persistence.ts`. One focused check, no arc logic inline.
- Service wiring: `server/project-data-service-wiring/` gains a
  `character-arcs.ts` wiring file, following the existing screenplay wiring
  shape.
- `screenplay-analysis/context.ts`: each cast entry gains `characterArc`
  (the document or `null`).

**CLI:** `packages/cli/src/commands/cast-arc-command.ts` holds the `arc`
subcommand group (validate, write, list, show, schema). `cast-command.ts`
only delegates to it, the way it already handles `design`.

**Studio server:** `packages/studio/server/routes/continuity.ts` gains one
thin handler for `GET /continuity/cast/:castMemberId/arc`.

**Studio client:**

- `services/studio-continuity-api.ts`: `readCastMemberCharacterArc`.
- `services/studio-project-contracts.ts`: `CastMemberCharacterArcResponse`.
- `features/movie-studio/cast/arc/`:

| File | What it owns |
|---|---|
| `cast-member-arc-tab.tsx` | Loads the resource and composes the parts below |
| `character-arc-summary.tsx` | Header, shared line, Starts and Ends, key fields |
| `character-arc-timeline.tsx` | The SVG rows |
| `character-arc-timeline-model.ts` | Pure layout: x by scene, dodge, staircase path, axis ticks, label stacking |
| `character-arc-turning-points.tsx` | The sideways card row, with look images |
| `character-arc-copy.ts` | Arc-type labels and spine field labels (UI copy) |

- `features/movie-studio/story-arc/story-structure-labels.ts` (new): the beat
  labels and the primary beat keys, moved out of `story-arc-chart-model.ts`.
  Both charts import from it, and the Story Arc imports are updated directly.
- `cast/cast-member-panel.tsx` adds the Arc tab when
  `resource.characterArc` is not `null`.
- `hooks/use-studio-resource-refresh.ts` reuses `matchesCastMemberResource`.

**`CastMemberResource` gains `characterArc`.** This small summary decides
whether the tab shows; the timeline itself loads from the arc route. It is
one of:

- `null`;
- `{ kind: 'own' }`;
- `{ kind: 'shared', ownerCastMemberId, ownerName }`.

### Bounded branches

- **Arc type.** It affects only which spine labels show and the chip text.
  That is a lookup table in `character-arc-copy.ts`, not branching JSX.
- **Own versus shared.** It is resolved once in Core's `resource.ts`; the UI
  receives the owner's arc plus an optional `sharedWith`.
- **Validation.** Semantic checks are a list of small check functions run in
  sequence, not one long function.

### Forbidden shapes

- No new tables for beats or spine fields.
- No reading of the arc columns outside `character-arcs/persistence.ts`.
- No React or route-level arc rules (who has an arc, reference resolution,
  presence).
- No generating, scoring, rewriting or checking of arc text in Studio.
- No numeric "emotion" axis labels in the UI; the y-axis shows only the two
  worded ends.
- No copy of the schema inside studio-skills; skills read it with
  `renku cast arc schema`.
- No re-export shims for the moved Story Arc labels.

### Stop conditions

Stop and revise if:

- `resource.ts` starts holding validation or persistence;
- `character-arc-timeline.tsx` starts computing layout instead of using the
  model;
- the cast commands file gains more than the single delete-guard call;
- anyone proposes storing arcs inside the Screenplay Analysis document.

## Contracts

### Character Arc document (stored and written)

```json
{
  "kind": "characterArc",
  "arcType": "positiveChange",
  "startState": "His father's stories are lies that hide who he really is.",
  "endState": "The stories are who his father is, and Will can tell them himself.",
  "ends": {
    "high": "The stories are who he is",
    "low": "The stories are lies"
  },
  "spine": {
    "want": { "text": "The true versions of things.", "sceneIds": ["scene_…"] },
    "need": { "text": "…", "sceneIds": ["scene_…"] },
    "falseBelief": { "text": "…", "sceneIds": ["scene_…"] },
    "wound": { "text": "…", "sceneIds": ["scene_…"] }
  },
  "turningPoints": [
    {
      "sceneIds": ["scene_…", "scene_…"],
      "label": "Wedding toast rupture",
      "state": "Furious at being a footnote; three years of silence.",
      "position": -5,
      "quote": "I am a footnote in that story."
    }
  ]
}
```

```json
{ "kind": "characterArcReference", "castMemberId": "cast_…" }
```

**Shape rules** (`characterArcDocumentSchema`, `oneOf` on `kind`, all objects
closed):

- `arcType` is one of `positiveChange`, `flat`, `disillusionment`, `fall`,
  `corruption`. The UI shows Grows, Holds firm, Disillusioned, Falls,
  Corrupted.
- **Strings:** `startState`, `endState`, `ends.high`, `ends.low`, spine
  `text`, `label` and `state` are non-empty. `quote` is optional and
  non-empty when present.
- **Spine:**
  - `spine` keys are `want`, `need`, `falseBelief`, `wound`, `truthHeld`,
    `testedBy` and `changesOthers`;
  - each spine field has `text` plus `sceneIds`, with at least one id;
  - `want` is required.
- **Turning points:**
  - `turningPoints` has at least 2 items;
  - each has `sceneIds` (at least one), `label`, `state`, and an integer
    `position` from −5 to 5;
  - `quote` is optional;
  - `lookAssetFileId` is optional: the character sheet that shows this
    moment.

**Semantic rules** (Core, every issue collected):

- **Spine by arc type:**
  - `flat` requires `truthHeld` and must not have `falseBelief`;
  - every other arc type requires `need` and `falseBelief`.
- **Scenes:**
  - every `sceneIds` entry exists in the current screenplay;
  - within one turning point, scene ids are in screenplay order;
  - turning points are in non-decreasing order of their first scene.
- **Looks:**
  - `lookAssetFileId` names an existing, not-discarded asset of type
    `character_sheet`;
  - it is owned by the arc's Cast Member or by a Cast Member whose arc
    references it in the same document, so Young Edward's sheets can appear
    on Edward's shared arc;
  - Studio checks only that relationship, never the image contents.
- **References:**
  - a reference cannot target the Cast Member itself;
  - the target must have `kind: "characterArc"` in the same write document,
    so there are no chains.

### Write document (CLI input)

```json
{
  "kind": "characterArcs",
  "arcs": [
    { "castMemberId": "cast_…", "arc": { "kind": "characterArc", "…": "…" } },
    { "castMemberId": "cast_…", "arc": { "kind": "characterArcReference", "castMemberId": "cast_…" } }
  ]
}
```

- `castMemberId` values are unique and must exist.
- An empty `arcs` list clears every arc.

### CLI

| Command | What it does |
|---|---|
| `renku cast arc schema [--json]` | Prints `characterArcsWriteDocumentSchema` (which includes the arc schema) |
| `renku cast arc validate --file <f\|-> [--project] [--json]` | Shape and semantic check, with no write |
| `renku cast arc write --file <f\|-> [--project] [--json]` | Replace-all write; returns `CharacterArcsWriteReport { written, cleared, changes, resourceKeys }` |
| `renku cast arc list [--project] [--json]` | Lists Cast Members with arcs: id, name, kind, arc type, updated time, freshness |
| `renku cast arc show --cast <id> [--project] [--json]` | Prints the stored document and freshness |

### Read resource

```
CastMemberCharacterArcResource {
  castMember: { id, name, role? }
  arc: CharacterArc
  sharedWith: { ownerCastMemberId, ownerName } | null
  scenes: { id, productionNumber?, heading, title? }[]   // current screenplay order
  presence: { sceneId, speaks: boolean }[]               // owner + referencing members; speaker role → speaks
  structure: { actSegments: { role, title, sceneIds }[], keyBeats: { key, sceneId? }[] } | null
  looks: { assetFileId, title?, file: StudioAssetFileResponse-compatible image }[]   // only sheets named by turning points
  freshness: 'current' | 'needsRefresh'
}
```

### Diagnostics

| Code | When |
|---|---|
| `CHARACTER_ARC_INVALID` | Shape or semantic issues on validate or write, with all issues and their locations |
| `CHARACTER_ARC_STORED_INVALID` | Stored JSON fails the schema on read |
| `CHARACTER_ARC_NOT_FOUND` | `show` or the route for a Cast Member with no arc |
| `CHARACTER_ARC_REFERENCE_IN_USE` | A delete is blocked by a reference |

## Implementation Slices

1. **Core contract and storage.**
   - Add the client model and schemas, the schema columns and the generated
     migration.
   - Add `persistence.ts` and `validation.ts`, with tests.
2. **Core commands and resource.**
   - Add `commands.ts`, `presence.ts`, `story-structure.ts`, `freshness.ts`
     and `resource.ts`.
   - Add the service wiring, the `CastMemberResource.characterArc` summary,
     the delete guard and the analysis context field.
3. **CLI.** Add `cast-arc-command.ts` and the delegation in
   `cast-command.ts`, and update `docs/cli/commands.md`.
4. **Studio server and service.** Add the route, the contract type and the
   API function.
5. **Shared labels.**
   - Move the beat labels and primary beat keys into
     `story-structure-labels.ts`.
   - Update the Story Arc imports, removing the duplicate `formatBeatRole`
     only if it is the same labels table.
6. **Arc tab UI.**
   - Add the timeline model with tests, the timeline, the summary, the cards
     and the tab composition.
   - Add the tab to the cast panel.
7. **Skill (studio-skills repo):**
   - `screenplay-analyst/SKILL.md`: after `analyze write`, select the
     protagonists and key supporting roles.
   - Treat age variants of one person as one arc owner plus references.
   - Read the schema with `renku cast arc schema`.
   - Author, then run `renku cast arc validate`, then `write`.
   - Report what was written and cleared.
   - New `references/character-arc-guidance.md` covers:
     - choosing the arc type;
     - want versus need;
     - false belief versus truth held;
     - "changes others" for holds-firm arcs;
     - 6–14 turning points in words;
     - position as a rough place between the two ends;
     - short quotes only;
     - citing scenes for every field;
     - never inventing scenes;
     - picking `lookAssetFileId`: list the character's sheets with
       `renku asset list --owner cast:<id> --type character_sheet --json`,
       and choose the sheet whose look matches each turning point. Leave it
       out when no sheet fits.
   - New `references/character-arc-cli-workflow.md`.
   - `casting-director` and `media-producer`: after attaching new character
     sheets to a Cast Member who has an arc, read the current arcs
     (`renku cast arc list --json`, then `show`), add the matching
     `lookAssetFileId`s, and rewrite the complete set.
   - New `samples/character-arcs.json` (Urban Basilica scene ids).
   - New `evals/character-arcs.md` (Big Fish: Edward holds firm and Will
     grows; Young Edward references Edward).
   - Update the `movie-director` routing note.
8. **Docs.**
   - ADR `docs/decisions/0125-store-character-arcs-as-one-json-document-per-cast-member.md`.
   - `docs/architecture/data-model-and-storage.md` (the Character Arc
     concept).
   - `docs/architecture/reference/domain-vocabulary.md` (Character Arc,
     Turning Point, Arc Ends).
   - `docs/architecture/reference/studio-skills.md`.
   - `docs/architecture/architecture-test-registry.md` (the new static
     check).

## Tests And Guardrails

**Core** (`character-arcs/*.test.ts`):

- Shape errors for each field.
- The flat versus change spine rules.
- Unknown scene and Cast Member ids.
- Self and chained references.
- Out-of-order turning points.
- `lookAssetFileId`: unknown, discarded, wrong type, and owned by an
  unrelated Cast Member all fail; a sheet owned by a referencing Cast
  Member passes.
- All issues are collected in one response.
- Replace-all clears unlisted members and reports `cleared`.
- Stored corruption fails with `CHARACTER_ARC_STORED_INVALID`.
- The delete guard.
- Resource:
  - resolves references;
  - presence is the union of owner and referencing members, with the
    speaker role meaning "speaks";
  - structure is `null` with no active analysis;
  - freshness flips after a new screenplay revision.

**Migration:** the generated column add, plus the `user_version` bump.

**CLI** (`cli-workflows.test.ts`): `schema`, then `validate`, `write`, `list`
and `show`. The write emits resource events.

**Studio:**

- `character-arc-timeline-model.test.ts`: x positions, dodge spacing,
  staircase path, axis tick collision, beat label stacking.
- `cast-member-panel.test.tsx`:
  - no Arc tab without an arc;
  - own arc;
  - shared arc with its link;
  - the stale badge;
  - the hidden "In scene" row without references.

**Architecture:**

- A static check in `packages/core/src/server/architecture.test.ts`: no
  production module outside `character-arcs/` reads the
  `character_arc` column.
- Studio import-boundary tests keep passing.
- All tests use fictional or Urban Basilica data. Big Fish appears only in
  the skill eval.

## Documentation

- ADR 0125 (new).
- `docs/architecture/data-model-and-storage.md`.
- `docs/architecture/reference/domain-vocabulary.md`.
- `docs/cli/commands.md`.
- `docs/architecture/reference/studio-skills.md`.
- `docs/architecture/architecture-test-registry.md`.
- The studio-skills `screenplay-analyst` and `movie-director` files.
- The studio-skills plugin version is bumped in that repo's release step.

## Final Verification

- Run `pnpm build`, `pnpm test`, `pnpm lint` and `pnpm check`.
- Back up the databases, then run `renku project migrate` on Sintel, Big Fish
  and Urban Basilica.
- Run the updated screenplay-analyst skill on Big Fish. If Big Fish can't be
  analyzed yet, use Urban Basilica for the Studio checks and run only the
  arc-writing steps against Big Fish's scene ids. Then check:
  - Edward shows a holds-firm arc;
  - Will shows a growing arc;
  - Young Edward shows "Shared with Edward Bloom";
  - minor characters have no Arc tab.
- Change one scene, and confirm "Needs refresh" appears on the Arc tab and
  in `renku cast arc list`.
- **Architecture-shape review:**
  - inspect `git diff --stat`;
  - confirm `cast-command.ts` only delegates;
  - confirm `resource.ts`, `validation.ts` and `persistence.ts` stay
    separate;
  - confirm the timeline component has no layout math;
  - confirm `index.ts` files only gained exports;
  - confirm no formatting churn.

## Completion Checklist

### Review Area

- [ ] The Decisions section is followed.
- [ ] The final module shape matches the Architecture Shape Gate.
- [ ] No god file, broad dispatcher or catch-all helper.

### Architecture And Contracts

- [ ] `characterArcDocumentSchema` and `characterArcsWriteDocumentSchema` are
      in `client/character-arcs/schemas.ts`, with AJV on write and read.
- [ ] One nullable `character_arc` column (`{ writtenAt, arc }`); one generated
      migration with the `user_version` bump.
- [ ] The semantic rules are in Core, with every issue collected and the
      structured codes listed in Contracts.
- [ ] Replace-all write in one transaction, emitting resource keys.
- [ ] Studio routes and React hold no arc rules.

### Implementation Slices

- [ ] Slice 1: contract, schema, columns, migration, persistence,
      validation.
- [ ] Slice 2: commands, presence, structure, freshness, resource, wiring,
      delete guard, analysis context.
- [ ] Slice 3: CLI `cast arc` subcommands in their own file.
- [ ] Slice 4: Studio route, contract and service.
- [ ] Slice 5: shared beat labels moved, with no shim.
- [ ] Slice 6: Arc tab (summary, timeline model and view, sideways card row
      with look images).
- [ ] Slice 7: screenplay-analyst skill guidance, workflow, sample and eval.
- [ ] Slice 8: docs and ADR 0125.

### Tests And Guardrails

- [ ] Core validation, write, resource, freshness and delete-guard tests.
- [ ] Migration test.
- [ ] CLI workflow test.
- [ ] Timeline model and panel tests.
- [ ] Static check that only `character-arcs/` reads the arc column.

### Documentation

- [ ] ADR 0125, data model, domain vocabulary, CLI commands, skills
      reference and test registry are updated.
- [ ] The studio-skills changes ship with the CLI contract.
- [ ] No historical plans edited for naming.

### Final Verification

- [ ] `pnpm build`, `pnpm test`, `pnpm lint` and `pnpm check` pass.
- [ ] The real projects migrate. The skill run produces holds-firm, growing
      and shared arcs.
- [ ] The "Needs refresh" state is verified after a screenplay change.
- [ ] `git diff --stat` is reviewed, and the large or heavily changed files
      are inspected.
- [ ] `index.ts` files remain thin entrypoints.
- [ ] No checklist item was satisfied by accepting an unreviewable structure.

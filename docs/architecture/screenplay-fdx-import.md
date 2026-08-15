# Source-Authoritative Final Draft FDX Import

Date: 2026-08-15

Status: current

Role: architecture and compatibility reference

## Boundary

`renku screenplay import-fdx` imports and continuously refreshes one bounded
semantic subset of Final Draft XML. The FDX is the sole authority for an
FDX-backed Screenplay: Renku cannot edit its opening, Scenes, dialogue,
references, or organization. Core owns validation, parsing, flat canonical
mapping, source retention, exact content identity, and atomic replacement. The
CLI only passes input and formats Core's typed report.

Every FDX import is a flat, source-ordered Scene list. Final Draft planning and
formatting paragraphs are not a portable narrative hierarchy, so they never
create Renku Act or Sequence Sections. Unknown visible screenplay content fails
rather than being dropped or guessed.

## Canonical Content

| FDX content | Canonical result |
| --- | --- |
| Supported text before the first Scene Heading | `Screenplay.opening` text blocks |
| Scene Heading and optional `Number` | Scene `heading` and exact optional `productionNumber` |
| Action, Transition, Shot, Lyrics, Cast List, Special Heading, Title/Title Card, Super | Matching canonical text block |
| General | Recognized opening fade form to Transition; otherwise Action, with an internal normalization log entry |
| Character followed by Parenthetical/Dialogue paragraphs | One ordered Dialogue turn with cue extensions separated |
| Direct DualDialogue, its common General wrapper, or supported `DualDialogue="Yes"` cue form | One Dual Dialogue block with two independent turns |
| Visible Dialogue without a preceding Character inside a Scene | Action preserving the displayed text without inventing a speaker |
| Multiple styled Text runs and XML entities | One exact plain-text value in source order |

FDX Scene `Number` attributes are opaque. Their exact string values are carried
into `Scene.productionNumber`; the importer does not trim, parse, validate,
deduplicate, or use them for ordering or identity.

Parentheticals keep semantic order; one conventional outer pair of parentheses
is removed because the renderer supplies screenplay notation. Empty Dialogue
and Parenthetical artifacts carry no visible semantics and are ignored.
Dialogue before the first Scene, orphan Parenthetical, malformed Dual Dialogue,
and a file without a Scene Heading are errors.

## Retained-Only Final Draft Data

`New Act`, `End of Act`, `Sequence`, `Summary`, `Outline 1`, `Outline 2`,
`Outline 3`, `Note`, `ScriptNote`, and `Script Note` paragraphs create no
canonical content, Section, structure entry, candidate, or warning. Formatting,
fonts, margins, pagination, Title Page layout, revision presentation, scene
colors, Outline/Beat Board metadata, editor state, and inert proprietary data
outside `Content` also remain only in the retained source bytes.

The mapper never looks at prose to infer structure. For example, an Action or
General paragraph containing `ACT ONE` stays an Action block. It does not become
an Act and it is available to analysis only as ordinary canonical prose.

The importer creates no Cast Member, Location, Prop, or Screenplay reference.
Character cues, Scene Headings, and supported tag evidence are non-authoritative
candidates for later agent or user work. The FDX read-only gate prevents those
candidates from being written back as Screenplay references.

## Source Authority And Refresh

The same command handles initial import and later refresh:

- first import validates and stores the exact source, flat aggregate, import
  record, and first Screenplay revision;
- an identical exact source SHA-256 returns `unchanged`, emits no resource keys,
  and writes no database row, revision, or file;
- a changed source whose canonical Screenplay is equal retains the new exact
  source and advances only the import pointer, with no Screenplay revision or
  resource keys; and
- a changed canonical Screenplay is accepted automatically and atomically
  replaces the complete aggregate, advances the source pointer, and creates one
  Screenplay revision.

There is no diff, destructive-change preview, approval token, partial merge, or
conflict policy because Renku has no editable copy to reconcile. A valid source
may add, remove, reorder, or change any canonical content.

Core hashes each complete canonical Scene value without IDs. If the same exact
hash occurs once on both sides of a changed import, the entire existing Scene
graph is reused. A changed Scene receives a completely new Scene graph,
including all nested Block, Dialogue Turn, and Dialogue Part IDs. Duplicate
equal Scene hashes are ambiguous and receive new identities; Core makes no
heading, number, position, neighbor, or fuzzy-text guess.

Analysis reads the canonical database projection, never the retained FDX XML.
Because FDX projection always has `sections: []`, analysis receives
`sourceActMode: 'flat'` and owns its three analytical segments. Final Draft
planning markers cannot supply source Acts.

## Read-Only And Downstream Work

Core uses the singleton `screenplay_import` row as the shared ownership gate for
Screenplay create/apply, opening, Scene, Section, reference, dialogue-affecting,
and revision-restore mutations. Reads, analysis, Scene Beats, Shot planning,
dialogue audio, and other downstream workflows remain available.

Those downstream artifacts keep weak historical Scene and Block IDs. A refresh
does not inspect, rewrite, delete, cascade, or block on them. They remain
readable as history and may be marked stale by existing current-context rules.

## Safety And Persistence

- Source size is checked before UTF-8 decoding and tree parsing.
- Document types and custom entities are rejected; parsing performs no network
  or external DTD resolution.
- Fixed depth, paragraph, attribute, node-text, and aggregate semantic-text
  limits bound the parsed tree.
- SHA-256 is calculated from exact original bytes.
- Proposed IDs derive from importer version, source SHA-256, and deterministic
  semantic source paths; FDX `UUID` and `Id` attributes are not identities.
- Unknown/custom visible paragraph types fail with
  `SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT`, including their paragraph type
  and stable FDX path.

The exact source is a Project-owned `screenplay_source` Asset with media kind
`document`, file role `source`, MIME type `application/xml`, and a path under
`screenplay/`. `screenplay_import` points to the latest accepted Asset/File and
stores importer version, commit timestamp, and the closed developer-only
normalization log. Earlier accepted source Assets remain immutable history.
If a later refresh returns to exact earlier bytes, Core reuses that verified
immutable source Asset/File; a missing or mismatched historical file fails
without advancing the current pointer.

The complete canonical aggregate is validated before persistence. Source
retention, Asset/File metadata, aggregate replacement, import-pointer update,
and revision insertion use the existing SQLite transaction and Project Asset
file write-set boundary. A failure keeps the previous source pointer, aggregate,
and current revision. Canonical runtime reads query SQLite only.

## Fixture Provenance

The Core `representative.fdx` fixture is synthetic and MIT-licensed. It exercises
the supported parser/mapper subset, including planning paragraphs that must be
retained-only; it is not evidence of a universal Final Draft hierarchy.

Real-world E2E inputs are third-party interoperability and stress fixtures from
Fountain's published FDX downloads. Studio pins source URLs, byte lengths, and
SHA-256 identities and caches them outside the repository. They exercise the
production CLI, Core import, exact source retention, and browser renderer
without becoming bundled product samples or an official Final Draft conformance
suite.

# Deterministic Final Draft FDX Import

Date: 2026-08-06

Status: current

Role: architecture and compatibility reference

## Boundary

`renku screenplay import-fdx` imports one bounded semantic subset of Final
Draft XML into an empty Scene-first Screenplay. Core owns source validation,
XML parsing, mapping, deterministic IDs, canonical validation, source-Asset
retention, and the atomic transaction. CLI only resolves the Project, passes
`--file`, and formats Core's report.

This is not a universal Final Draft compatibility promise. Unknown visible
screenplay content fails rather than being dropped or guessed.

## Supported Semantic Content

| FDX content | Canonical result |
| --- | --- |
| Content before the first Scene Heading | `Screenplay.opening` text blocks |
| Scene Heading and optional `Number` | Scene `heading` and exact optional `productionNumber` |
| Action, Transition, Shot, Lyrics, Cast List, Note, Special Heading, Title/Title Card, Super | Matching canonical text block |
| General | Recognized opening fade form to Transition; otherwise Action, with an internal normalization log entry |
| Character followed by Parenthetical/Dialogue paragraphs | One ordered Dialogue turn with cue extensions separated |
| Direct DualDialogue, a DualDialogue inside its common General paragraph wrapper, or supported `DualDialogue="Yes"` cue form | One Dual Dialogue block with two independent turns |
| Visible Dialogue without a preceding Character inside a Scene | Action preserving the displayed/insert text without inventing a speaker |
| New Act, Sequence, End of Act | Optional explicit Section/structure entries |
| Multiple styled Text runs and XML entities | One exact plain-text value in source order |

FDX Scene `Number` attributes are opaque. Their exact string values are carried
into `Scene.productionNumber`; the importer does not trim, parse, validate, or
deduplicate them.

Parentheticals keep semantic order; one conventional outer pair of parentheses
is removed because the renderer supplies screenplay notation. Empty Dialogue
and Parenthetical artifacts carry no visible semantics and are ignored. Dialogue
before the first Scene, orphan Parenthetical, malformed Dual Dialogue, untitled
explicit Sections, and a file without a Scene Heading are errors.

## Deliberate Exclusions

Formatting, fonts, margins, alignment, pagination, Title Page layout,
ScriptNotes, revision presentation, scene colors, editor state, and inert
proprietary data outside `Content` do not enter canonical data, reports, or the
technical log. Their bytes remain unchanged in the retained source.

The importer creates no Cast Member, Location, Prop, or Screenplay reference.
Character cues, Scene Headings, and supported tag evidence are
non-authoritative candidates for later agent/user reconciliation.

After a successful import, Director Context exposes the Project Settings
document to the movie-director workflow. Enabled import preferences may cause
that agent workflow to continue, in prerequisite order, with unambiguous
continuity facts and bindings, continuity images, screenplay analysis, Scene
Beats, and storyboard images. Explicit task direction may override those
preferences without changing the saved document.

These are agent-owned follow-up stages, not importer behavior. Ambiguous
identity still requires judgment, disabled stages are not proactively
dispatched, and storyboards require an active Scene Beats revision. The screenplay
drafter returns import evidence to the movie director instead of orchestrating
other departments itself.

## Safety And Determinism

- Source size is checked before UTF-8 decoding and tree parsing.
- Document types/custom entities are rejected; the parser performs no network
  or external DTD resolution.
- Fixed depth, paragraph, attribute, node-text, and aggregate semantic-text
  limits bound the parsed tree.
- SHA-256 is calculated from exact original bytes before parsing.
- Importer version, SHA-256, and stable semantic source paths derive every
  imported identity. Identical repeated paragraphs remain distinct because
  their source paths differ.

The direct parser dependency is `@rgrove/parse-xml` and package changes must go
through Socket Firewall (`sfw pnpm ...`).

## Persistence

The exact source is a Project-owned `screenplay_source` Asset with media kind
`document`, file role `source`, MIME type `application/xml`, and path:

```text
screenplay/<safe-source-basename>[-<collision-number>].fdx
```

`screenplay_import` stores the import id, source Asset/File ids, importer
version, commit timestamp, and closed developer-only normalization log. The
Asset File's `contentHash` is the only persisted SHA-256 value.

The complete canonical aggregate is validated before writes. Source copy,
Asset/File/membership, provenance, Screenplay rows, and revision commit through
one SQLite transaction plus the Project Asset file write-set. A failure rolls
back rows and any copied file. Core prevents discard of the retained source
while its import record exists. Canonical runtime reads query SQLite only.

## Fixture Provenance

The Core fixture under
`packages/core/src/server/screenplay/fdx/fixtures/representative.fdx` is a
synthetic MIT-licensed screenplay authored for Renku Studio. It covers the
accepted syntax without incorporating a copyrighted screenplay or implying
support beyond the documented subset.

Real-world E2E inputs come from Fountain's official FDX downloads. Studio pins
their source URLs, byte lengths, and SHA-256 identities, then downloads them on
first use into a repository-ignored local cache. The screenplay files are not
redistributed in this repository. They exercise the production CLI, Core import,
exact source retention, and browser renderer without becoming bundled product
samples or a universal Final Draft compatibility claim.

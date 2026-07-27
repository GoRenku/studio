# 0064: Use Exclusive Asset Membership And Scoped Selection

Date: 2026-07-26

Status: accepted

## Context

Studio previously represented Asset ownership through several relationship
tables and represented chosen imagery through several focused display or
representative tables. Lookbooks, Scene Beat Storyboards, Dialogue Audio, and
Shot images also carried overlapping ownership facts in purpose-specific
records.

That model made ordinary questions—who owns this Asset, which image is selected
for this surface, and which exact file one generation request uses—depend on
different contracts. It also allowed one Asset to be shared by several owners,
which made copy and Trash behavior ambiguous.

## Decision

Every Asset has exactly one durable owner. Core persists that exclusive
ownership in `asset_membership`; the membership primary key is the Asset id.
Supported owners are Project, Cast Member, Location, Sequence, Scene, logical
Scene Beat, Lookbook, and Shot.

The public `Asset` contract projects:

- `id` and `owner`;
- canonical Asset type and media kind;
- availability;
- title, one-line summary, reference name, purpose, locale, and origin;
- its AssetFiles;
- creation and update timestamps.

Relationship ids, relationship roles, relationship ordering, and internal
owner keys are not public concepts. Purpose-specific detail records remain only
when they hold real domain facts, such as Lookbook placement or Dialogue Audio
provider settings.

Canonical selected imagery is a separate owner-scoped concern. Core stores at
most one selected Asset in `selected_asset` for Cast Profile, Location Hero,
Lookbook card image, Shot image, and Scene Beat Storyboard targets. Selection
must point to an active Asset with the same owner and the target's canonical
Asset type. Candidate listing returns `selectedAssetId`; it does not decorate
each Asset with duplicated selection state.

Character Sheets, Location Sheets, Lookbook Sheets, and Dialogue Audio Takes do
not have global selection. Their exact choices belong only to the consuming
`GenerationSpec` references, so two requests may choose different candidates
without mutating project-wide state.

Core uses one typed owner-key encoding internally for both membership and
selection. The encoding is a storage boundary, not a public or UI contract.

Copy creates independent ownership. In particular, copying a Shot Plan copies
only each Shot's selected image into new Asset and AssetFile identities and
new owner-specific paths while preserving provenance references. Source and
copy can then be discarded independently.

Generation attachment supplies one owner and one canonical Asset type. When
the accepted user intent is both import and canonical selection, Core persists
the Asset, file, provenance, membership, and selection atomically.

## Consequences

- Core has one ownership path and one canonical-selection path.
- CLI and Studio adapters send owner or selection intent and contain no domain
  eligibility rules.
- Grouped Storyboard slices are ordinary Scene Beat-owned image Assets.
- Logical Scene Beat ownership survives Beat Sheet revision changes without
  carry-forward writes.
- Individual selected-Asset discard clears selection; whole-owner
  discard/restore preserves the owner's selection.
- AssetFile paths do not define ownership.
- No compatibility readers, aliases, relationship facades, or duplicate
  selection fields remain.
- Decision 0063's Shot relationship table, representative terminology, shared
  copy, and owner-count behavior are superseded.
- Decisions 0013, 0019, 0029, 0049, 0052, and 0059 remain accepted except for
  their relationship-table, role, or focused-selection implementation details,
  which this decision replaces.

# 0222 Conversion Inventory

This is supporting implementation evidence for plan 0222, not a separate plan.
The unified schema, public-contract cutover, and automatic reference registration are implemented.

## Relational Identity Conversion

The one-way mapping is `asset.id -> asset_file.id`, established only after
checking that each source parent has exactly one physical file and one owner.

| Current persisted relationship | Required conversion |
| --- | --- |
| `asset_file.asset_id`, `asset_file.role` | Remove after merging parent metadata and lifecycle into the file row |
| `asset_membership.asset_id`, `owner_key` | Move the exact owner key onto the mapped file; remove membership table |
| `selected_asset.asset_id` | Map to `selected_asset_file.asset_file_id`; preserve target key and timestamps |
| `lookbook_image.asset_id` | Map to `asset_file_id`; preserve placement identity, sort order, lifecycle |
| `lookbook_sheet.asset_id` | Map to `asset_file_id`; preserve sheet identity, sort order, lifecycle |
| `cast_voice.sample_asset_id` | Map to `sample_asset_file_id`; preserve voice/default relationships |
| `shot_plan_previs_revision.asset_id` | Map to `asset_file_id`; preserve revision, source directory, hashes |
| `shot_plan_clip_take.asset_id` | Remove; preserve and verify existing `asset_file_id` against the mapping |
| `shot_plan_dialogue_audio_take.asset_id` | Remove; preserve and verify existing `asset_file_id` against the mapping |
| `screenplay_import.source_asset_id` | Remove; preserve and verify existing `source_asset_file_id` against the mapping |

The child preservation set includes `cast_voice_default`, `shot_plan_clip`, and
`shot_plan_clip_take`, including the Clip's selected Take and the Take's
self-reference. Rebuilding a parent with foreign keys enabled must not cascade
these rows away. The source SQL schema is owned by `server/schema/`; runtime
adapters must not implement this conversion.

## Application-Owned Envelopes

`trash_item.restore_snapshot_json` has explicit kind-specific shapes. Conversion
must operate on these known fields, never recursively rewrite arbitrary JSON.

| Current Trash kind | Identity fields to convert |
| --- | --- |
| `asset` | `item_id` and snapshot `assetId`; current kind becomes `assetFile` |
| `lookbookImage`, `lookbookSheet` | Snapshot `assetId`; domain `item_id` stays unchanged |
| `castVoice` | Snapshot `sampleAssetId`; voice and owner IDs stay unchanged |
| `shotPlanDialogueAudioTake` | Snapshot `assetId`; retain exact stored file ID and dialogue ownership |
| `shot` | Snapshot `images.assetIds[]` becomes mapped `images.assetFileIds[]` |
| `shotPlan` | Snapshot `shots[].images.assetIds[]` becomes mapped `assetFileIds[]` |
| `inspirationImage` | Use exact folder/path fields to create or reuse one file identity; convert `item_id`, kind, and the restoration envelope |

Folder entries keep their folder identity and current discard operation.
Collected history must not become active content. Repeated historical image
operations use one canonical ID per exact retained path; available bytes are not
required to retain discarded image history.

Previs `playback.json` already contains `audio.assetFileId`. Its current decoder
also demands the redundant parent ID. Update decoding and playback resolution to
the existing file ID and optional offset without rewriting the file. Preserve
source bytes, source hashes, descriptions, and provider request/provenance bytes.
Current generation provenance stores provider requests rather than the Studio
target envelope; it must remain opaque and unchanged.

Empty Trash manifests are historical execution artifacts. Their stored bytes
remain unchanged; current lifecycle operations use the converted database ledger.

## Runtime Consumer Inventory

- Core file projection, owner parsing/validation, metadata, selection, resource
  keys, persistence, edit-source lookup, and Project cover projection.
- Cast profiles/sheets/voices; Location heroes/sheets/worlds; Prop heroes/sheets;
  Lookbook placements and sheets; Scene Beat storyboards; Shot images; dialogue
  audio; Previs renders/playback; Clip Takes; screenplay source/supporting files.
- Generation context collection and purpose modules, reference candidate IDs,
  edit targets, import/attachment results, inspection, review reference serving,
  provider preparation, and native Codex image reference preparation.
- CLI command registry/parsers/formatters, HTTP file/list/discard routes, Studio
  API services and rendering, and MCP projections/resources.
- Sister Skills shared Media Producer contracts, executable context fixtures,
  purpose/provider examples, reference workflows, and media-generation evals.

The initial inventory found 269 source files across Core, CLI, Studio, and Codex
containing the former parent model's names or IDs. That count is a scope signal, not an allowed
command inventory or an architecture-test assertion. Renames must be reviewed
against the owning contracts rather than applied to creative/provider payloads.

## Verified Source Data

On 2026-10-04, read-only SQLite backups were made to an isolated temporary
directory and queried without upgrading the source Projects.

| Project | Parents | Files | Ambiguous cardinality | Missing owners | Duplicate stored paths | Integrity |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Urban Basilica | 196 | 196 | 0 | 0 | 0 | `quick_check = ok`; no FK issues |
| Sintel | 82 | 82 | 0 | 0 | 0 | `quick_check = ok`; no FK issues |
| Big Fish | 35 | 35 | 0 | 0 | 0 | `quick_check = ok`; no FK issues |

All three copies reported schema generation 70. This does not replace the SQL
guards for normalized-path collisions, lifecycle mismatch, ambiguous envelopes,
or incomplete ownership in other source databases.

## Implemented Discovery Foundation

`database/lifecycle/asset-file-backfill/candidates.ts` now discovers flat
registered Inspiration images (including discarded folders) and recursive
research references. It rejects symbolic links and competing normalized folder
paths, aggregates located issues, and does not write files or database rows.

The focused folder query includes discarded rows. The focused Trash query
requires a matching folder ID and current discard operation with an unrestored,
garbage-collected ledger entry. An older collected operation cannot excuse a
missing directory. Missing active or not-yet-collected folders block discovery;
an absent research tree remains empty.

Eight discovery tests cover those boundaries. Project open invokes atomic backfill persistence before exposing the session; completion version 1 avoids repeated discovery. Reference integration tests cover failed-open retry and completed-open behavior.

## Implemented verification

- Drizzle Kit conversion tests preserve authored/physical facts and selection,
  reject ambiguous source cardinality, preserve opaque creative Trash fields,
  and map historical missing/collected Inspiration image identities.
- Automatic open on isolated Urban Basilica and Sintel copies yields 278 and
  107 retained file rows respectively, completion version 1, no foreign-key
  violations and `quick_check = ok`. Sampled physical paths/hashes are unchanged.
- A fresh built CLI-launched MCP process serves Coco_062.jpg, Coco_004.jpg and
  Coco_054.jpg byte-for-byte and returns WebP thumbnails with no diagnostics.
- Desktop tests verify Inspiration upload, canonical preview and Trash deletion,
  plus Lookbook definition and registered visual content.
- The final unit run passed 1,346 tests across all workspace packages. All 111
  integration tests passed. Sister Skills passed 104 tests and validated 22
  purposes plus 27 cross-cutting requirements.

- Read-only source-to-converted-copy comparison preserves every original file ID
  (196 Urban Basilica, 82 Sintel), 168 relationship/selection values, authored
  metadata, provenance, paths, and physical facts.
- Completed-copy reopen preserves exact database bytes and creates no new backup.
  Injecting a missing required Inspiration directory on a separate Sintel copy
  blocks readiness without database writes; repair completes with the same 107
  records and clean integrity checks.
- The installed `renku` command upgrades a fresh generation-70 Sintel copy to 71,
  creates a verified backup, completes backfill, and preserves the expected count.
  A fresh installed `renku studio mcp` process serves all three real Coco images
  exactly and produces usable thumbnails.
- Desktop acceptance drops two new images, uses them immediately in generation
  review, verifies decoded images and exact served bytes, and confirms review
  creates no extra retained identities. All five desktop smoke tests pass.
- New modules keep domain validation, physical persistence, readiness, selection,
  and lifecycle in Core. CLI/HTTP/UI adapters consume focused contracts; public
  indexes remain thin. The obsolete filesystem-gallery pass-through was removed.
- CLI adapter tests cover single Inspiration/research imports, unchanged batch
  document delegation, exact report serialization, and structured flag/document
  errors. Core preview tests prepare imported research image/audio/video bytes
  through the shared contract and reject generic-file preview with the documented
  unsupported-media error without creating extra retained records.

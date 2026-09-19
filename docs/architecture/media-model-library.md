# Personal Media Model Library

Status: current
Date: 2026-09-19

The personal library is global discovery metadata shared across Projects. Core
stores it at `<resolveRenkuConfigDir()>/model-library/library.json`, outside both
runtime and Skills installations. CLI returns the actual platform path.

```json
{
  "formatVersion": 1,
  "entries": [
    { "provider": "fal-ai", "apiId": "vendor/exact-route", "name": "My model" }
  ]
}
```

Each route has exactly three nonempty string fields. Identity is the exact
`(provider, apiId)` pair, including namespace and pinned version. Core validates
the envelope, uniqueness, and 1 MiB size limit. It never reads creative guidance,
fetches schemas, or certifies model capabilities.

## Discovery and advice

Callers supply current bundled `supported-routes.json` paths. Core extracts only
provider, exact route, and name, merges personal entries by exact identity, and
sorts by provider and API identity. Personal names take precedence. Results include
`source` and `hasBundledEntry`; neither selects the source of creative guidance.

Bundled indexes are read-only. Core resolves their filesystem paths before
checking that each index is a regular file within the 1 MiB limit, so symlinked
Skill installations and OS directories are supported. Personal-library storage
continues to reject symlinks in the file path and its ancestor directories.

The SHA-256 digest covers the complete effective name/route list before optional
provider filtering. Media Producer supplies all five indexes and passes that
digest to its existing configuration descriptor. A change in effective choices
refreshes selectors through the existing cache policy. Guide edits do not change
that digest or invalidate technical schemas/templates.

Optional personal Markdown lives at `model-library/guides/<route-sha256>.md`.
The filename hashes UTF-8 `JSON.stringify([provider, apiId])`. `show` returns the
location even for an unlisted route. Core does not check or read that file.
Skills independently load current bundled advice and optional personal notes.
Bundled curation supplies defaults, personal research adds advice, and explicit
user preferences take priority. Later bundled adoption or improvement never
overwrites personal notes or gets hidden by a personal discovery label.

Missing guides, catalog keys, or operation advice are ordinary absence, with no
warning, completeness requirement, approval, or activation state. Normal request
preparation uses the selected live/cached schema plus available advice. Exact
unlisted models can execute without installation. Investigate an actual input or
protocol mismatch when encountered; do not require a separate compatibility audit.

## Commands and ownership

`renku generation models list`, `show`, `import`, and `remove` need no active
Project or running Studio. See [CLI commands](../cli/commands.md). Core exposes
`listMediaModels`, `readMediaModel`, `importPersonalMediaModel`, and
`removePersonalMediaModel` at its server boundary. Engines exposes registry-derived
`providerIds`; CLI passes those to Core imports without a second provider inventory.

This covers the five ordinary providers. Codex remains harness-owned and World
Labs retains its separate Location World workflow. Provider schemas, auth, uploads,
transport, validation, execution, recovery, and output normalization remain in
Engines. ElevenLabs keeps its fixed music path and explicit unavailable generic
speech/music schema behavior. A route bookmark cannot enable another protocol.

## Safe writes and recovery

An absent library has revision `null` and no entries. Existing malformed content
fails without resetting it. Revisions hash exact file bytes. Mutations require
the caller's revision (`--if-revision absent` for no document), acquire exclusive
`library.json.lock`, reread and compare, update only the selected route, then
atomically replace the document using a temporary sibling. Stale writers must
reread and reconcile; they are not automatically rebased. Unsafe paths, symlinks,
invalid envelopes, unsupported providers, missing removal targets, and IO failures
produce structured errors.

A held lock returns `CORE_MEDIA_MODEL_LIBRARY_BUSY`. After a crash, verify no
writer remains before manually removing the reported stale lock. Renku never
steals it. The previous complete library remains intact until atomic replacement.
Route removal preserves all personal Markdown and reveals the current bundled
entry if present. Deleting guidance is separate explicit user intent.

Runtime and Skills releases stay independent. The first supporting runtime
version is recorded when released; until then this contract requires a build
containing `generation models`. Subsequent additions within existing protocols
need no runtime/plugin release, Project migration, Settings change, or provenance
rewrite.

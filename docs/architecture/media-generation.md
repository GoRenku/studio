# Media Generation

Decisions [0086](../decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md),
[0087](../decisions/0087-use-deterministic-advisory-media-generation-context.md),
and [0088](../decisions/0088-use-exact-request-references-and-source-derived-image-continuation.md)
define the current media-generation architecture.

## Ownership

- Core deterministically projects current Project facts, target relationships,
  workflow policy, visual language, and relationship-derived reference
  suggestions for one purpose and target.
- Media Producer considers that evidence, makes creative reference choices, and
  coordinates conversational review.
- Provider Skills expose curated model identity/name/input modes, read current
  native operation facts from the provider, and author exact provider-native
  JSON.
- `packages/engines` owns standalone provider protocols: live metadata/schema
  validation, uploads, retry/poll/recovery, output normalization, and downloads.
- `packages/cli` composes providers, resolves one Core-owned credential, replaces
  local-file paths, delegates once to Engines, and serializes artifacts plus safe
  provenance.
- `packages/core` owns Project paths, credentials, deterministic generation
  context, the small review/provenance envelope, safety, per-media Settings,
  focused attachment, Asset provenance, copies, Inspection, and database
  migration.
- `packages/studio` projects Core resources. It neither imports provider SDKs nor
  validates provider fields.

```text
Core purpose + target context
        |
        | current facts + advisory suggestions
        v
Media Producer / provider Skill
        |
        | temporary review JSON
        v
Core Preview projection ---> Studio shared review dialog
        |
        | exact provider-native request
        v
CLI composition root ---> standalone Engines provider
        |
        | artifact paths + exact provenance
        v
focused Core attachment ---> Asset.generationProvenance
                                      |
                                      v
                           Studio read-only Inspection
```

## Review document and provenance

A temporary review document lives under
`tmp/operations/media-generation/*.json`:

```json
{
  "provider": "fal-ai",
  "model": "provider/model",
  "mediaKind": "image",
  "prompt": "Exact authored prompt",
  "request": { "prompt": "Exact provider-native request" }
}
```

Only these top-level fields are accepted. `prompt` may be `null`. `request` is
opaque JSON and may contain recursive exact local-media markers:

```json
{
  "$file": "media/reference.png",
  "mimeType": "image/png",
  "reviewLabel": "Council chamber — Location reference",
  "promptMention": "@Image1"
}
```

`reviewLabel` is required for every reviewed Renku marker. `promptMention` is
optional and is the exact provider/model-native text to insert; it may contain
spaces or omit `@`. Repeated use of one file remains separate by request JSON
Pointer. Studio completion uses only markers in this request and never all
context suggestions or all Project Assets.

Preview displays prompt, references, read-only configuration, and diagnostics.
It may atomically update only the top-level prompt. Update does not rebuild
provider-native request JSON; the provider Skill rereads the file and does that
work conversationally. Preview has no Generate action and no continuation event.

Preview and Inspection render through one complete Studio dialog owner. The
shared owner controls the DialogContent dimensions and grid, header, tabs,
content insets, loading/unavailable placement, footer, and Close action. Preview
adds only editable prompt state, Update, and optional multi-request navigation;
Inspection adds no parallel visual shell.

Configuration presentation is schema-free and read-only. The browser resource
remains `JsonValue`; Studio may project only exact JSON structure, insertion
order, array order, primitive types, values, and deterministic key humanization:

- strings and numbers use read-only shadcn Input controls;
- booleans use disabled shadcn Switch controls;
- null uses the same value surface with `Not set`;
- objects and arrays use ordered visual groups derived only from JSON nesting;
  and
- excessive depth or size uses a bounded formatted-JSON fallback.

Studio must not infer select options, slider constraints, units, provider
groups, model capabilities, or labels from provider/model ids, field names,
familiar values, or documentation. A value-only resource cannot truthfully
reconstruct those removed schema facts. Exact provider control semantics would
require a separately accepted presentation-metadata contract; they must not be
approximated through heuristics or one-option controls.

`MediaGenerationProvenance` uses the same envelope and may add an opaque safe
`receipt`. It is stored once on Asset, not AssetFile. Inspection projects the
same view without a document path and with `editable: false`.

Core rejects unknown envelope fields, non-JSON values, excessive size/depth,
absolute or traversing local paths, secret-bearing fields, signed URLs, and
temporary provider media URLs. It does not semantically inspect prompts,
provider-native fields, receipts, or media contents.

## Deterministic Project context

Every purpose-specific Media Producer workflow begins with:

```bash
renku generation context --purpose <purpose> --target <target> --json
renku generation schema show --provider <provider> --model <model> --json
```

For `scene.storyboard-sheet`, `--revision` chooses the exact Scene Beats
revision and repeatable `--beat` narrows the report to a reviewed Beat batch.
Core validates only target identity and requested scope. Missing Lookbooks,
designs, Beats, voices, dialogue Takes, or related media are returned as empty
context or structured warnings; they do not make the request unauthorized.

The report includes current Project story facts and languages, effective
workflow policy, purpose-level output guidance, exact target/design context,
relevant Production or Storyboard Lookbooks, Scene/Beat/Shot/Shot Plan and
dialogue relationships, and exact relationship-derived AssetFiles.

**Context is evidence, not permission.** Suggestions are advisory and
non-exhaustive. Their stable order is not priority. A user or agent may ignore,
supplement, or replace them, including with an unrelated Project Asset or an
external reference. Canonical display selection is reported as a fact and is
never treated as generation selection. Core does not inspect creative content
or decide which reference should be sent to a provider.

The report is a fresh read projection. It is not persisted, hashed, frozen, or
copied into provenance. It contains no provider/model alternatives, native
request fields, provider schema, controls, prices, approval state, or execution
permission. It has no Studio route or model-selection dialog.

## CLI

The current provider execution commands are:

```bash
renku generation context --purpose <purpose> --target <target> --json
renku generation validate --file tmp/operations/media-generation/request.json --json
renku generation preview show --file tmp/operations/media-generation/request.json --json
renku generation execute --file tmp/operations/media-generation/request.json --output tmp/operations/media-generation/output --json
renku generation recover --file tmp/operations/media-generation/request.json --request-id <provider-job-id> --output tmp/operations/media-generation/output --json
renku media import --purpose <purpose> --target <target> --source <path> --provenance <provenance-json> --json
```

Schema inspection returns the selected provider's live raw input schema. It is
technical field authority, not editorial prompting guidance. `image.create`
uses `--target shot-plan:<id>` and appears as a generic Reference Image in that
Plan's Assets tab. `image.edit` uses `--target asset:<id>`; Core derives the
same-place destination from the exact source Asset and accepts no separate
destination choice.

Preview accepts `codex` because built-in image generation can share the review
envelope. Validate, execute, and recover reject `codex`; it is a harness-gated
Media Producer capability, never an Engines provider. World Labs Location World
generation remains under the focused `renku location world` command.

## Providers and Settings

Core owns credentials for Fal.ai, Pika, Replicate, WaveSpeed, ElevenLabs, and
World Labs. Engines receives only one opaque credential string. The generation
CLI registers Fal.ai, Pika, Replicate, WaveSpeed, and ElevenLabs. Pika resolves
exact operation ids through its live catalog and has no Engines allowlist;
Media Producer's Pika Skill curates the initial operation set. World Labs is
exposed by its focused location-world Engines API.

Project Settings version 5 has global Preview and provider prompt-expansion
preferences plus independent Image, Video, and Audio sections. Image chooses
Codex, Fal.ai, or Pika; Video chooses Fal.ai or Pika; Audio remains ElevenLabs.
Media Producer applies the expansion preference only when the selected live
schema unambiguously exposes such a control; runtime code has no native-field
map.
Each media kind owns Ask Before Generating, concurrent scheduling, and a retained
maximum. Effective concurrency is one while concurrent scheduling is off.
Replicate, WaveSpeed, and World Labs credentials remain available for explicit
Skill workflows but are not Project provider preferences.

Provider Skill indexes contain the exact provider API id, human name, supported
input modes, and a canonical editorial model-guide key. The API id is copied
verbatim into the temporary review document and Engines calls; the guide key is
never executable provider identity. The indexes do not duplicate request fields,
defaults, enums, ranges, durations, pricing, or capability summaries. Current
native request facts come from the selected provider operation.

## Removed concepts

There is no production Generation Spec, Generation Run, estimate, pricing,
approval token, freeze lifecycle, simulation, generic model catalog, persisted
reference selection, file-level generation identity, or Core-owned provider
execution. No compatibility reader or alias recognizes those concepts.

## Provider extension rule

A normal provider addition changes the standalone Engines provider module, CLI
registration, provider Skill guide/index, deterministic tests, and release
metadata. It does not change Core, Studio, the database, Preview, or a shared
request schema. Credentials and Project Settings choices require separate
product decisions. See
[`packages/engines/docs/adding-a-provider.md`](../../packages/engines/docs/adding-a-provider.md).

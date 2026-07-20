# 0057 Use Model-Routed Human-Readable Image Prompts

Date: 2026-07-18

Status: accepted

Notice: Decision [0058](0058-make-studio-image-editing-agent-owned.md)
supersedes this decision's Image Revision, Regenerate, and Edit workflow clauses.

## Context

Renku Studio reviews the exact authored request before image generation. The
current request surfaces preserve prompt, references, model, and settings, but
three product requirements need a clearer architecture.

First, provider schemas contain many fields that are valid provider inputs but
are not meaningful Renku user choices. Examples include provider transport and
storage switches, output multiplicity, safety controls, output format mechanics,
and experimental flags. Turning every scalar schema property into a Config
control exposes provider implementation details and makes the product surface
change whenever a provider adds a field.

Second, Image Revision has two distinct workflows. Regenerate edits the exact
original request before creating another result. Edit uses the current image as
a required source and asks for a focused visual change. Both workflows allow a
different image model, but a provider route name such as `/edit` describes route
capability rather than the user's workflow by itself.

Third, users need a rich prompt review surface. Selected image references must be
discoverable while typing, insertable as stable prompt mentions, and previewable
from the prompt. This interaction must not require runtime prompt interpretation
or conflate a provider media field with prompt-visible text.

Image models also benefit from different prompt guidance. A purpose guide knows
the Cast, Location, Lookbook, Storyboard, or generic image ingredients. An exact
model-route guide knows how to communicate those ingredients to the selected
model. Neither should duplicate the other.

Decision 0041 requires prompts and creative artifacts to remain opaque. Studio
may store, edit, tokenize for presentation, and send an exact prompt, but it may
not semantically parse, repair, score, or validate its creative contents.

## Decision

Renku will use one exact prompt value, model-routed image prompt guidance, a
curated per-model Config surface, and one shared image request editor.

### One Studio image-model catalog

Engines owns one authored Studio image-model catalog. It is the sole runtime
inventory of current image-model families and exact managed routes.

The catalog owns product policy:

- stable family id and user-facing family label;
- ordered exact routes within the family;
- the ordered provider fields users may configure for each route;
- product-facing parameter and enum-value labels.

The catalog does not copy provider mechanics. Full provider schemas remain the
source of:

- field types and requiredness;
- defaults and allowed raw values;
- numeric bounds;
- authored-text and media semantics;
- media kinds and cardinality;
- provider validation and request assembly.

Engines derives whether a route accepts no image input, optional image input, or
required image input from the exact schema's semantic media descriptors. No
separate authored route-capability registry is added.

Studio model availability is derived from the same catalog. There is no second
curated image-route array and no separate route-keyed editable-parameter
inventory.

The obsolete `StudioGenerationUse` and purpose `modelUse` contracts are removed.
They are not translated into aliases or family metadata.

### Curated Config controls

Only catalog-declared user-configurable parameters appear in Generation Preview
or Image Revision Config.

Core combines the catalog declaration with the exact provider schema to project
controls. The catalog supplies product selection and labels; the schema supplies
control mechanics and raw values.

Studio-managed browser updates accept only declared parameters. Core rebuilds
managed authored values from prompt fields, declared configurable values, and
existing Core-owned fixed product settings. Undeclared transport, storage,
multiplicity, safety, output-format, and experimental fields do not persist as
hidden user configuration.

Provider mechanics that Renku owns are omitted to use a deliberate provider
default or applied by the owning provider-request assembly boundary. Image
multiplicity remains an application workflow choice rather than a provider
Config field.

### Family selection and exact routes

Studio shows one model-family choice, such as GPT Image 2, rather than separate
text-only and image-input endpoint choices.

For Generation Preview and Image Revision only, React submits the selected
family and current user intent. Core applies current reference selections and
resolves the first compatible exact route in the family's declared order:

- a request without selected image references uses a route whose image inputs
  are absent or optional;
- a request with selected image references uses a route whose image inputs are
  optional or required;
- Edit requires its source image before route resolution;
- a missing compatible route is a structured error;
- selected references are never silently dropped to make a route compatible.

`GenerationSpec.model` continues to store the resolved exact provider/model
identity for validation, pricing, execution, and provenance. Family id is a
focused authoring choice and is not added to the durable generic spec.

This narrows Decision 0047's rule that Core does not switch models. Generic
GenerationSpec create/update operations continue to preserve exact authored
model identity. Only the focused image browser authoring workflows accept a
family choice and ask Core to resolve its exact route.

### Regenerate and Edit

Image Revision keeps two explicit modes.

Regenerate:

- starts from a completed managed run snapshot or the exact frozen source spec
  attached to an externally generated image;
- preserves its purpose and target;
- copies its prompt, references, and supported configuration into a new mutable
  draft;
- selects the source route's family when that route is currently cataloged;
- uses the current purpose's recommended managed family when an external or
  unavailable source route has no managed family;
- allows prompt, reference, configuration, and family changes;
- creates a new exact managed GenerationSpec and run;
- never mutates or unfreezes the original request.

Regenerate does not universally mean new-image prompt intent. If the original
request purpose is `image.edit`, regenerating it remains `image.edit`.

Edit:

- creates a new `image.edit` request targeting the source Asset;
- includes the current AssetFile as a required locked source reference;
- uses a focused edit prompt;
- permits a different compatible model family;
- permits supported configuration and additional reference choices;
- creates a new exact GenerationSpec and run.

The current purpose supplies prompt-authoring intent: `image.edit` uses
revise-source guidance and every other current image purpose uses generation
guidance. The skill does not independently choose a conflicting intent, and no
additional intent field is persisted in GenerationSpec.

### Exact reference mentions

A selected reference may carry an exact optional `promptMention`, independently
from the provider media field used to upload it.

Focused Studio reference-selection commands allocate `@ReferenceN` from a
request-owned monotonic `nextPromptMentionNumber`. Replacing the reference in
the same placement preserves its mention. Clearing a reference does not
decrement the counter, so stale mention text cannot silently bind to another
image. Studio Skills may author the same metadata when creating a request
directly.

Core validates only the envelope it owns:

- a mention is non-empty when present;
- mentions are unique within one request;
- the mention counter is a valid next number and is not provider input;
- clearing a reference removes it from completion choices;
- prompt contents are never scanned to create or validate mentions;
- the prompt is never required to contain every mention;
- clearing or replacing a reference never rewrites prompt text.

`promptMention` and `providerField` remain separate. Studio does not derive a
mention from provider fields, route names, asset titles, filenames, ids, or
prompt contents.

### Shared rich prompt editor

Generation Preview and Image Revision use one shared Generation Request editor
for Prompt, References, Config, diagnostics, and estimate presentation.

The feature-owned generation prompt editor:

- shows and edits one exact prompt string;
- presents long prompts as a readable neutral document;
- uses presentation-only Markdown tokenization;
- offers selected image references after `@`;
- inserts the exact mention through ordinary editor history;
- previews the real selected image on known-mention hover or caret entry;
- behaves the same in editable and read-only prompts;
- leaves unknown and cleared-reference mention-like text unchanged.

Mention insertion never selects, attaches, orders, validates, or removes a
reference. Reference selection remains owned by the References surface and Core
request commands.

The rich prompt editor is a generation-request feature, not a speculative
general editor or autocomplete framework in `src/ui`.

### Model-routed prompt guidance

Studio Skills owns image prompt composition.

Prompt assembly combines:

1. one purpose guide containing domain and creative ingredients;
2. one exact provider/model route guide containing model-specific prompt and
   reference practices;
3. selected references and their exact prompt mentions;
4. generation or revise-source guidance derived from the purpose.

Complex prompts use readable grouping when the exact model guidance supports
it. Simple prompts remain concise. Studio runtime never imposes headings,
sections, phrases, or prompt templates.

The Studio Skills route registry maps exact route identity to one guide path. It
does not duplicate runtime image-input capability, family definitions,
configurable fields, or provider validation.

## Current Scope

The decision applies to these image purposes:

- `image.create`;
- `image.edit`;
- `lookbook.image`;
- `lookbook.video-sheet`;
- `lookbook.storyboard-sheet`;
- `cast.character-sheet`;
- `cast.profile`;
- `location.sheet`;
- `location.hero`;
- `scene.storyboard-sheet`.

The current managed families are GPT Image 2, Nano Banana 2, Nano Banana Pro,
and Grok Imagine Image. The Codex external GPT Image 2 workflow uses the same
prompt guide while retaining its separate read-only execution envelope.

This decision is limited to the image workflows and models listed above.

## Consequences

- Provider schema changes cannot make a new Config control appear without an
  explicit Studio catalog decision.
- The Studio catalog does not duplicate schema mechanics or media requiredness.
- One family choice can resolve to different exact routes as selected image
  references change.
- Regenerate and Edit remain distinct workflows while sharing one request
  editor and one exact generation contract.
- Users can choose another compatible model in either workflow.
- Reference mentions are stable editor objects without becoming prompt semantic
  validation.
- Existing prompts remain exact authored strings and are not automatically
  reformatted.
- Studio Skills must maintain one guide for every selectable exact image route.

## Rejected Alternatives

### Generate Config from every provider schema field

Rejected because provider schemas contain implementation and experimental
fields that are not Renku product choices.

### Copy a complete UI field schema into the Studio catalog

Rejected because it would duplicate provider types, enums, defaults, bounds,
and requiredness and create two schema sources of truth.

### Separate availability, family, capability, and editable-parameter registries

Rejected because the exact route inventories would drift. One catalog owns
product route policy; provider schemas own capability.

### Treat `/edit` as Renku Edit intent

Rejected because image-input provider routes can serve both reference-conditioned
generation and source-image editing.

### Always map Regenerate to generation intent

Rejected because an original `image.edit` request must remain an edit request
when regenerated.

### Derive mentions from provider fields or prompt scanning

Rejected because provider media fields describe upload routing and prompt
scanning would interpret opaque creative text.

### Put rich image-reference behavior in a generic UI editor

Rejected because there is no current general editor reuse and image preview,
reference completion, and prompt aliases are generation-request behavior.

## Related Decisions

- `0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`;
- `0025-use-shared-media-generation-purpose-architecture.md`;
- `0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `0047-use-context-first-provider-valid-generation.md`;
- `0049-use-request-scoped-generation-reference-choices.md`;
- `0053-use-one-configurable-studio-media-card.md`.

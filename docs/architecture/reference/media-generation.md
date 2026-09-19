# Media Generation Reference

This is the compact contract reference for the architecture accepted by
[Decision 0086](../../decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md)
[Decision 0087](../../decisions/0087-use-deterministic-advisory-media-generation-context.md),
and [Decision 0088](../../decisions/0088-use-exact-request-references-and-source-derived-image-continuation.md).

## Public Core contracts

```ts
type JsonValue = null | boolean | number | string | JsonValue[] |
  { [key: string]: JsonValue };

interface MediaGenerationReviewDocument {
  provider: string;
  model: string;
  mediaKind: 'image' | 'video' | 'audio';
  prompt: string | null;
  request: JsonValue;
}

interface MediaGenerationProvenance extends MediaGenerationReviewDocument {
  receipt?: JsonValue;
}

interface ReadMediaGenerationContextInput {
  purpose: MediaPurpose;
  target: MediaTarget;
  sceneStoryboardScope?: {
    sceneBeatsRevisionId?: string;
    beatIds: string[];
  };
}

interface MediaGenerationContextReport {
  valid: true;
  project: MediaGenerationProjectContext;
  purpose: MediaPurpose;
  target: MediaTarget;
  outputMediaKind: 'image' | 'video' | 'audio';
  workflowPolicy: GenerationWorkflowPolicy;
  outputGuidance: MediaGenerationOutputGuidance;
  targetContext: MediaGenerationTargetContext;
  visualLanguage: MediaGenerationLookbookContext[];
  suggestedReferences: MediaGenerationReferenceSuggestion[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}
```

`Asset.generationProvenance` is nullable. `Asset.authoredFrom` is nullable weak
Shot Plan context used only by current video grouping/invalidation behavior.
An unsigned provider output URL may be retained as an opaque receipt fact. The
imported local AssetFile is still the canonical media source, and runtime code
does not fetch or recover media from receipt URLs. Stored requests reject provider
transport URLs, and all provenance rejects signed or credential-bearing URLs.

Preview and Inspection share `MediaGenerationPreviewResource`. Its references
contain `requestPointer`, media kind, Project-relative path, required
`reviewLabel`, optional exact `promptMention`, optional browser URL, and
availability; they expose no Asset ids. Preview includes
`documentPath` and is editable only when a prompt exists. Inspection omits the
path and is never editable.

`MediaGenerationContextReport` is a current, non-durable Core projection.
Suggested references are relationship-derived evidence, not an allowlist,
selection, priority, readiness result, or provider-field assignment. Candidates
identify exact AssetFiles and preserve factual ownership, provenance,
availability, and canonical display-selection state.

## Public Engines contract

`MediaEngine` delegates `readInputSchema`, `validate`, `execute`, and `recover`
by exact provider id.
Providers receive `ProviderRequest { model, input }`, opaque credentials, cache,
fetch, cancellation, timing, and—during execution—an output directory. Results
contain normalized downloaded artifacts, optional provider request id, and an
optional opaque receipt. Exact local files use
`{ $file, mimeType?, reviewLabel?, promptMention? }`; substitution replaces the
whole marker so review annotations never reach provider validation or upload.

Supported production provider ids are `fal-ai`, `pika`, `replicate`,
`wavespeed-ai`, and `elevenlabs`. Pika accepts any live asynchronous media
operation with the implemented catalog contract; its Skill separately curates
the initial image/video choices. World Labs uses the focused location-world API.
`codex` is review and provenance only.

## Diagnostics

Core review/provenance codes:

- `CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID`
- `CORE_MEDIA_GENERATION_REVIEW_INVALID`
- `CORE_MEDIA_GENERATION_REVIEW_UNSAFE`
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND`
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT`
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_UNSUPPORTED`
- `CORE_MEDIA_GENERATION_REFERENCE_MARKER_INVALID`
- `CORE_MEDIA_GENERATION_REFERENCE_LABEL_INVALID`
- `CORE_MEDIA_GENERATION_REFERENCE_MENTION_INVALID`
- `CORE_MEDIA_GENERATION_REFERENCE_MENTION_DUPLICATE`
- `CORE_MEDIA_GENERATION_PROVENANCE_INVALID`
- `CORE_MEDIA_GENERATION_PROVENANCE_UNSAFE`
- `CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED`
- `CORE_MEDIA_GENERATION_PROVENANCE_CONFLICT`
- `CORE_GENERATION_TARGET_INVALID`
- `CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND`
- `CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID`
- `CORE_MEDIA_GENERATION_CONTEXT_GAP` (warning)
- `CORE_MEDIA_GENERATION_CONTEXT_REFERENCE_FILE_UNAVAILABLE` (warning)
- `CORE_IMAGE_EDIT_SOURCE_INVALID`
- `CORE_IMAGE_EDIT_SOURCE_REFERENCE_MISSING`
- `CORE_IMAGE_EDIT_CONTINUATION_UNSUPPORTED`
- `CORE_IMAGE_EDIT_OWNER_INVALID`
- `CORE_IMAGE_EDIT_SURFACE_UNAVAILABLE`
- `CORE_SHOT_PLAN_IMAGE_ASSETS_NOT_FOUND`
- `CORE_SCENE_STORYBOARD_CANDIDATE_CONTEXT_INVALID`

Engines reports `ENGINE_INPUT_SCHEMA_UNAVAILABLE` when the selected provider
does not expose live schema inspection and `ENGINE_LOCAL_MEDIA_INVALID` when an
exact local-file marker has malformed file or annotation values.

The CLI preserves closed `EngineErrorCode` values and uses
`PROVIDER_CREDENTIALS004` for a missing configured credential, `CLI144` when
Studio Preview delivery is unavailable, and existing structured input/path
diagnostics at its boundary.

## Hard boundaries

- Core and Studio never import Engines or provider SDKs.
- Core context contains no provider model catalog, native request schema,
  control metadata, execution permission, or creative-reference enforcement.
- Engines never imports a workspace package or reads Project state.
- CLI never implements provider fields, validation, upload, retries, polling,
  recovery protocol, output parsing, or downloads.
- Studio renders recursive JSON without a provider presentation registry.
- Runtime code never interprets creative prompt or artifact contents.
- No Spec/Run/approval/estimate/freeze/simulation compatibility surface exists.

## Personal model discovery

The [personal model library](../media-model-library.md) adds global three-field route bookmarks
through `generation models`. Effective choices merge bundled indexes with personal
names by exact provider/API identity. Engines remains a provider protocol registry;
execution is independent of discovery membership. Skills use selected live/cached
schemas and optional bundled/personal guidance, without a separate capability audit.
Missing guides are ordinary absence. Current bundled defaults and explicit personal
preferences apply independently of label precedence. Effective route hashes feed
existing configuration caches; guide changes do not invalidate schemas or templates.

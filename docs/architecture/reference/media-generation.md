# Media Generation Reference

This is the compact contract reference for the architecture accepted by
[Decision 0086](../../decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md)
and [Decision 0087](../../decisions/0087-use-deterministic-advisory-media-generation-context.md).

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

Preview and Inspection share `MediaGenerationPreviewResource`. Preview includes
`documentPath` and is editable only when a prompt exists. Inspection omits the
path and is never editable. References contain only media kind, Project-relative
path, optional browser URL, and availability; they expose no Asset ids.

`MediaGenerationContextReport` is a current, non-durable Core projection.
Suggested references are relationship-derived evidence, not an allowlist,
selection, priority, readiness result, or provider-field assignment. Candidates
identify exact AssetFiles and preserve factual ownership, provenance,
availability, and canonical display-selection state.

## Public Engines contract

`MediaEngine` delegates `validate`, `execute`, and `recover` by exact provider id.
Providers receive `ProviderRequest { model, input }`, opaque credentials, cache,
fetch, cancellation, timing, and—during execution—an output directory. Results
contain normalized downloaded artifacts, optional provider request id, and an
optional opaque receipt. Exact local files use `{ $file, mimeType? }`.

Supported production provider ids are `fal-ai`, `replicate`, `wavespeed-ai`, and
`elevenlabs`. World Labs uses the focused location-world API. `codex` is review
and provenance only.

## Diagnostics

Core review/provenance codes:

- `CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID`
- `CORE_MEDIA_GENERATION_REVIEW_INVALID`
- `CORE_MEDIA_GENERATION_REVIEW_UNSAFE`
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND`
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT`
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_UNSUPPORTED`
- `CORE_MEDIA_GENERATION_PROVENANCE_INVALID`
- `CORE_MEDIA_GENERATION_PROVENANCE_UNSAFE`
- `CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED`
- `CORE_MEDIA_GENERATION_PROVENANCE_CONFLICT`
- `CORE_GENERATION_TARGET_INVALID`
- `CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND`
- `CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID`
- `CORE_MEDIA_GENERATION_CONTEXT_GAP` (warning)
- `CORE_MEDIA_GENERATION_CONTEXT_REFERENCE_FILE_UNAVAILABLE` (warning)

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

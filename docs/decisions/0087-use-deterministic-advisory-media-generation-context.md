# 0087 Use Deterministic Advisory Media Generation Context

Date: 2026-08-25

Status: accepted

## Context

Decision 0086 correctly moved provider-native request authorship to provider
Skills and provider protocol validation/execution to standalone Engines. Its
implementation also removed the purpose-to-Project projection that told agents
which Project facts, domain relationships, Lookbooks, continuity subjects,
dialogue state, and exact related AssetFiles applied to a request.

That information cannot be reliably reconstructed by Skill prose or by calling
unrelated list/show commands. Core is the only owner that can truthfully resolve
the Project graph. Provider facts are a separate concern: the selected provider
operation remains the authority for native request fields and constraints.

## Decision

Core owns one read-only `readMediaGenerationContext` projection for every
current `MediaPurpose` and `MediaTarget`. The CLI exposes it as:

```bash
renku generation context --purpose <purpose> --target <target> --json
```

The report contains current Project story facts and languages, effective
per-media workflow policy, provider-neutral output guidance, exact target and
design context, relevant Production or Storyboard Lookbooks, Scene/Beat/Shot/
Shot Plan or dialogue relationships, exact relationship-derived AssetFiles,
and informational gaps. Scene Storyboard context may select an exact Scene Beats
revision and repeatable Beat subset.

**Context is evidence, not permission.** Reference suggestions are advisory,
non-exhaustive, and stably ordered only for deterministic output. They are not
an allowlist, priority, readiness result, provider-field assignment, or
generation selection. Canonical display selection is reported only as a fact.
The user or agent may ignore, supplement, or replace suggestions, including
with unrelated Project Assets or external references.

Core fails only when it cannot truthfully resolve the requested identity or
scope, or when a registered file is unsafe. Missing creative material is
returned as empty context or warnings and never prevents generation.

Provider/model and input-mode choice remains conversational. Provider Skills
keep only curated model identity, human name, supported input modes, and an
internal guide link. They read all current native request facts from the
provider rather than duplicating provider schemas, controls, defaults, bounds,
pricing, or capability summaries in Core, Studio, or Skill indexes.

The context report is fresh and non-durable. It is not a Generation Spec, Run,
setup document, provider catalog, validation schema, control descriptor,
snapshot, hash, or provenance record. It adds no database migration, Settings
surface, Studio route, model-selection dialog, or Preview/Inspection fields.

## Consequences

- Every Media Producer request starts from the same current Project truth while
  creative decisions remain flexible.
- Specialist Skills hand off user direction and specialist judgment; they no
  longer reconstruct media-generation relationships manually.
- Provider additions do not change the context contract unless they also add a
  new Studio domain purpose or target.
- Preview and Inspection continue to show only the exact selected request
  references through the shared dialog and `MediaCard` presentation.
- Existing Cast, Location, Prop, and Scene Beats contexts reuse the same Core
  projectors where they promise Lookbook or visual-reference context.

## Verification

The boundary is protected by exhaustive purpose/target/output maps,
purpose-guidance tests, target and Scene Beats scope tests, relationship and
AssetFile projection tests, Core import guards, thin CLI delegation tests,
existing shared Preview/Inspection tests, Skill validation, and read-only Urban
Basilica context audits.

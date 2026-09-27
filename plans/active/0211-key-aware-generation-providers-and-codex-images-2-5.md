# 0211 Key-Aware Generation Providers And Codex Images 2.5

Status: implemented
Date: 2026-09-27

## Summary

Project Settings currently shows fixed provider lists that ignore saved API keys. Show keyed Fal.ai, Pika, Replicate, and WaveSpeed in Image, Video, and Audio; keyed ElevenLabs only in Audio; and World Labs in none of these menus because it serves Location World generation. Add the keyless Codex built-in choice to Image, label it for ChatGPT Images 2.5, and keep Codex as the new-Project image default. These settings are only defaults for the AI agent. The agent, using its Skills and the requested model or operation, decides whether a provider can fulfill a specific request.

## Review Attention

- **Provider choices:** Keyed general media providers appear in all three menus. ElevenLabs appears only in Audio, and World Labs appears in none of these menus; it serves Location World generation. The menus do not check media routes or models.
- **Architecture:** Core keeps the provider preference as an opaque string. Engines and Core receive no provider/media eligibility table, model availability check, model selector, or new model-name branch. Studio uses sanitized credential status and the two explicit special-provider roles only.
- **Existing model literals:** The repository is not yet globally free of hard-coded model names. Examples are the Seed Audio ID check in `packages/engines/src/providers/fal-ai/index.ts`, `music_v1` dispatch in `packages/engines/src/providers/elevenlabs/index.ts`, and `marble-1.1` in Location World Core/Engines files. This Settings plan neither relies on nor expands those paths. Removing them needs a separate provider-protocol change; this plan does not claim to complete that broader cleanup.
- **Codex interpretation:** OpenAI describes Images 2.5 for Codex, but the Codex built-in image tool exposed to this workflow has no Flare/Sunburst selector. This plan treats Codex as one keyless Images 2.5 choice. Flare and Sunburst are distinct API models and are not promised as selectable Codex submodels. If exact submodel control is required, that is a separate capability decision before implementation.
- **Data effects:** No schema, route, CLI, generation-request, or database migration changes. Existing Project preferences remain untouched when a key is added or removed. No automatic provider switch or credential cleanup occurs.
- **Preserved behavior:** Per-media confirmation, concurrency, Preview, provider prompt expansion, global credential editing, agent route/model selection, paid-run approval, and Codex's harness boundary stay as they are.

## Requirements And Current Evidence

| Requirement | Source | Ownership and verification |
| --- | --- | --- |
| Show keyed general providers in each menu, ElevenLabs only in Audio, and World Labs in none. | User clarification | Studio filters the existing sanitized credential status by the two special provider roles; UI tests and desktop walkthrough. |
| Always offer and default to keyless Codex Images 2.5 for images. | User request | Existing Core `codex` default, Studio image choice, and Media Producer wording. |
| Treat the provider setting only as an agent default, without runtime model/media checks. | User clarification and ADR 0074's opaque preference | No Core/Engines contract change; agent guidance and diff audit. |
| Preserve settings data and fail clearly when a key or status read changes. | Data-integrity and structured-error rules | Existing full-document replacement, `PROJECT_SETTINGS002`, status read error, and stale-selection UI tests. |
| Keep the Codex lane outside Engines and maintain exact, honest provenance. | ADR 0086 and current generation architecture | Media Producer guidance and representative Codex Preview/provenance walkthrough. |

Concrete evidence from this installation, read through `renku credentials status --json` on 2026-09-27: Fal.ai, Replicate, ElevenLabs, and World Labs have saved keys; Pika and WaveSpeed do not. Yet `project-settings-fields.tsx` hard-codes Pika in Image/Video, omits Replicate everywhere, and offers only Fal.ai/ElevenLabs for Audio. Thus the screenshot's menus can neither reflect key status nor offer the configured Replicate account. The status response contains only provider, label, and boolean `configured`, not secrets.

`packages/core/src/server/project-settings/document.ts` owns the version 6 default and validates the complete JSON document. It currently accepts any syntactically valid provider string; the UI alone defines the limited choices. `packages/studio/src/features/movie-studio/project-details/project-settings-panel.tsx` already loads and autosaves the Core resource. `packages/studio/src/services/studio-provider-credentials-api.ts` already reads sanitized global status. `packages/core/src/server/provider-credentials/catalog.ts` owns the six managed key identities. No second credential store or read endpoint is needed.

The sister `studio-skills` repository contains the model/operation guidance the agent needs after reading a Project default. Its Audio guidance includes speech routes for Fal.ai, Pika, Replicate, and WaveSpeed, plus ElevenLabs speech, music, and sample retrieval. World Labs guidance is for Location Worlds, so its saved key never makes it visible in a generic media menu. The Media Producer Skill must describe these provider roles while treating the saved preference as an initial choice. The Skill then inspects the requested model/operation and selected provider and tells the user when that provider cannot fulfill it. The provider menu never reads Skill route indexes. Existing model-specific runtime references found in Fal.ai and ElevenLabs Engines and in the Location World Core/Engines path are recorded in Review Attention as separate cleanup, without introducing replacement machinery into this Settings plan.

[OpenAI's 2026-09-08 announcement](https://openai.com/index/introducing-chatgpt-images-2-5/) says Images 2.5 is available to Codex users and names [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare) and [Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) as two API models. [The API guide](https://developers.openai.com/api/docs/guides/image-generation) distinguishes their API model IDs. The available Codex image tool takes a prompt and references but exposes no model argument, so Project Settings must not imply that choosing the Codex provider selects one of those exact API IDs.

Existing decisions and overlap: ADRs 0074 and 0090 own Project Settings, ADR 0086 owns the Codex/Engines boundary, and ADR 0102 owns safe credential status/preflight. Plan 0209 implemented that status path; plan 0208 and the current model-library architecture keep provider model routes in Skills. This plan updates the accepted Project preference choices without reopening model discovery, credential storage, or generation execution. Urban Basilica is the read-only desktop verification Project.

## Product Behavior

1. Image offers **ChatGPT Images 2.5 (Codex)** first, always, followed by keyed Fal.ai, Pika, Replicate, and WaveSpeed. New Projects still save `generation.image.provider: "codex"`.
2. Video offers the same keyed general providers. Audio also offers keyed ElevenLabs. World Labs appears in none of these menus; its key is used for Location World generation. With this installation's saved keys, Image shows Codex, Fal.ai, and Replicate; Video shows Fal.ai and Replicate; Audio shows Fal.ai, Replicate, and ElevenLabs. The menus make no claim that a general provider can generate the requested media or model.
3. A saved provider remains an opaque preference when its key is removed or its role is not offered in that menu. Studio explains either the missing key or the provider's unavailability in that menu without rewriting the Project. No provider is selected or saved automatically. If Video or Audio has no configured provider offered in that menu, its selector has no choice; Image still offers Codex.
4. Credential status loads when the Project Settings panel loads and refreshes before showing a provider menu, picking up keys saved globally or changed outside this browser. A status-read failure shows an error and prevents choosing keyed providers; keyless Codex remains available in Image. It never falls back to the hard-coded list. Unrelated Project settings remain readable and editable.
5. A saved key means only that Renku has one, not that the provider supports the selected media kind or requested model, nor that authentication will succeed. Media Producer starts from the saved provider preference and uses its lightweight Skill guidance and the provider's current information for the actual request. If the chosen provider cannot fulfill it, the agent tells the user and asks for another provider or model; Studio does not switch automatically.

No model-level selector, credential validity probe, auto-provider ranking, provider-specific generation form, or new paid API call is in scope. This plan does not promise that an external provider has both GPT Image 2.5 API routes; those routes require separate official-route confirmation under the existing model-library workflow.

## Design Choice

- **Reuse unchanged:** The current fixed arrays ignore configured keys and omit configured providers.
- **Focused extension — selected:** Reuse the existing safe credential resource. Filter keyed general providers for all three Settings selectors, include keyed ElevenLabs only in Audio, exclude World Labs, and prepend Codex for Image.
- **Capability filtering — rejected:** No provider/media matrix, model index, live schema lookup, provider probe, or Core/Engines validator is needed to render these defaults. The agent resolves an actual request through Skills.

## Architecture Shape Gate

| Boundary | Intended files and responsibility |
| --- | --- |
| Core and Engines | No production change for provider selection. Core keeps `ProjectSettingsDocument.generation.*.provider` opaque and owns the existing full-document read/write/validation. Engines receives no provider/media availability or model-choice logic. Existing hard-coded model references identified above remain a separate cleanup, with no new references added here. |
| Studio | `packages/studio/src/features/movie-studio/project-details/project-settings-panel.tsx` reads the existing `readProviderCredentials()` resource alongside Project Settings and owns loading, refresh, and read errors. `project-settings-fields.tsx` derives keyed general and Audio provider choices from that status, excludes World Labs, and prepends Codex for Image. No model or route capability table is involved. Opening a provider menu refreshes status so a global or external key change appears without a new event contract. |
| Agent Skills | `studio-skills/skills/media-producer/SKILL.md` states the general, Audio-only ElevenLabs, and Location World-only World Labs roles, then treats a saved media provider as an initial preference. It determines actual model/operation support using current provider information and lightweight Skill guidance. The Replicate and WaveSpeed provider Skills recognize a saved Project preference as user selection. The agent explains a mismatch and asks the user rather than silently selecting another provider. Update Codex guidance and examples to the Images 2.5 family while keeping exact external provider model IDs in Skills. |

No dispatcher, registry, model/route capability mapping, or new public entrypoint is needed. Stop and revise if implementation checks model or route availability to populate a menu, adds a Core/Engines provider-choice rule, reads Skill indexes in Studio runtime, or changes a persisted provider value without user intent. React remains a display consumer of sanitized key status and the two explicit special-provider roles, not a validator of Project metadata. Keep existing formatting and thin `index.ts` entrypoints.

## Contracts And Data Effects

- The Settings menus use the existing credential status in resource order: keyed general media providers in all three, keyed ElevenLabs only in Audio, and no World Labs. Image additionally prepends `{ provider: 'codex', label: 'ChatGPT Images 2.5 (Codex)' }`. No separate eligibility contract is created.
- The stored `ProjectSettingsDocument` remains version 6. Core accepts the selected provider as the same opaque nonempty string it accepts today. A saved preference may point to an unconfigured or unsuitable provider; that does not invalidate unrelated settings or trigger a replacement.
- The existing `GET /studio-api/provider-credentials` response, project Settings GET/PUT routes, `renku credentials status --json`, and credential file contract do not change. No new browser event or route is introduced.
- The agent interprets the provider default with Skills. If the current request is unsupported by that provider, it reports that fact and asks the user for a compatible choice. Studio, Core, and Engines do not precompute that answer for Settings.
- For Codex Preview/provenance, use `provider: "codex"` and the Images 2.5 product-family identity `model: "chatgpt-images-2.5"` when the tool does not report an exact variant. This string is an editorial family label, not a claimed OpenAI API model ID. Use an exact tool-reported model only if available; never write Flare or Sunburst merely by assumption. This changes current Codex Skill examples, not the opaque Core provenance schema. Keep `gpt-image-2` for external provider routes that actually use it, but do not use it as a fallback identity for new Codex requests.
- Update current architecture documentation and add ADR 0103 for the widened Project preference set and key-aware presentation. Add concise notices near the top of ADRs 0074/0090/0102 where this decision narrows their prior provider-choice wording; keep their original reasoning intact.

## Implementation Slices

1. **Studio selection:** Read safe credential status in `ProjectSettingsPanel`; derive the general, Audio-only ElevenLabs, and excluded World Labs choices in `ProjectSettingsFields`. Replace the hard-coded arrays, prepend the keyless Codex Images 2.5 choice only for Image, distinguish a missing key from a provider not offered in that menu, and handle loading, empty, and error states. Refresh before a menu opens so global key saves appear. Use only local shadcn controls and preserve unrelated Settings fields and autosave behavior.
2. **Agent guidance:** Update `studio-skills/skills/media-producer/SKILL.md` so a saved provider preference is the starting point for Image, Video, or Audio regardless of the provider's catalog. Align `skills/replicate-media-provider/SKILL.md` and `skills/wavespeed-media-provider/SKILL.md` so a saved Project preference counts as user selection. The agent checks the actual requested model or operation using its current provider Skills and tells the user when the preferred provider cannot fulfill it. It asks for a provider or model choice before switching; it does not infer that a saved key means capability. Update Codex guidance and examples to the Images 2.5 family while preserving external GPT Image 2 guidance and the Codex harness boundary.
3. **Accepted direction:** Add ADR 0103 and update `docs/architecture/media-generation.md` to describe the keyed menu and agent-default semantics. Keep historical plans unchanged.

## Tests And Guardrails

- Studio: with this installation's sanitized status fixture, Image shows Codex/Fal.ai/Replicate, Video shows Fal.ai/Replicate, and Audio shows Fal.ai/Replicate/ElevenLabs. World Labs appears nowhere. Test adding or removing a key before opening a menu, a saved preference without a key, a keyed special provider saved in an inapplicable menu, no configured external provider, and status-read error without a hard-coded fallback or silent Project write. Verify the existing Select primitive and no raw controls.
- Skills: cover a preferred provider that cannot fulfill a requested Audio model or operation; the agent explains the mismatch and asks for a choice. Cover Codex Images 2.5 labeling and truthful Preview/provenance without inventing a Flare or Sunburst API variant.
- Architecture: confirm Core keeps the provider value opaque, Engines gains no Settings availability logic, and neither package gains new model-name checks for this feature. Do not add architecture tests tied to private helper names or implementation inventories.

## Final Verification

1. Run focused Studio Settings tests and `pnpm check`, `pnpm lint`, `pnpm test` in Studio. Run `pnpm test:media-generation` in `studio-skills`. Do not install dependencies as part of this work.
2. On desktop, use Urban Basilica without changing real credentials. Confirm Image offers Codex/Fal.ai/Replicate, Video offers Fal.ai/Replicate, Audio offers Fal.ai/Replicate/ElevenLabs, and World Labs appears nowhere. Confirm the saved preference is not silently changed. Exercise key-change refresh and error behavior with mocked credential status in focused Studio tests. Do not run paid generation or expose keys in output.
3. Recheck the current Codex image tool capability and OpenAI release documentation when implementing; if the tool gains an exact model selector, revisit the one-choice assumption before changing Project Settings. Inspect the Codex review/provenance sample and Core's opaque review tests without falsely assigning an API submodel.
4. Inspect `git diff --stat` and complete diffs in both repositories, especially large modified files. Confirm thin `index.ts` entrypoints, no broad dispatcher, no duplicate credential or model catalog, no route/React business-rule ownership, and no unrelated formatting churn. Preserve unrelated working-tree changes.

## Completion Checklist

### Review Area

- [x] Confirm the general provider set, ElevenLabs Audio-only role, World Labs exclusion, and one-choice Codex interpretation as stated in Review Attention.
- [x] Confirm keyed general providers appear in each menu without a route or model capability check.
- [x] Confirm the agent handles an unsupported requested Audio model or operation using Skills and user clarification.
- [x] Confirm final module shape matches the Architecture Shape Gate, with no god file, catch-all helper, or broad dispatcher.

### Architecture And Contracts

- [x] Keep Core's provider preference opaque and Project Settings version 6; add no Core or Engines provider eligibility contract.
- [x] Reuse the existing secret-safe credential status and its `configured` field without a new endpoint or catalog.
- [x] Preserve Codex outside Engines and never claim a Flare/Sunburst API ID without exact tool evidence.
- [x] Keep existing HTTP/CLI contracts, confirmation, concurrency, Preview, and execution behavior unchanged.

### Implementation Slices

- [x] Replace the hard-coded Studio provider arrays with keyed general providers, Audio-only ElevenLabs, no World Labs, and keyless Codex first for Image.
- [x] Handle missing saved provider, zero available external providers, credential read failure, same-browser key save, and external key change on menu open without silent Project mutation.
- [x] Update Codex Images 2.5 labeling, guidance, and examples without altering external GPT Image 2 routes.
- [x] Update Media Producer preference guidance for the provider roles; align Replicate/WaveSpeed Skill wording with saved Project preferences and explain unsupported requests without silently switching providers.
- [x] Add ADR 0103, concise notices on affected older decisions, and current media-generation documentation updates.

### Tests And Guardrails

- [x] Run Studio tests for visible key-driven choices, refresh, empty and error states, and unchanged saved preferences.
- [x] Validate Skill guidance and forward cases for unsupported preferred-provider handling, Codex provenance, and unavailable harness.
- [x] Verify no raw Studio controls, model/route capability filtering, new Core/Engines model-name checks, or architecture test frozen to private names.

### Final Verification

- [x] Run the commands and desktop checks above, or report a concrete environment blocker.
- [x] Inspect full diffs and heavily modified files in both repositories; remove formatting churn and preserve existing work.
- [x] Confirm `index.ts` files remain thin and no checklist item depends on an unreviewable code shape.
- [x] Mark the plan complete only after implementation and verification.

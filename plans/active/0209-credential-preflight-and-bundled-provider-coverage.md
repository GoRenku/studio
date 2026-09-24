# 0209 Credential Preflight And Bundled Provider Coverage

Status: implemented; isolated browser smoke run pending because port 5174 is occupied
Date: 2026-09-24

## Summary

Let an agent detect a missing saved provider API key immediately after selecting a provider, before it writes a generation prompt, prepares native inputs, or requests a provider schema. Give the user a direct link to the existing global **Settings** key editor and clear instructions for saving the key, then resume the same request after a fresh status check.

Use Fal.ai's current bundled route list as the coverage baseline for Pika, WaveSpeed, and Replicate. Add each corresponding model and operation to the `studio-skills` source checkout when that provider actually offers an exact media route. A provider may expose several Fal.ai operations through one model endpoint, or may offer only some variants; matching coverage means matching available model families and useful operations, not equal route counts or invented aliases.

This comparison is a one-time catalog task. It does not require future model additions or users of other providers to match Fal.ai coverage.

## Review Attention

- **Behavior beyond the literal request:** Apply the missing-key preflight to Location World generation as well as Media Producer. It uses the same global key editor and otherwise can spend substantial time preparing four images before the World Labs key failure. Recheck after a one-request provider switch. A saved key is only a presence check, not a remote validity test.
- **New contracts:** Add read-only `renku credentials status --json`, returning the existing sanitized `ProviderCredentialsResource`. Add the local Studio URL `/?settings=provider-credentials`, which opens the existing Settings dialog. No new credential write command, HTTP endpoint, Settings field, model-library schema, or provider enablement flag is proposed. The existing `renku studio server status --json` supplies the browser URL.
- **Agent behavior:** On a missing selected-provider key, stop preparation, name the provider, open the Settings link when browser control is available, or give the user the same clickable link and instructions. Never request the key in chat, copy it into a request document, switch providers silently, or claim a configured key was authenticated. Continue only after the user saves and the agent rereads status.
- **Coverage expansion:** Pika and WaveSpeed can expose audio routes, although current Media Producer guidance describes them only as image/video lanes. If an exact Seed Audio 1.0 route is confirmed, update their agent-facing audio guidance and relevant purpose routing. Keep Replicate and WaveSpeed as explicit advanced choices; this does not change Project default providers or add a new Settings choice.
- **Data effects:** No Project migration, credential-file rewrite, personal-library mutation, file move, or deletion. Bundled routes change only in the `studio-skills` source checkout and reach installed agents through a later plugin release, which this plan does not publish.
- **Assumption:** Fal.ai's 32 current bundled routes are the baseline at implementation start. External provider catalogs can change; require a current official route page for each addition. An absent or ambiguous equivalent remains absent and is reported in the coverage handoff.
- **Approval boundary:** The user has requested the credential warning, Settings navigation, and bundled coverage work. Any discovery that a model needs a new execution protocol, provider adapter, paid certification run, or new default-provider policy is separate scope to present before implementing it.

## Requirement Ledger

| ID | Source | Outcome | Owner and proof |
| --- | --- | --- | --- |
| R1 | User | Warn before creative/provider preparation when the selected external provider has no saved key | Existing Core credential read, new CLI projection, Media Producer and Location World skill evaluations |
| R2 | User | Take the user directly to the current key editor and explain how to save a key | Studio Settings deep link and agent instructions; desktop navigation check |
| R3 | User | Fill Pika, WaveSpeed, and Replicate bundled coverage where Fal.ai's models are also offered | Model Researcher bundled-authoring workflow, three provider indexes, route-by-route official-source worksheet |
| R4 | Current rules, ADRs 0084 and 0086 | Keep secrets write-only in Studio and provider/model selection agent-owned | Existing sanitized resource, unchanged Engines execution and final validation |
| R5 | Current rules, ADR 0100 | Keep bundled routes as discovery and optional advice, not an execution allowlist or local schema | Existing three-field Core library projection and selected-route live schema workflow |
| R6 | Hard architecture and security boundary | Keep CLI and HTTP thin; do not duplicate key parsing or expose secret values | Core-owned read, CLI projection test, no secrets in URL, output, logs, cache, or generated HTML |

## Product Behavior

### Missing-key conversation

1. Read the relevant Project context and explicit user preference, then identify the selected execution provider. Codex built-in image generation does not use a Renku provider key and skips this check.
2. Call `renku credentials status --json` once for that selection, before prompt writing, reference preparation, route schema fetching, visualization materialization, or World Labs input preparation. The result contains the existing ordered provider, label, and `configured` boolean only. Check the selected provider, not whether every provider has a key.
3. If the key is absent, explain that generation with that provider cannot proceed yet. Use `renku studio server status --json` to obtain the live local browser URL; start Studio through its existing foreground workflow if necessary. Open `<browserUrl>/?settings=provider-credentials` when the active agent host can open a browser, and always provide the same link and instructions: enter the selected provider's key in **Settings → Provider API keys**, select **Save**, then tell the agent to continue. If first-run Project Library setup is still required, guide the user through its existing steps to the optional provider-key step.
4. After the user says the key was saved, rerun `renku credentials status --json`. If still absent, explain the unresolved state and keep the request paused. If present, resume with the same selected provider and normal schema, Preview, confirmation, execution, and attachment flow. Do not automatically retry a previously submitted job; this preflight occurs before any submission.
5. A configured-but-invalid key is diagnosed by the existing live provider boundary. No remote key check, balance lookup, credential deletion, chat entry, or automatic provider fallback is added. A selected provider change triggers a new status check before preparing that route.

The status command itself remains informational and exits successfully when keys are absent; absence is an expected state, not a command error. A credential-file read failure retains Core's structured `PROVIDER_CREDENTIALS002` diagnostic and is not reported as “missing key.” Existing `PROVIDER_CREDENTIALS004` remains the authoritative operation-time defense if a key is removed after the preflight.

### Bundled model coverage

The comparison unit is the **same named model family and version with the same useful operation**, using each provider's exact API identity. A unified Replicate model can cover text, image, and reference inputs without three duplicate entries. An image-to-video endpoint does not become reference-to-video merely because the model family name matches. Do not substitute an older release, Lite tier, or different model to fill a gap.

Baseline inventory from `skills/fal-ai-media-provider/references/supported-routes.json` (32 routes):

| Family and version | Fal.ai baseline operations to compare | Current cross-provider evidence and research task |
| --- | --- | --- |
| Seed Audio 1.0 | One audio route | Pika lists Seed Audio in its [catalog](https://dev.pika.art/enterprise) and WaveSpeed has a [Seed Audio route](https://wavespeed.ai/models/bytedance/seed-audio-1.0); confirm Pika's exact media endpoint and Replicate availability. |
| GPT Image 2 | Text-to-image, image-edit | Replicate has [one combined model](https://replicate.com/openai/gpt-image-2); WaveSpeed documents [two endpoints](https://wavespeed.ai/gpt-image-2-api); verify Pika endpoint IDs. |
| Nano Banana 2 and Pro | Text-to-image, image-edit for each tier | Replicate documents [Nano Banana 2](https://replicate.com/google/nano-banana-2) and [Pro](https://replicate.com/google/nano-banana-pro); WaveSpeed documents [Nano Banana 2 variants](https://wavespeed.ai/nano-banana-2-api); verify exact Pika and WaveSpeed Pro routes. |
| Grok Imagine Image | Text-to-image, image-edit | Replicate's [single route](https://replicate.com/xai/grok-imagine-image/readme) describes both; confirm Pika and WaveSpeed routes for this version, not Image 2.0 or Quality. |
| Seedance 2.5 | Reference-to-video | Replicate lists [Seedance 2.5](https://replicate.com/bytedance); Pika and WaveSpeed advertise the family. Verify that each actual route supports the required reference mode. |
| Seedance 2.0 standard, Mini, Fast | Text-to-video, image-to-video/first-last-frame, reference-to-video for each tier | Pika documents [Mini reference input](https://dev.pika.art/models/bytedance/seedance-2.0-mini/reference-to-video/playground); Replicate lists [unified Mini](https://replicate.com/bytedance/seedance-2.0-mini); WaveSpeed lists [Seedance routes](https://wavespeed.ai/models). Verify all nine Fal.ai operation/tier combinations independently. |
| MiniMax H3 and H3 Max | Text-to-video, image-to-video/first-last-frame, reference-to-video for each tier | Pika and WaveSpeed already bundle H3 routes. Research Max and missing H3 operations against each provider's current exact pages; do not infer Replicate availability from older Hailuo models. |
| Gemini Omni Flash 1.1 | Text-to-video, image-to-video/first-last-frame, reference-to-video, video-edit | Pika documents [1.1 reference-to-video](https://dev.pika.art/models/google/gemini-omni-1.1-flash/reference-to-video/playground) and [video-to-video](https://dev.pika.art/models/google/gemini-omni-1.1-flash/video-to-video/playground); Replicate documents [one unified 1.1 route](https://replicate.com/google/gemini-omni-1.1). Verify the exact operation set and WaveSpeed's version. |
| Wan 3.0 Prime | Text-to-video, image-to-video/first-last-frame, reference-to-video | Pika documents [Prime image-to-video](https://dev.pika.art/models/alibaba/wan3.0-video-prime/image-to-video/playground); verify its other exact Prime operations and WaveSpeed/Replicate Prime availability. Wan 3.0 without Prime is not a match. |

These public pages establish candidate availability, not final executable route IDs for every operation. The bundled-authoring pass must inspect every one of the 32 Fal.ai baseline entries, record its exact same-family/same-operation outcome for Pika, WaveSpeed, and Replicate, and use the provider's official API page to identify every route added. Keep that review worksheet in the plan's implementation evidence or pull-request body, not in a new runtime capability matrix. Record **already bundled**, **added with exact official URL**, **not offered**, or **unconfirmed** for each provider comparison. Do not label an unconfirmed route supported.

For an eligible route, use the existing Model Researcher bundled workflow: add or update the provider's `supported-routes.json` entry with exact `apiId` and display name, reuse the existing canonical `modelKey` and guide where craft is shared, and add provider-specific adapter advice only when actual notation or input ordering differs. A valid route needs no new guide, local schema, or per-model compatibility certificate. Use the selected provider's live/cached schema during ordinary preparation; do not make paid requests to fill the index.

### Non-goals

No model enable/disable controls, completeness score, new capability registry, cross-provider auto-selection, per-model local schemas, generic provider protocol work, changes to personal model libraries, or ElevenLabs coverage parity. Existing Project provider defaults and Codex built-in image behavior remain unchanged. Curated route additions do not claim that all provider requests have been executed successfully.

## Current Evidence And Overlap

- Core already owns the six-provider descriptor catalog, saved-key lookup, and sanitized `ProviderCredentialsResource`; Studio already has token-protected read/update HTTP and a write-only Settings dialog. The CLI currently obtains credentials only when `generation schema show`, `validate`, or `execute` creates an Engines context, producing `PROVIDER_CREDENTIALS004` after agent preparation may have begun.
- `renku studio server status --json` already reports the canonical browser URL. `AppSettingsDialog` appears in both the Project Library and selected-Project header but has no direct URL opening contract. The Settings link needs only local UI state; the credential HTTP resource and browser token policy stay intact.
- ADR 0084 explicitly left a credential CLI command as a separate decision. This request supplies that decision; record the adopted read-only command and deep link in a new ADR rather than rewriting the older rationale. ADRs 0086 and 0100 keep provider selection, route discovery, provider schema, and execution in their current owners.
- Plan 0195 implemented the shared inline configuration and requires broad provider/model choices with one selected route inspected at a time. Plan 0208 and ADR 0100 implemented the personal model library; bundled authoring must edit the sister repository, not `generation models import` or an installed plugin cache.
- Urban Basilica supplies a realistic Project for a read-only selection and Settings-navigation walkthrough. Use isolated homes for missing-key tests; never edit its real credentials or submit paid media to verify this plan.

## Architecture Shape Gate

| Boundary | Intended shape |
| --- | --- |
| Core | Reuse `packages/core/src/server/provider-credentials/service.ts` and its existing public `readProviderCredentials`. No new secret parser, status DTO, or persistence owner. `provider-credentials/index.ts` remains a thin public entrypoint. |
| CLI | Add focused `packages/cli/src/commands/credentials-command.ts` for `renku credentials status`; register it in `packages/cli/src/cli.ts`. It calls Core once and formats the existing sanitized resource. No provider-specific conditions or credential-file reads in CLI. |
| Studio | Update `packages/studio/src/features/settings/app-settings-dialog.tsx` to recognize and consume `?settings=provider-credentials`, open/load the existing dialog, and clear only that query parameter on dismissal while preserving other route parameters. Reuse `ProviderCredentialsFields` and the existing API service. No new Settings page, route handler, or form. |
| Agent Skills | Update `studio-skills/skills/media-producer/SKILL.md` and `skills/location-world-producer/SKILL.md` at their shared pre-generation decision points; keep provider Skills focused on exact selected-route preparation. Update `references/inline-generation-configuration.md` only for rechecking when the user changes provider. |
| Bundled route research | Use `skills/model-researcher/SKILL.md` and `references/bundled-authoring.md`; edit only the three existing provider indexes plus existing guide/adapter files when real provider-specific advice warrants it. Do not add a route registry or a script that guesses cross-provider IDs. |

There is no new dispatcher or registry. The CLI entrypoint remains a thin command dispatch, the Settings component remains one existing dialog, and the route indexes remain independent provider-owned documents. Stop and revise the slice if credential status logic appears in React or CLI, if model availability becomes a Core/Engines allowlist, or if parity work demands a provider-protocol change rather than an exact route entry.

## Contracts

- `renku credentials status --json` returns the existing `ProviderCredentialsResource` shape: `{ "providers": [{ "provider": string, "label": string, "configured": boolean }] }`, including all six Core-managed providers. Without `--json`, print one line per provider as `<label>: configured` or `<label>: not configured`, without key names or values. It needs no active Project or running Studio and does not fail merely because every key is absent.
- `?settings=provider-credentials` is a local Studio browser URL contract. Its value never contains a provider id, secret, Project id, or return payload. It opens the global write-only key editor, not Project workflow Settings. Closing or saving removes the parameter without navigating away from the current Project route.
- `PROVIDER_CREDENTIALS002` remains the Core read failure; `PROVIDER_CREDENTIALS004` remains the missing-key failure at actual provider operations. No new missing-key diagnostic is needed because the agent warning is based on a successful sanitized status read.
- Existing `generation models list/show`, personal-library shape, Engines provider IDs, schema/validate/execute requests, Preview, confirmation, and provenance contracts stay unchanged. The `studio-skills` indexes retain their current editorial route fields; only exact entries and warranted advice change.

## Implementation Slices

1. **Safe status and navigation (Studio repository):** Add the CLI status command, wire help/docs, and add the query-driven opening to the existing Settings dialog. Keep Core/HTTP unchanged. Cover empty, partially configured, and unreadable isolated homes at the Core/CLI boundary, and root/selected-Project deep-link behavior in Studio tests.
2. **Agent preflight (studio-skills repository):** Place the selected-provider check before Media Producer prompt/schema/configuration work and before World Labs preparation. Provide the link and concise save/resume instructions; rerun status after a save or provider switch. Add skill evaluation scenarios for no keys, another provider's key only, configured key, Codex image, invalid saved key at live validation, and first-run setup.
3. **Provider parity research and bundled entries (studio-skills repository):** Apply Model Researcher's bundled workflow to the 32-route Fal.ai worksheet. Add confirmed Pika, WaveSpeed, and Replicate exact routes to their existing indexes. Reuse canonical guides; write only useful provider-specific advice. If confirmed Seed Audio routes are added to Pika/WaveSpeed, update their provider Skill descriptions and Media Producer audio lane/selector guidance so the added routes are reachable as explicit choices.
4. **Accepted documentation:** Add ADR 0102 for read-only credential preflight, direct Settings navigation, and bundled route-parity interpretation; add a short pointer near the top of ADR 0084 because its original decision deferred a credential CLI command. Update current CLI and model-library/agent documentation. Do not amend implemented historical plans.

## Tests And Guardrails

- Core's existing credential tests remain the owning coverage for missing/partial status, unreadable credential file, and secret-safe serialization. Add a case only if a real preflight edge is not already covered; do not repeat the matrix in CLI and UI.
- CLI tests prove `credentials status` needs no Project/Studio process, delegates to Core, prints only sanitized booleans, preserves `PROVIDER_CREDENTIALS002`, and succeeds with all keys absent.
- Studio tests prove a direct link opens the real Settings dialog at `/` and a selected Project route, loads current key status, saves through the existing update path, and removes only the Settings query key on close. Desktop E2E checks one representative no-key flow.
- Skill evals prove no prompt or provider schema work precedes the warning; no secret enters chat/URL/artifacts; no silent provider change; status is reread after save and on provider switch; and a valid saved key proceeds to normal Preview/confirmation. Location World retains its separate paid Marble approval.
- `studio-skills` route validation and Model Researcher bundled evals cover exact IDs, uniqueness, guide/adapter links, existing routes preserved, and a selected-route preparation walkthrough without paid generation. Review each same-family operation against its official source; automated tests cannot prove market availability.
- Guardrails protect the stable boundary (CLI does not parse `.env`; Studio does not expose secret values; bundled entries are not copied into a Core/Engines allowlist), without source-text tests naming private helpers or catalog inventories.

## Documentation And Decision Effects

Update `docs/cli/commands.md` for the status command and direct Settings link. Update `docs/architecture/media-model-library.md` only to clarify that bundled indexes can have unequal route counts across providers while representing the same available operations. Add ADR 0102 and the concise ADR 0084 notice described above. Update `studio-skills` Media Producer/Location World/provider guidance and evaluations in the same coordinated work. No user-facing installation instructions or release publication are required in this plan; bundled additions reach users when the separately owned plugin release occurs.

## Final Verification

1. Run focused Core/CLI/Studio tests and `pnpm check`, `pnpm lint`, and `pnpm test` in Studio when dependencies are present. Do not install dependencies as part of implementation without an explicit request.
2. Run `pnpm test:media-generation` and `pnpm test` in `studio-skills`. Manually follow every added route's `modelKey`, guide, and adapter links, and perform representative selected-route preparation without a paid provider call.
3. On desktop, use an isolated empty credential home to open the direct Settings URL from the agent instructions, save a test key, and verify a fresh status read. Do not put a real key in screenshots or logs. Verify the existing Urban Basilica Project route remains intact when Settings closes.
4. Produce the completed 32-by-3 coverage worksheet with official URLs and explicit unavailable/unconfirmed outcomes. Compare the provider index diff with the worksheet; no speculative route may be included.
5. Inspect `git diff --stat` and the complete diffs in both repositories. Inspect any large or heavily modified file, confirm `index.ts` files remain thin, no broad dispatcher or catch-all helper appears, no old import/API path is retained as a shim, and no unrelated formatting churn or existing worktree change was overwritten.

## Completion Checklist

### Review Area

- [x] Confirm each new behavior maps to R1–R6 and that no provider policy, Settings form, or execution protocol was expanded silently.
- [x] Confirm the final files match the Architecture Shape Gate and no `index.ts`, CLI command, React dialog, or Skill entrypoint became a catch-all implementation.
- [x] Confirm existing unrelated Studio working-tree changes and the `studio-skills` checkout were preserved.

### Architecture And Contracts

- [x] Add the exact read-only `renku credentials status --json` contract using Core's existing sanitized resource, with no CLI secret parsing or Project dependency.
- [x] Add the exact `?settings=provider-credentials` URL behavior to the existing dialog without changing the credential HTTP/store contract.
- [x] Preserve `PROVIDER_CREDENTIALS002` and `PROVIDER_CREDENTIALS004` at their existing owning boundaries; do not add duplicate runtime key validation.
- [x] Keep bundled indexes editorial and exact, with no runtime capability matrix, schema copy, or provider/model allowlist.

### Implementation Slices

- [x] Wire CLI command, help, and docs; make all-absent status a successful safe result.
- [x] Open/load/close global Settings through the deep link on Project Library and Project routes, preserving unrelated query parameters and write-only fields.
- [x] Update Media Producer and Location World to check the selected key before substantial preparation; explain saving in Settings and reread status after user action or provider switch.
- [x] Preserve Codex image handling, Project defaults, Preview, confirmation, output review, provenance, and Location World paid approval.
- [x] Compare all 32 Fal.ai routes against Pika, WaveSpeed, and Replicate by exact family/version/operation; document every non-match and ambiguity.
- [x] Add or update only officially confirmed exact routes in the three existing `supported-routes.json` files; retain existing entries and reuse shared `modelKey` guidance.
- [x] Make confirmed Pika/WaveSpeed audio entries reachable through appropriate agent guidance, without changing default providers or advanced-provider policy.

### Tests And Guardrails

- [x] Verify safe all-absent, partial, and Core read-error status behavior at the owning layer; keep CLI/UI tests focused on their boundaries.
- [x] Verify direct-link desktop behavior and URL cleanup on both major Studio surfaces.
- [x] Evaluate no-key, one-other-key, saved-key, Codex, key-changed, selected-provider-changed, and World Labs conversations before any paid request.
- [x] Run bundled route validation and representative model preparation with selected live/cached schemas or fixtures, without requiring a separate per-model certification gate.
- [x] Check secret leakage and package import boundaries without hard-coded implementation-name tests.

### Documentation And Final Verification

- [x] Add ADR 0102 and a concise ADR 0084 pointer; update current CLI and model-library docs and relevant `studio-skills` references/evals.
- [x] Run Studio and `studio-skills` commands listed in Final Verification, or report an actual environment blocker precisely.
- [x] Finish the official-source 32-by-3 worksheet and inspect all affected route/guide links.
- [x] Inspect complete diffs and large files in both repositories; remove format-only churn and confirm no checklist item is satisfied by accepting unreviewable code structure.
- [x] Mark this plan implemented only after code, skills, tests, documentation, and desktop verification are complete; plugin publication remains separately authorized.

## Verification Results

- Studio `pnpm check` and `pnpm test` passed. Focused CLI and Settings tests passed, including an isolated all-absent CLI home, Core read-error propagation, deep-link Save cleanup, and preservation of other Project query parameters.
- `studio-skills` `pnpm test:media-generation` and `pnpm test` passed. The route validator accepted 108 provider routes; all 67 changed or confirmed official route links returned HTTP 200, and each bundled route's canonical guide and adapter path resolved.
- In the running desktop Studio, `/?settings=provider-credentials` opened the existing editor with Pika visibly unconfigured. Cancel removed the query key at `/` and at an Urban Basilica Scene route while preserving that route and an unrelated `foo=test` parameter. No key was entered or changed.
- The extended isolated-home browser smoke test was discovered and compiled, but its run stopped before executing because another process already owns its fixed port 5174. That process was left running. The existing smoke test covers saving a fake key in an isolated home; this extension adds deep-link entry and a fresh Core status read after Save. Rerun it when the port is free.
- No paid generation or plugin release was performed. Curated route entries establish official discovery and guidance, with live schema and ordinary provider execution still authoritative.

## Implementation Evidence: Fal.ai Route Review

Checked on 2026-09-24 against [Pika's operation catalog](https://dev.pika.art/llms.txt), [WaveSpeed's model sitemap](https://wavespeed.ai/model-sitemap.xml), and the linked official model pages. “Unconfirmed” means the exact model/version and operation were not established from a published route; no entry was added. “Not offered” reflects the published input schema. First/last-frame support is listed only where the route documentation or schema confirms it. Each linked route is an editorial discovery entry, not a paid execution result.

| Fal.ai baseline route | Pika | WaveSpeed | Replicate |
| --- | --- | --- | --- |
| `bytedance/seed-audio-1.0` | Added [`bytedance/seed-audio-1.0/text-to-audio`](https://dev.pika.art/llms/bytedance/seed-audio-1.0/text-to-audio) | Added [`bytedance/seed-audio-1.0`](https://wavespeed.ai/models/bytedance/seed-audio-1.0) | Unconfirmed |
| `openai/gpt-image-2` | Added [`openai/gpt-image-2/text-to-image`](https://dev.pika.art/llms/openai/gpt-image-2/text-to-image) | Added [`openai/gpt-image-2/text-to-image`](https://wavespeed.ai/models/openai/gpt-image-2/text-to-image) | Added [`openai/gpt-image-2`](https://replicate.com/openai/gpt-image-2) |
| `openai/gpt-image-2/edit` | Added [`openai/gpt-image-2/image-to-image`](https://dev.pika.art/llms/openai/gpt-image-2/image-to-image) | Added [`openai/gpt-image-2/edit`](https://wavespeed.ai/models/openai/gpt-image-2/edit) | Added [`openai/gpt-image-2`](https://replicate.com/openai/gpt-image-2) |
| `fal-ai/nano-banana-2` | Added [`google/gemini-3.1-flash-image/text-to-image`](https://dev.pika.art/llms/google/gemini-3.1-flash-image/text-to-image) | Added [`google/nano-banana-2/text-to-image`](https://wavespeed.ai/models/google/nano-banana-2/text-to-image) | Added [`google/nano-banana-2`](https://replicate.com/google/nano-banana-2) |
| `fal-ai/nano-banana-2/edit` | Added [`google/gemini-3.1-flash-image/image-to-image`](https://dev.pika.art/llms/google/gemini-3.1-flash-image/image-to-image) | Added [`google/nano-banana-2/edit`](https://wavespeed.ai/models/google/nano-banana-2/edit) | Added [`google/nano-banana-2`](https://replicate.com/google/nano-banana-2) |
| `fal-ai/nano-banana-pro` | Added [`google/gemini-3-pro-image/text-to-image`](https://dev.pika.art/llms/google/gemini-3-pro-image/text-to-image) | Added [`google/nano-banana-pro/text-to-image`](https://wavespeed.ai/models/google/nano-banana-pro/text-to-image) | Added [`google/nano-banana-pro`](https://replicate.com/google/nano-banana-pro) |
| `fal-ai/nano-banana-pro/edit` | Added [`google/gemini-3-pro-image/image-to-image`](https://dev.pika.art/llms/google/gemini-3-pro-image/image-to-image) | Added [`google/nano-banana-pro/edit`](https://wavespeed.ai/models/google/nano-banana-pro/edit) | Added [`google/nano-banana-pro`](https://replicate.com/google/nano-banana-pro) |
| `xai/grok-imagine-image` | Added [`x-ai/grok-imagine-image/text-to-image`](https://dev.pika.art/llms/x-ai/grok-imagine-image/text-to-image) | Added [`x-ai/grok-imagine-image/text-to-image`](https://wavespeed.ai/models/x-ai/grok-imagine-image/text-to-image) | Added [`xai/grok-imagine-image`](https://replicate.com/xai/grok-imagine-image) |
| `xai/grok-imagine-image/edit` | Added [`x-ai/grok-imagine-image/image-to-image`](https://dev.pika.art/llms/x-ai/grok-imagine-image/image-to-image) | Added [`x-ai/grok-imagine-image/edit`](https://wavespeed.ai/models/x-ai/grok-imagine-image/edit) | Added [`xai/grok-imagine-image`](https://replicate.com/xai/grok-imagine-image) |
| `bytedance/seedance-2.5/text-to-video` | Added [`bytedance/seedance-2.5/text-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.5/text-to-video) | Added [`bytedance/seedance-2.5/text-to-video`](https://wavespeed.ai/models/bytedance/seedance-2.5/text-to-video) | Existing [`bytedance/seedance-2.5`](https://replicate.com/bytedance/seedance-2.5/versions/fa8b2706824084e968dfe1d1cdff8e0193b40ef908827e3d2940a927704a5f43/api) entry now lists this operation |
| `bytedance/seedance-2.5/image-to-video` (including optional last frame) | Added [`bytedance/seedance-2.5/image-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.5/image-to-video) | Added [`bytedance/seedance-2.5/image-to-video`](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2.5-image-to-video) | Existing [`bytedance/seedance-2.5`](https://replicate.com/bytedance/seedance-2.5/versions/fa8b2706824084e968dfe1d1cdff8e0193b40ef908827e3d2940a927704a5f43/api) entry now lists image and first/last-frame operations |
| `bytedance/seedance-2.5/reference-to-video` | Added [`bytedance/seedance-2.5/reference-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.5/reference-to-video) | Existing [`bytedance/seedance-2.5/text-to-video`](https://wavespeed.ai/models/bytedance/seedance-2.5/text-to-video) route accepts optional reference images, videos, and audio | Added [`bytedance/seedance-2.5`](https://replicate.com/bytedance/seedance-2.5) |
| `bytedance/seedance-2.0/text-to-video` | Added [`bytedance/seedance-2.0/text-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0/text-to-video) | Added [`bytedance/seedance-2.0/text-to-video`](https://wavespeed.ai/models/bytedance/seedance-2.0/text-to-video) | Added [`bytedance/seedance-2.0`](https://replicate.com/bytedance/seedance-2.0) |
| `bytedance/seedance-2.0/image-to-video` | Added [`bytedance/seedance-2.0/image-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0/image-to-video) | Added [`bytedance/seedance-2.0/image-to-video`](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2.0-image-to-video) with optional `last_image` | Added [`bytedance/seedance-2.0`](https://replicate.com/bytedance/seedance-2.0) |
| `bytedance/seedance-2.0/reference-to-video` | Added [`bytedance/seedance-2.0/reference-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0/reference-to-video) | Existing [`bytedance/seedance-2.0/text-to-video`](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2.0-text-to-video) accepts reference inputs | Added [`bytedance/seedance-2.0`](https://replicate.com/bytedance/seedance-2.0) |
| `bytedance/seedance-2.0/mini/text-to-video` | Added [`bytedance/seedance-2.0-mini/text-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0-mini/text-to-video) | Added [`bytedance/seedance-2.0-mini/text-to-video`](https://wavespeed.ai/models/bytedance/seedance-2.0-mini/text-to-video) | Added [`bytedance/seedance-2.0-mini`](https://replicate.com/bytedance/seedance-2.0-mini) |
| `bytedance/seedance-2.0/mini/image-to-video` | Added [`bytedance/seedance-2.0-mini/image-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0-mini/image-to-video) | Added [`bytedance/seedance-2.0-mini/image-to-video`](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2.0-mini-image-to-video) with optional `last_image` | Added [`bytedance/seedance-2.0-mini`](https://replicate.com/bytedance/seedance-2.0-mini) |
| `bytedance/seedance-2.0/mini/reference-to-video` | Added [`bytedance/seedance-2.0-mini/reference-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0-mini/reference-to-video) | Existing [`bytedance/seedance-2.0-mini/text-to-video`](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2.0-mini-text-to-video) accepts reference inputs | Added [`bytedance/seedance-2.0-mini`](https://replicate.com/bytedance/seedance-2.0-mini) |
| `bytedance/seedance-2.0/fast/text-to-video` | Added [`bytedance/seedance-2.0-fast/text-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0-fast/text-to-video) | Added [`bytedance/seedance-2.0-fast/text-to-video`](https://wavespeed.ai/models/bytedance/seedance-2.0-fast/text-to-video) | Added [`bytedance/seedance-2.0-fast`](https://replicate.com/bytedance/seedance-2.0-fast) |
| `bytedance/seedance-2.0/fast/image-to-video` | Added [`bytedance/seedance-2.0-fast/image-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0-fast/image-to-video) | Added [`bytedance/seedance-2.0-fast/image-to-video`](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2.0-fast-image-to-video) with optional `last_image` | Added [`bytedance/seedance-2.0-fast`](https://replicate.com/bytedance/seedance-2.0-fast) |
| `bytedance/seedance-2.0/fast/reference-to-video` | Added [`bytedance/seedance-2.0-fast/reference-to-video`](https://dev.pika.art/llms/bytedance/seedance-2.0-fast/reference-to-video) | Existing [`bytedance/seedance-2.0-fast/text-to-video`](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-2.0-fast-text-to-video) accepts reference inputs | Added [`bytedance/seedance-2.0-fast`](https://replicate.com/bytedance/seedance-2.0-fast) |
| `minimax/h3/text-to-video` | Already bundled [`minimax/h3/text-to-video`](https://dev.pika.art/llms/minimax/h3/text-to-video) | Already bundled [`wavespeed-ai/minimax-h3/text-to-video`](https://wavespeed.ai/models/wavespeed-ai/minimax-h3/text-to-video) | Added [`minimax/h3`](https://replicate.com/minimax/h3) |
| `minimax/h3/image-to-video` | Already bundled [`minimax/h3/image-to-video`](https://dev.pika.art/llms/minimax/h3/image-to-video) | Already bundled [`wavespeed-ai/minimax-h3/image-to-video`](https://wavespeed.ai/models/wavespeed-ai/minimax-h3/image-to-video) | Added [`minimax/h3`](https://replicate.com/minimax/h3) |
| `minimax/h3/reference-to-video` | Added [`minimax/h3/reference-to-video`](https://dev.pika.art/llms/minimax/h3/reference-to-video) | Already bundled [`wavespeed-ai/minimax-h3/reference-to-video`](https://wavespeed.ai/models/wavespeed-ai/minimax-h3/reference-to-video) | Added [`minimax/h3`](https://replicate.com/minimax/h3) |
| `minimax/h3-max/text-to-video` | Unconfirmed | Unconfirmed | Unconfirmed |
| `minimax/h3-max/image-to-video` | Unconfirmed | Unconfirmed | Unconfirmed |
| `minimax/h3-max/reference-to-video` | Unconfirmed | Unconfirmed | Unconfirmed |
| `google/gemini-omni-flash/v1.1/text-to-video` | Added [`google/gemini-omni-1.1-flash/text-to-video`](https://dev.pika.art/llms/google/gemini-omni-1.1-flash/text-to-video) | Added [`google/gemini-omni-1.1-flash/text-to-video`](https://wavespeed.ai/models/google/gemini-omni-1.1-flash/text-to-video) | Added [`google/gemini-omni-1.1`](https://replicate.com/google/gemini-omni-1.1) |
| `google/gemini-omni-flash/v1.1/image-to-video` | Added [`google/gemini-omni-1.1-flash/image-to-video`](https://dev.pika.art/llms/google/gemini-omni-1.1-flash/image-to-video) | Added [`google/gemini-omni-1.1-flash/image-to-video`](https://wavespeed.ai/docs/docs-api/google/google-gemini-omni-1.1-flash-image-to-video) with optional `last_image` | Added [`google/gemini-omni-1.1`](https://replicate.com/google/gemini-omni-1.1) |
| `google/gemini-omni-flash/v1.1/reference-to-video` | Added [`google/gemini-omni-1.1-flash/reference-to-video`](https://dev.pika.art/llms/google/gemini-omni-1.1-flash/reference-to-video) | Added [`google/gemini-omni-1.1-flash/reference-to-video`](https://wavespeed.ai/models/google/gemini-omni-1.1-flash/reference-to-video) | Added [`google/gemini-omni-1.1`](https://replicate.com/google/gemini-omni-1.1) |
| `google/gemini-omni-flash/v1.1/edit` | Added [`google/gemini-omni-1.1-flash/video-to-video`](https://dev.pika.art/llms/google/gemini-omni-1.1-flash/video-to-video) | Added [`google/gemini-omni-1.1-flash/video-edit`](https://wavespeed.ai/models/google/gemini-omni-1.1-flash/video-edit) | Added [`google/gemini-omni-1.1`](https://replicate.com/google/gemini-omni-1.1) |
| `alibaba/wan-3.0-prime/text-to-video` | Added [`alibaba/wan3.0-video-prime/text-to-video`](https://dev.pika.art/llms/alibaba/wan3.0-video-prime/text-to-video) | Added [`alibaba/wan-3.0-prime/text-to-video`](https://wavespeed.ai/models/alibaba/wan-3.0-prime/text-to-video) | Added [`alibaba/wan-3-prime`](https://replicate.com/alibaba/wan-3-prime) |
| `alibaba/wan-3.0-prime/image-to-video` | Added [`alibaba/wan3.0-video-prime/image-to-video`](https://dev.pika.art/llms/alibaba/wan3.0-video-prime/image-to-video) | Added [`alibaba/wan-3.0-prime/image-to-video`](https://wavespeed.ai/docs/docs-api/alibaba/alibaba-wan-3.0-prime-image-to-video) with optional `last_image` | Added [`alibaba/wan-3-prime`](https://replicate.com/alibaba/wan-3-prime/versions/736267d3620794f7e744f46c814304617a16ff3d19e43ee70daa7bff87c7d150/api) (first/last frame unconfirmed) |
| `alibaba/wan-3.0-prime/reference-to-video` | Added [`alibaba/wan3.0-video-prime/omni-video`](https://dev.pika.art/llms/alibaba/wan3.0-video-prime/omni-video) | Added [`alibaba/wan-3.0-prime/reference-to-video`](https://wavespeed.ai/models/alibaba/wan-3.0-prime/reference-to-video) | Not offered |

Outcome: 29 Pika routes added, 24 WaveSpeed routes added, and 11 Replicate routes added. The existing two Pika H3 routes and three WaveSpeed H3 routes remain. All additions reuse canonical `modelKey` guides; no provider schema or runtime allowlist was copied into Skills. Replicate's unified endpoints account for several Fal.ai operation rows. WaveSpeed's Seedance 2.0 text endpoints accept reference inputs and its Seedance 2.0, Gemini Omni Flash 1.1, and Wan 3.0 Prime image endpoints accept an optional last frame. Replicate Wan Prime first/last-frame support remains unconfirmed. The two additional Fal.ai Seedance 2.5 operations and their provider counterparts were confirmed on 2026-09-24 after the initial 32-route comparison. This is part of the same one-time catalog task, not a continuing coverage rule.

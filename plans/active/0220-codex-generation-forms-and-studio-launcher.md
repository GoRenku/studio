# 0220 Codex Generation Review Panel

Status: implementation complete for accepted routing changes; remaining native acceptance pending
Date: 2026-10-02

## Summary

Package a generation review MCP App in the local Renku plugin. In eligible Codex
desktop sessions it combines prompt, exact references and editable native settings.
Submit returns accepted choices to the originating conversation; existing Skills
and CLI commands perform generation.

The accepted revision retains Visualize as an explicit Codex desktop preference.
The global Renku config defaults to the new panel. Panel review never automatically
opens Studio Preview. Codex CLI, Claude and unidentified interfaces always deliver
Studio Preview. The Studio sidebar launcher is removed; no certificate installation
or trust prompt is part of this product.

## Review Attention

- **Changed global contract:** optional `codexGenerationReview: panel | visualize`
  in the existing Renku config, effective default `panel`. Core returns it as
  `workflowPolicy.codexGenerationReview` through `generation context`.
  Invalid values report `CONFIG015`. No Project setting, UI toggle or migration.
- **Display preference:** optional `codexGenerationReviewDisplayMode: inline | fullscreen`,
  effective default `inline`, exposed through the same Core workflow policy.
  Invalid values report `CONFIG016`. The resource advertises both supported modes
  and supplies the configured initial preference; the host controls its actual
  mode. The app accepts either mode, follows host mode changes and bounds inline
  height without changing submission or review routing.
- **Audio interaction correction:** visible audio references load through their
  existing scoped resource automatically; image thumbnails remain lazy and full
  images/video remain explicit previews. Loaded audio has no card activation
  overlay, so native Play/seek/volume receive pointer input. No autoplay, media
  permissions, CSP changes, provider calls or Project writes are introduced.
- **Changed review policy:** panel Submit is required before continuing, including
  built-in Codex images. It supplies the one confirmation for the exact accepted
  external request. CLI/non-Codex Preview is mandatory even when Project
  `displayPreview` is false. Visualize desktop retains that Project policy.
- **Host contract:** a read-only `generation.review.capabilities` probe reports
  initialized client identity and UI advertisement. The opening tool rejects
  unsupported connections before file reads. Advertisement does not prove
  rendering; the app still verifies a supported display mode and active-conversation messaging.
- **Removed product surface:** the Studio global sidebar entrypoint, launcher
  resource/tool, component/build entry and CLI status delegation. The user
  explicitly rejected certificates. Studio continues to run normally.
- **Preserved:** Visualize and its cache, ordinary Studio Preview/Inspection,
  provider selection, exact native validation/hashes, permissions, concurrency,
  recovery, immediate artifact display, provenance and focused attachment.
- **Failure policy:** failed panel opening/handshake stops that review without
  silently substituting Visualize or Preview. Mandatory Preview delivery failure
  also stops execution. Known unsupported hosts deliberately select Preview.
- **Packaging:** runtime and distributed Skills must ship together. Existing
  release owners package the one isolated review HTML and official SDK runtime.
  No new dependencies are needed for the routing revision. Earlier SDK/Sharp/
  bundler installs were authorized with SFW and supply-chain guards.
- **Verification limits:** protocol and Skill fixture checks cover all host routes;
  they do not establish live Claude rendering or every native desktop interaction.

## Context

Core owns global config validation, context/policy projections, safe exact-byte
review reads, reference authorization, Project paths and attachment. Engines owns
provider schema validation/execution. CLI adapters stay thin. Skills own creative
preparation, native field translation and presentation orchestration.

The sister repository `studio-skills` owns distributed Media Producer guidance,
provider Skills, review routing and behavioral evaluations. Urban Basilica is the
real local Project for native media verification. Temporary requests live under
the resolved Project's `tmp/operations/media-generation/`.

Accepted direction is recorded in
[ADR 0105](../../docs/decisions/0105-select-generation-review-by-preference-and-host-capability.md).
ADR 0091 continues to govern the explicit Visualize branch's template cache.
The bundled panel does not use Visualize HTML templates.

## Requirement Ledger

| Requirement | Accepted behavior |
| --- | --- |
| Combined review | Prompt, References and Configuration in one packaged panel with ordered requests. |
| Exact controls | Schema-described native fields, meaningful labels, exact values, no duplicate saved-value list or Unset buttons. |
| References | Core-authorized exact files; small image thumbnails and lazy full media, scoped opaque resources. |
| Submit | Resume the originating conversation, consume once, apply exact edits, validate and execute through Skills/CLI. |
| Model changes | Agent prepares only the selected route and refreshes the same revision-bound review. |
| Selectable presentation | Global panel/visualize preference read through generation context; panel default. |
| Review display | Independent global inline/fullscreen preference, inline default; both supported and actual mode controlled by the host. |
| Hosting interface | MCP identity/capability negotiation, separate from built-in image capability and model identity. |
| Other hosts | Mandatory Studio Preview for CLI, Claude and unidentified interfaces regardless of Project displayPreview. |
| Sidebar | Removed. No localhost certificates, trust installation or embedded Studio application. |

## Architecture Shape Gate

The current bounded package shape is retained:

```text
packages/core/src/client/project-settings.ts
  CodexGenerationReview and GenerationWorkflowPolicy contracts
packages/core/src/server/config/document.ts
  global config parse/validation/default
packages/core/src/server/project-settings/generation-policy.ts
  pure policy projection from Project settings and validated global config
packages/core/src/server/media-generation-context/context.ts
  read current global config and compose existing purpose context

packages/codex/src/
  index.ts                            public server exports only
  client.ts                           review/control/action/capability contracts
  server.ts                           SDK setup, registration and stdio lifecycle
  generation-review-capabilities.ts   initialized client/UI facts and opening gate
  generation-review.ts                opener/update and safe Core projection
  generation-review-state.ts          ephemeral revisions/actions/consumption
  generation-review-responses.ts      response and consume handlers
  generation-review-contracts.ts      declared control/draft envelope checks
  generation-review-schemas.ts        MCP argument schemas
  generation-reference-resources.ts   declared reference resource reads
  reference-thumbnails.ts             bounded image thumbnail processing
  diagnostics.ts                      structured integration errors

packages/studio/
  codex-generation-review.html
  vite.codex.config.ts                 one self-contained HTML build
  src/app/codex-generation-review.tsx   thin composition/providers
  src/services/codex-app.ts            official theme/display/message bridge
                                      inline/fullscreen capabilities and handshake
  src/features/codex-generation-review/
    codex-generation-review-panel.tsx
    use-codex-generation-review.ts
    generation-review-controls.tsx
    use-generation-reference-media.ts
  src/features/media-generation-request/
    shared request body, prompt editor, reference presentation and projection

packages/core/src/server/media-generation-review/
  review-file.ts                      shared exact-byte/hash/envelope read
  preview.ts                          safe review projection
packages/cli/src/commands/studio/mcp-command.ts
  fixed packaged review HTML resolution and runtime start

studio-skills/skills/media-producer/
  SKILL.md
  references/generation-review-routing.md
  references/workflow.md
  references/inline-generation-configuration.md
  evals/generation-context/review-routing.mjs
  scripts/generation-review-routing.test.mjs
```

The capability module owns host protocol facts, not generation policy or a generic
harness detection service. Core owns config validation; no adapter defaults or
direct Skill YAML reads. Skills select presentation with trusted host evidence;
the CLI does not guess its caller from environment variables.

The display-preference slice stays in these existing owners: Core validates and
projects the global setting; the MCP HTML resource reads that validated setting
for `openai/ui` metadata; the SDK bridge accepts inline/fullscreen; the review
hook projects host mode changes into the panel layout. Stop if implementation
requires another settings source, display-mode tool argument, Project mutation,
browser launcher, custom host bridge or creative-content interpretation.

The audio correction stays in the existing reference-media hook and shared
reference card. The hook projects authorized resource bytes into a browser URL
and bounds visible reads; the card consumes that URL and owns activation UX.
The existing local AudioPreview primitive owns native browser controls. Stop if
the fix requires bypassing the host sandbox, streaming arbitrary files, changing
reference authorization, rewriting media or autoplaying an asynchronously read
file. Verify visible audio loading, direct player hit targets, retry and cleanup
with focused regression tests; native sound remains a separate acceptance check.

Server registration remains four narrow tools and scoped resources. No
provider/purpose dispatcher, generation MCP tool, job broker, certificate service,
generic state mutation API or durable review record is introduced. The Studio
entry imports only Codex client contracts, Core client contracts and shared local
UI primitives. It does not boot the full Studio router/server connection.

The existing reference and prompt components are reused through bounded
presentation inputs. Feature controls use local shadcn primitives. Creative
content stays opaque in runtime code. Reference authorization and exact reads
remain Core-owned; the browser receives no local paths, credentials or uploads.

Stop and revise if one module mixes host routing, provider preparation, Project
writes and execution; if Core acquires native provider control catalogs; or if a
review becomes an arbitrary Project mutation. Public index files stay thin.
Architecture tests protect imports and runtime boundaries, not private names.

## Contracts

### Global preference and CLI read

The current platform global config accepts:

```yaml
version: 0.1.0
storageRoot: /absolute/project/library
codexGenerationReview: panel
codexGenerationReviewDisplayMode: inline
```

Values are `panel` and `visualize`. Omission is the valid default `panel`;
reading does not rewrite the file. New initialization writes the default.
Invalid values fail with structured `CONFIG015` and the config-key location.
The independent display preference accepts `inline` or `fullscreen`, defaults
to `inline`, and rejects invalid values with `CONFIG016` at that key.

`renku generation context --purpose <purpose> --target <target> --json`
returns `workflowPolicy.codexGenerationReview` and
`workflowPolicy.codexGenerationReviewDisplayMode`. Existing readable output
projects the same policy. No new config command or Project schema field.

### MCP runtime

- `renku studio mcp`: stdio, protocol-only stdout, fixed packaged HTML path.
- `generation.review.capabilities`: empty input; returns `client` identity
  or null and `panel: {status, reason}`. Status is `advertised` or
  `unavailable`; reasons are `codex-ui-advertised`, `non-codex-client`,
  `mcp-app-ui-unavailable`. Only exact `codex-mcp-client` with
  `io.modelcontextprotocol/ui` MIME `text/html;profile=mcp-app` is eligible.
- `generation.review`: model-visible opener/update. Requests contain
  `reviewFile`, optional `expectedRequestSha256`, exact `routes` and
  `controls`. Refresh requires `reviewId` and `expectedRevision`.
  Preparation failures use structured `preparationFailure` instead of requests.
  Capability rejection uses `CODEX_REVIEW_UNSUPPORTED` before reads.
- `generation.review.respond`: app-only exact draft Submit/reconfigure/cancel.
- `generation.review.consume`: model-visible consume-once exact response.
  `alreadyConsumed` authorizes no repeated execution.
- `ui://renku/generation-review`: packaged MCP App HTML supporting inline and
  fullscreen. Each resource read gets current validated Core config, sets
  `openai/ui.preferredDisplayMode`, and advertises both `availableDisplayModes`.
- `renku-review://<id>` and scoped `renku-reference://<id>/<reference-id>`
  plus thumbnail variant: only registered review state/Core-authorized media.

Tools remain discoverable on unsupported connections; presence is not a UI
capability. No global entrypoints exist.

Review state is connection-scoped, revisioned and ephemeral. Before response/
consumption, Core verifies the source hashes. Reconfiguration consumes the
pending choice before a prepared replacement binds new bytes. Unrelated ordered
requests remain unchanged. Restart expires the review and requires fresh review.

The app registers handlers before connect, accepts inline/fullscreen and requires
OpenAI active-conversation messaging. It sends the exact response identity after
acceptance; message retry retries notification only. It never executes generation.
The initial display preference is a host hint under the official contract. The
app follows actual host mode changes without clearing drafts; inline is a bounded
scrollable review with SDK size notifications, and fullscreen fills the viewport.
Scoped thumbnails use WebP; full media is loaded on demand and Blob URLs are
disposed. CSP permits only the required local blob resource/connect sources.

### Skill routing and execution

| Interface | Preference | Review | Studio Preview |
| --- | --- | --- | --- |
| Eligible Codex desktop | panel | Combined panel | Never automatic |
| Trusted Codex desktop | visualize | Visualize configuration | Project policy or explicit request |
| CLI, Claude, other/unidentified | Either | Conversational configuration | Always |

A missing probe in trusted desktop panel mode is an incomplete integration and
stops. A current unavailable result takes precedence over assumptions. No trusted
desktop/probe means unidentified. Visualize discovery uses the Skill catalog and
its full instructions, not tool-name search. Missing explicitly selected Visualize
is reported and stops. Preference changes take effect next review.

Panel requests use standalone Validate, not Prepare or Preview. Open, yield,
consume, apply accepted exact prompt/native fields, atomically save, Validate and
Execute with the revised hash. Provider Skills translate native prompt fields;
runtime never searches opaque content for creative meaning. Submit satisfies
the single confirmation. Built-in images use their separate capability without
Engines validation/receipts. Cancel/reconfigure/repeated actions do not execute.

Non-desktop routes always deliver Studio Preview; failed delivery stops. Single
Engines requests use Prepare; ordered sets validate individually and use repeated
Preview file arguments. Visualize desktop retains displayPreview and its existing
confirmation behavior. Explicit separate Preview requests remain available.
Permissions, concurrency, recovery, provenance and attachment are unchanged.

## Implementation Slices

1. Keep the bounded combined panel/Core exact-read foundation and remove the
   rejected sidebar implementation/build/export. Done before routing revision.
2. Extend Core global config and policy projection; update typed callers and
   test defaults, both values, invalid input and fresh context reads.
3. Add the focused MCP capability module/probe and enforce opening eligibility.
   Test supported/unsupported clients through official SDK transports.
4. Add one shared Skill routing guide and update Media Producer, general workflow,
   audio/video purpose guides and any unconditional Preview instructions.
   Retain Visualize cache/template instructions under the explicit branch.
5. Add behavioral matrix/handoff checks and update current docs/ADR/CLI references.
6. Build and check runtime/Skills, smoke-test installed CLI composition, inspect
   diffs/module shape, and record actual native verification separately.

## Tests And Guardrails

Config tests cover new initialization, omitted default without rewrite, explicit
panel/visualize and invalid/null/boolean values. Context tests change the global
preference between reads without changing Project Preview policy. CLI projection
tests verify the new policy value is included in both output formats.

Official MCP SDK tests cover Codex with UI MIME, Codex without it/wrong MIME,
Claude with/without generic UI and unidentified clients. Unsupported opening
fails before nonexistent Project/request reads. Existing exact edit/consume,
stale/expired source and reference authorization tests remain.

Skill observations cover image/audio/video panel handoff, both preferences for
CLI/Claude/unidentified hosts with disabled Project Preview, Visualize policy,
missing desktop probe, no duplicate Preview/confirmation, accepted edit hashes,
cancel/reconfigure/repeated actions and failures preventing execution.

Native acceptance must use the installed runtime and actual desktop. Protocol
fixtures are not live host verification. Paid generation is unnecessary.

## Documentation

Update media-generation architecture and CLI config/context/MCP reference.
ADR 0105 records accepted routing and launcher removal. Distributed Skill sources
and evals live in the sister repository. Historical failed launcher investigations
do not remain active product requirements.

## Completion Checklist

### Review Area And Architecture

- [x] Inspect complete relevant diffs in both repositories and diff statistics.
- [x] Confirm config/domain validation remains Core-owned and adapters stay thin.
- [x] Confirm no new broad dispatcher, compatibility layer or generic host service.
- [x] Inspect large/heavily changed files and verify index files remain thin.
- [x] Confirm no checklist item accepts unreviewable code structure.

### Contracts And Implementation

- [x] Remove Studio sidebar tool/resource/component/build entry.
- [x] Keep one packaged review HTML with no global entrypoints.
- [x] Add optional global preference/default/structured CONFIG015 validation.
- [x] Project preference through current generation context for every purpose.
- [x] Add read-only current-connection capability probe and opening gate.
- [x] Preserve app supported-display/message handshake and review consume-once contract.
- [x] Preserve Core safety, exact hashes, declared references and scoped media.
- [x] Keep configuration quiet: no duplicate values or Unset buttons.

### Skills And Review Policy

- [x] Shared routing guide for every image/audio/video purpose.
- [x] Default panel including built-in images; no automatic Studio Preview.
- [x] Retain Visualize desktop support and its cache/template workflow.
- [x] CLI/Claude/unidentified mandatory Preview overrides displayPreview false.
- [x] Unsupported-host routing separated from failed-panel stop behavior.
- [x] Same-review model preparation, exact accepted edits and revised validation hash.
- [x] One Submit/confirmation; permissions/recovery/concurrency/attachment preserved.
- [x] Update direct audio/video/shared token guidance to obey selected routing.
- [x] Add host/preference and handoff behavioral evaluations.

### Automated Validation And Distribution

- [x] Validate inline default, explicit fullscreen and structured invalid-mode errors.
- [x] Verify live config reads project display preference into CLI and resource metadata.
- [x] Verify both display handshakes, host switches, preserved edits and bounded inline layout in automated tests.
- [x] Update Skills and context fixtures for the independent display preference.
- [x] Build/check/test and review final display-preference diff; reload packaged local plugin source.
- [ ] Verify a newly connected native inline review separately from protocol tests.

- [x] Load visible scoped audio through the bounded reference-read queue and expose loading status.
- [x] Remove the card activation layer after audio loads so native Play, seek and volume receive clicks.
- [x] Verify audio read/cache/disposal, failed-read retry, unavailable-reference transitions and image/video behavior in regression tests.
- [x] Inspect the audio correction diff and rebuild the self-contained app without changing CSP, resource authorization or generation routing.

- [x] Focused Core config/policy/context tests.
- [x] Official SDK capability matrix and existing review protocol tests.
- [x] Sister media-generation validation and behavioral tests.
- [x] Root build and check after final changes.
- [x] Root unit tests for typed policy callers and existing review surfaces.
- [x] Sister full tests including release packaging.
- [x] Built CLI stdio smoke: capability probe, no global entrypoint, packaged resource.
- [x] CLI context against Urban Basilica returns default panel.
- [x] Local plugin source reload through supported host flow, no cache edits.

### Native Acceptance Remaining

- [x] Prior live review opened beside conversation; interactive settings.
- [x] Prior scoped image thumbnail/full-image decode after CSP correction.
- [x] Prior multiline Unicode prompt/settings action delivered to originating chat.
- [x] Verify new capability probe on actual Codex connection.
- [ ] Stable native duplicate consumption, cancel and model reconfiguration.
- [ ] Ordered multi-request review and correct reference ordinal correspondence.
- [ ] Audio/video playback, unavailable inputs and disposal in the native panel.
- [ ] Busy-thread and conversation-switch handoff isolation.
- [ ] Measure thumbnail/full-media startup and large configuration behavior.
- [ ] Live Codex CLI and Claude Preview delivery where those hosts are available.
- [ ] Native macOS/Windows packaged thumbnail dependency verification.

### Documentation And Final Verification

- [x] Accepted ADR and architecture review-routing reference.
- [x] CLI global setting/context documentation.
- [x] CLI MCP reference and current eval fixture policy values.
- [x] Record final command outcomes and any native verification limits.
- [x] No paid generation, unrelated Project mutations or release publication.

## Implementation Record

2026-10-01: official SDKs, bundler and Sharp installed under explicit authorization
using SFW. An exact release-age exception for OpenAI extensions 0.1.0 was approved;
other supply-chain guards remained. Local plugin reload used the supported flow.

The combined panel reused Studio prompt/reference components. Duplicate
Configuration values and Unset buttons were removed following user feedback.
Scoped thumbnail/full-image decoding and edited Unicode prompt/duration handoff
were verified in a fresh native review. Plugin reinstallation expired an older
review; those stale reference failures were reported as expiration, not repaired.

The user removed the sidebar launcher after repeated native opening failure and
rejected certificate trust. Launcher source, registration, build/export and tests
were removed. The then-current root build/check, Codex and Studio tests passed.

2026-10-02: the user accepted and authorized selectable panel/Visualize routing,
capability probing and mandatory non-desktop Preview. Core default/projection,
the probe/opening gate, shared Skill instructions, matrix checks and accepted
architecture documentation are implemented. Final verification outcomes follow
after running the complete checks.

Final verification: root build passed; all 1,259 unit tests passed; root check
passed (types, test types, lint, architecture, execution partitions and all 57
release tests). The first check had an untouched installer fixture fail because
its temporary .profile was absent; its focused retry and complete check retry
passed without code changes. Sister validation passed all 184 provider routes,
22 purpose cases, 82 behavioral tests and seven release tests. All 11 current
briefing fixtures were updated only with the new policy field/readable projection;
their other content was verified unchanged.

The built CLI stdio server passed official-SDK smoke checks for Codex with UI,
Codex without UI and Claude Code: four tools, expected advertisement/rejection,
no global entrypoint and the packaged self-contained HTML. Urban Basilica's
read-only context returned codexGenerationReview: panel with its existing Project
policy. Source reload used codex plugin add renku@renku-local; the installed
Skill includes the updated routing. At that verification point the chat still
had the old tool inventory; the native capability probe subsequently became
available and returned Codex 0.159.2 with advertised support. Remaining desktop
acceptance items are explicitly pending. No paid generation or release
publication occurred.

2026-10-02 display preference: the user requested configurable inline/fullscreen
review with inline as the default. Core config/policy/context, current resource
metadata, both SDK app capabilities, supported-mode/message handshake and
host-driven layout are implemented. The app no longer requests fullscreen.
Inline height is bounded independently of the iframe viewport and SDK size
notifications are enabled. Host mode switches preserve exact edited drafts.
Skills and all 11 briefing fixtures include the independent display setting;
fixture facts/text were verified unchanged apart from the two review policy keys.

Final display verification: root build and check passed, including all 57 release
tests; all 1,276 unit tests passed (520 Core, 36 Codex, 130 CLI, 85 Engines, 503
Studio and two Diagnostics). Sister validation passed 184 routes, 22 purposes,
82 behavioral tests and seven release tests. Urban Basilica's read-only context
returns panel/inline defaults. The installed CLI launched as a fresh official-SDK
stdio client serves preferred inline with both modes, 1,398,264 bytes of bundled
HTML, four tools and no sidebar entrypoint. Supported local plugin source reload
completed; installed routing guidance matches the sister source.

The active native chat connection still returns fullscreen-only resource
metadata from its already-running server despite the plugin source reload.
Fresh native inline rendering therefore remains pending a connection restart;
the fresh packaged-process result is not presented as native rendering evidence.
No certificates, dependencies, paid generation or Project mutations were added.

2026-10-02 audio correction: the user's screenshot demonstrates native inline
rendering, but clicking Play did not advance time. Inspection found the shared
reference card's invisible activation button covering the native audio controls.
Audio also required an initial card click before fetching its scoped bytes, which
explains the delayed controls. Loaded audio now exposes its controls directly;
visible audio loads automatically through the existing three-read queue with a
loading state. Read failures can be retried, URLs are cached/released, and obsolete
reference results do not appear after reference changes. Image/video explicit
preview behavior is preserved. The correction remains presentation-owned in the
existing hook/card; public entrypoints and Core authorization are unchanged.

The supported MCP App inspection interface lists expanded side-panel apps only;
the inline review was not accessible there. Native audible playback remains an
acceptance item and is not inferred from DOM tests. No autoplay, new permissions,
certificate trust, dependencies, provider execution or Project writes were added.

Audio verification: Studio lint and test typecheck passed; all 512 tests in 129
files passed, including the scoped-media and direct-control regressions. The
Studio build and bundled MCP App build passed. The final touched-file lint and
focused regressions were rerun after removing a memo dependency warning; the
existing unrelated server console warning remains. The final diff was inspected
for formatting, ownership and entrypoint changes, and git diff --check passed.
The already-open native review retains its original HTML and needs reopening to
exercise the rebuilt controls; audible playback has not been claimed verified.

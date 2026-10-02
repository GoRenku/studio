# 0220 Codex Generation Review Panel

Status: implementation in progress; host acceptance pending
Date: 2026-10-01

## Summary

Add a purpose-built generation review MCP App to the existing local Renku
plugin. In Codex desktop, the agent opens this app automatically in the right
panel beside the conversation before generation. It combines the current
Preview content with the provider/model and editable settings interaction
currently supplied by Visualize. Submit sends the accepted choices to the same
conversation; the existing Skills and CLI then perform generation.

The latest user direction keeps Visualize as a selectable Codex desktop review
path, with the new panel as the default. Panel review does not deliver a second
Studio Preview. Sessions outside Codex desktop, including Codex CLI and Claude,
must use Studio Preview. The user rejected the sidebar launcher and certificate
installation; the launcher implementation has been removed.

Only the generation review UI is packaged as an MCP resource. The Studio
application continues running locally as it does today. Cast, storyboard, and
other just-in-time panels are later work, not implementations in this plan.

## Review Attention

- **Latest direction supersedes the replacement and launcher requirements below.**
  Do not restore the global sidebar entrypoint, implement certificate trust,
  remove Visualize support, or adopt panel review in CLI/non-Codex sessions.
  The configuration and host-capability routing proposal is under discussion;
  it is not implemented. A CLI invocation cannot infer its originating
  conversation's rendering capabilities from the model name or environment.
  The existing global Renku config and generation-context command are the
  proposed setting owner and read surface. MCP client capability negotiation
  supplies panel eligibility; the UI handshake must still confirm fullscreen
  and conversation messaging. Existing provider validation, exact hashes,
  approval, recovery and attachment remain unchanged. The new non-Codex rule
  makes Studio Preview mandatory even when Project displayPreview is false.
- **Automatic opening has a documented mechanism, with a host acceptance gate.**
  Set the HTML resource's `preferredDisplayMode` to `fullscreen` and support
  that mode only. Plugin Creator identifies this as the Codex conversation side
  panel; the installed desktop implementation places MCP app tabs on the right.
  The public specification calls the preference a hint. The first slice must
  demonstrate an agent invocation opening the panel with the conversation
  visible and without a user click. Source inspection is not a passed UI test.
- **Submit means continue generation.** This follows the latest user request.
  Codex Media Producer waits for this panel handoff before generation, including
  the built-in Codex image lane. This adds a review pause to lanes/settings that
  previously allowed immediate generation. It does not change Project Settings
  or Claude's spending/Preview policy. There is no second confirmation question
  for the same accepted request; host permission prompts remain host-owned.
- **Model changes stay in the panel but require agent preparation.** Resolution,
  prompt and other prepared controls respond locally. Selecting another model
  sends an explicit reconfiguration request to the conversation. The Skill reads
  that model's guidance/schema and refreshes the same review. Show a preparation
  state; do not promise instantaneous model switching or silently carry invalid
  values into a different model.
- **New public surface:** `renku studio mcp`; three narrow MCP tools; one review
  resource, scoped review/media reads, and an ephemeral
  review handoff contract. No generation execution command becomes an MCP tool.
  Root control keys are exact native request JSON pointers. The Configuration
  tab omits fields already represented by controls, the model selector or the
  reference gallery; it does not show a duplicate saved-value list.
- **Existing owners are reused:** Core review safety/reference authorization;
  Engines provider validation; CLI generation; Skills creative preparation;
  Studio's prompt editor, reference presentation, media primitives and theme.
  A separate Studio build entry packages just the review UI for MCP.
- **New dependencies/distribution:** the official TypeScript MCP Apps and OpenAI
  extensions SDKs, a small host-integration runtime package and thumbnail
  processing. Installation requires explicit authorization under AGENTS.md;
  planning installs nothing. The same Renku plugin/runtime release process owns
  these artifacts; installed plugin cache files are not source.
- **No Project schema migration or media cleanup.** Visualize and its existing
  cache commands/files remain available as an explicit selection. The fixed UI does not
  inherit ADR 0091's HTML-template cache policy; schema lookup continues through
  the existing provider boundary. This policy change must be documented.
- **Implementation has started; workflow adoption remains gated.** The bounded
  runtime, Core read reuse and compiled review panel exist. The review's media/handoff tests
  remain in progress. Media Producer's Visualize/Preview workflow and accepted
  architecture documentation are not replaced before this gate passes.

## Implementation Record

2026-10-01, latest user direction: removed the global Studio tool/resource,
launcher type and CLI status subprocess, browser launcher component/entry,
HTML build/export and launcher-specific tests. Runtime now exposes only the
three generation review tools and the review HTML resource. No certificate
implementation is authorized. The user's next requested deliverable is an
in-depth proposal for selectable Visualize/panel review and capability-aware
Studio Preview delivery; the Skill workflow has not been changed yet.

2026-10-01: dependency installation was explicitly authorized and used SFW.
The user subsequently authorized an exact release-age exception for
`@openai/mcp-extensions@0.1.0`; other supply-chain guards remain enabled.
Existing dependency versions are unchanged. The local Renku plugin was
reloaded through the supported CLI; no installed cache source was edited.

The root build, check and 1,239 unit tests passed. The check includes Codex and
the isolated browser import graph. Sister-repository media-generation and
release tests passed. Subsequent media-policy/control-safety changes passed the
focused Codex build and 26 tests; Studio's 494 tests passed, including four
scoped-media loading/disposal tests. The actual `renku studio mcp` executable
also passed an official-SDK stdio test: four tools, packaged HTML, protocol-only stdout,
and exact CLI-reported Studio URL.
The root check passed again after those changes (57 release tests included).

The user's Configuration screenshot exposed a duplicate saved-value list below
the editable controls. The combined panel now omits fields covered by controls,
the provider/model selector or the reference gallery. Root control keys use
exact native JSON pointers, including escaped and nested fields. Unrepresented
configuration remains visible; source JSON is unchanged. The combined-panel and
projection tests cover edited values, nested fields, original array positions
and large configuration. Focused Studio tests, test typechecking, lint and the
standalone panel build passed; the Codex build and 28 tests passed. The pointer
mapping projects actual native field names into Core's existing safety checker,
including nested property choices, before exposing controls.
The root check passed again after the Configuration correction.

Native acceptance is incomplete. An agent invocation exposed the review as an
MCP App tab in this chat; settings controls were interactive. A registered
Urban Basilica image was read through scoped resources, but its Blob image
failed to decode in the original sandbox policy. The review now declares only
`blob:` resource/connect sources, which are needed for local media rendering
and audio decoding and add no external network origins. That correction was
verified in the fresh native panel: the thumbnail decoded at 256 × 146 and
the full image at 1,344 × 768. A separately open panel from the reloaded
connection correctly rejected its expired review; desktop logs confirmed
`CODEX_REVIEW_EXPIRED`. The browser inventory exposed the fresh tab after a
delay, so the expired tab was initially mistaken for the reopened review.

The live panel accepted an edited multiline Unicode prompt and duration 12,
then delivered its follow-up to the originating conversation after the active
turn yielded. The action was consumed successfully: exact prompt, settings,
ordered request identity and source hash were preserved. A subsequent repeat
check returned expiry after the user uninstalled and reinstalled the plugin,
so native duplicate-consumption verification still needs a stable connection.
Reinstallation also explains the renewed scoped-reference read failure; the
desktop log reports `CODEX_REVIEW_EXPIRED`. No provider execution follows this
test submission.
The user supplied a desktop screenshot of the global launcher showing only its
heading and confirmed that
no browser opened. A temporary retry control was rejected by the user and
removed. The launcher requests browser opening automatically and has no
buttons or embedded Studio frame; native one-click opening remains unresolved.
The user also requested removal of all Unset buttons from generation settings.
That correction is rebuilt and passes focused control/panel/launcher tests,
test typechecking and lint. Clearing an array editor preserves an absent value.

The user's 22:20 screenshot still shows only “Opening Studio…”. At the user's
request, the [Extensions documentation](https://developers.openai.com/plugins/build/extensions),
its linked TypeScript guide, and the
[installed 0.1.0 protocol specification](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/docs/spec.md#global-entrypoint)
were reread. The global entrypoint contract opens a permanent MCP App tab with
a composer. Its schema has no browser URL destination. Deep links navigate
inside that app. The [MCP Apps link contract](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/specification/2026-01-26/apps.mdx)
accepts a URL and asks the host to use the default browser or a new tab; it has
no required in-app destination. The current implementation calls that API once
and does not embed Studio. No documented direct-sidebar-to-browser mechanism
was found. R7 is still a required acceptance gate, not a completed launcher.
Changing status copy, adding a retry button, or passing a mock link test cannot
satisfy it. No further runtime change or plugin reload was made during this
documentation audit.

The follow-up launcher investigation confirmed that CLI status reports Studio
running at `http://localhost:5173`, and that URL returns HTTP 200 with HTML.
The installed desktop host's link-opening handler contains a URL schema that
accepts `https`, `codex` and `codex-dev` schemes, excluding `http`; a failed
parse returns without an explicit error in that handler. This is evidence for
a host URL-policy failure, but the sandbox's exact `ui/open-link` mapping was
not available to verify, so it is not a confirmed end-to-end cause. No relevant
security-denial event was found in the logs at the screenshot time. Separately,
the launcher keeps “Opening Studio…” visible after a successful SDK response;
that status does not prove the request remains pending or that a browser opened.
The current task's computer-use tab inventory was empty and cannot inspect the
global sidebar view. No browser preference or security policy was changed.

The user proposed default localhost HTTPS and clarified that the solution must
ship to other users. Release targets and distribution ownership were inspected:
`distribution/install.sh` and `distribution/install.ps1` own installation;
Studio's Vite and packaged server own transport; Core owns runtime coordination;
CLI consumes the reported URL. A deployable HTTPS slice would need per-install
certificate generation and protected storage, explicit platform trust setup,
server/CLI TLS verification, renewal and uninstall ownership, and native Mac
and Windows acceptance through the packaged runtime. It must not rely on the
maintainer's OpenSSL/Homebrew setup or publish a certificate private key.
Public CAs cannot issue a certificate for literal `localhost`; locally trusted
certificates require an explicit trust decision. That installer choice was
presented to the user before implementing the slice. HTTPS must first pass the
actual sidebar handoff test; TLS support alone does not prove R7.

The user has not approved certificate trust changes and requested public policy
research first. As of 2026-10-01, the reviewed OpenAI Extensions documentation
and MCP Apps `ui/open-link` contract do not establish a permanent HTTPS-only
localhost policy. [Codex issue #45913](https://github.com/openai/codex/issues/45913),
opened September 16, reports HTTP loopback resources blocked despite a CSP
allowlist; it has no visible maintainer response or fix commitment and concerns
iframe resource loading, not the launcher's browser handoff. Reviewed OpenAI
forum threads concern resource URLs and link-warning metadata, not a policy
decision for this case. Certificate authority trust has broader security effects
than trusting a single server certificate; mkcert explicitly excludes end-user
production use. A deployable certificate-trust installer remains an unapproved
product choice, not the accepted launcher fix.

The temporary review
`tmp/operations/media-generation/codex-panel-acceptance-20261001.json` validates
against the actual provider schema and references an existing registered image.
Its continuation is test-only: no provider execution, import or attachment is
authorized by submitting it. No paid generation, Project schema migration,
media cleanup, release publication or Skill workflow replacement has occurred.

## Requirement Ledger

| ID | Source | Outcome and owning boundary |
| --- | --- | --- |
| R1 | Latest user request | Automatically open a right-hand review panel while the Codex conversation remains visible; MCP App/host integration. |
| R2 | Latest user request | Combine prompt/reference review with interactive provider/model/native configuration; Studio UI plus Skill-authored presentation. |
| R3 | Latest user request | Submit delivers accepted edits to the originating conversation and continues generation; SDK messaging and the existing Skill/CLI workflow. |
| R4 | User performance concern | Local references load efficiently without media in agent-authored HTML; scoped MCP resources and thumbnail/lazy-load presentation. |
| R5 | Latest user request | Remove inline Visualize and automatic Studio Preview from Codex generation; preserve Claude Preview and ordinary Studio functionality. |
| R6 | User constraint | Keep Skills/CLI generation; MCP only supplies host interaction, local resources and review handoff. |
| R7 | Latest user request | Renku sidebar launches running Studio through its CLI-reported URL and the host browser API. |
| R8 | Accepted architecture | Core owns domain safety; Engines validates native requests; Skills own creative interpretation; UI/MCP have no provider dispatcher. |
| R11 | Latest user request | Any localhost HTTPS solution ships through existing macOS/Windows installers and runtime archives, with per-install credentials and native packaged verification; developer-machine setup is insufficient. |
| R9 | Current workflow/data integrity | Preserve exact references, ordered multi-request review, credentials, hash protection, execution recovery and attachment/provenance. |
| R10 | Explicit scope | Additional just-in-time entity/storyboard views are later work; do not build a generic view framework now. |

## Evidence And Context

### Public APIs and reference implementations

Use the official TypeScript SDKs rather than constructing MCP/host messages by
hand. Research baseline: `@openai/mcp-extensions` 0.1.0,
`@modelcontextprotocol/ext-apps` 1.7.5 and
`@modelcontextprotocol/sdk` 1.29.0. Recheck release compatibility before an
explicitly authorized dependency installation.

Relevant documents read for this revision:

- [Plugin Extensions](https://developers.openai.com/plugins/build/extensions).
- [OpenAI display modes](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/docs/spec.md#display-modes),
  [message extensions](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/docs/spec.md#uimessage-extensions),
  and [global/thread entrypoints](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/docs/spec.md#mcp-app-entrypoints).
- [TypeScript setup and UI registration](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/typescript/README.md),
  including handler registration before `app.connect()` and `message.send`.
- [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx),
  covering tool/resource binding, display requests, messages and resource reads.
- [MCP Apps implementation patterns](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/patterns.md),
  including app-only tools, polling, binary resource delivery and state identity.
- Plugin Creator's installed `create-plugin/references/extensions.md`: prefer
  fullscreen-only for a Codex panel, inspect the actual host context, and request
  that mode once if supported but not selected initially. Verify placement.
- [RemCTL desktop integration](https://github.com/viticci/remctl/blob/6b64909a25ccf360ac92ba4624741606b597ccac/docs/desktop-plugin.md),
  [MCP resource/tool registration](https://github.com/viticci/remctl/blob/6b64909a25ccf360ac92ba4624741606b597ccac/remctl_plugin.py),
  and [UI bridge](https://github.com/viticci/remctl/blob/6b64909a25ccf360ac92ba4624741606b597ccac/ui/src/bridge.ts).
  RemCTL supplies a bundled React UI as a resource, delegates local operations
  to its CLI, reads local media through MCP, and uses the official message API
  for user-initiated conversation actions. It does not embed a localhost page.

The installed Codex desktop examined is version 26.928.21956, build 12404.
Read-only source inspection shows resource display preferences feeding initial
MCP App session state, and fullscreen MCP App sessions opening/focusing right
panel tabs. It also shows local URL opening delegated to the host's internal/
external browser preference. These are supporting observations, not production
APIs to import, settings to modify, or evidence of a completed Renku UI test.

### Existing Renku ownership

- ADR 0086 keeps provider execution in skill-directed Engines and preserves
  Preview, prompt editing, schema-free configuration inspection and provenance.
- ADR 0091 caches Visualize HTML/schema templates for 24 hours; that is distinct
  from Engines' provider metadata caching.
- ADRs 0100, 0102 and 0104 govern personal model discovery, credential preflight
  and generation context. Do not narrow model choices to Project preferences.
- `docs/architecture/media-generation.md`, its reference, `frontend.md`,
  `reference/front-end-guidelines.md`, naming and coding practices apply.
- `packages/core/src/server/media-generation-review` parses/safely projects the
  temporary review document and resolves registered local reference files.
  `MediaGenerationPreviewResource` supplies prompt, references, native
  configuration and diagnostics. The temporary document contains provider,
  model, media kind, prompt and opaque native request JSON.
- `packages/cli/src/commands/generation/prepare.ts` currently validates AND
  delivers Studio Preview. Calling it unchanged in Codex would violate R5.
  `validate.ts` performs validation without that delivery. `request-file.ts`
  hashes exact bytes; Execute accepts the resulting expected SHA-256 before
  provider work. Keep these boundaries.
- `packages/studio/src/features/media-generation-request` already owns the
  tabbed review body, CodeMirror prompt/mention behavior, reference cards and
  Preview/Inspector dialog reuse. Its current Configuration tab is read-only.
- `studio-skills/skills/media-producer` owns route discovery, provider advice,
  native request authoring and Visualize configuration. Model changes already
  return through the agent to prepare the selected route.
- `renku studio server status --json` already reports whether Studio runs and
  its browser URL. The integration must use that contract.
- Existing Preview supports ordered sets of request files. Preserve that
  behavior in one review panel; do not replace an earlier request's panel while
  preparing another request in the same review set.

Plan 0219 is abandoned. This plan does not change that status or resume its
full-Studio embedding direction. Use Urban Basilica for representative media
and read-only investigation; use fixtures/copies for mutation tests.

## Product Behavior

### Open, edit, submit and continue

1. Media Producer resolves Project/purpose/target, credentials, route advice,
   prompt, references and native initial settings using its existing commands.
   It prepares temporary review documents before opening the combined panel.
   Engines requests use `generation validate`, not `generation prepare` or
   `generation preview show`. Built-in Codex uses its existing capability
   contract and Core review projection, not Engines validation.
2. The agent calls `generation.review` with the explicit Project, ordered review
   files, selected-route control descriptions and initial values. The server
   reads safe Core projections and binds the review to the exact file hashes.
   The result identifies `ui://renku/generation-review`; resource metadata asks
   for fullscreen-only. No manual thread-entrypoint click is required.
3. The panel opens beside the conversation and displays Provider/Model controls,
   Prompt, References and Configuration. Use the shared prompt editor with exact
   authored text and reference mentions, reference media previews, and real
   editable native settings. Preserve the ordered request navigator for sets.
   Show loading, unavailable-reference and validation states in this surface.
4. The opening tool returns immediately. The agent ends the turn and waits for
   panel input. Do not hold the opening tool pending: the host needs its result
   to render the panel. Do not continue to execution in this turn.
5. The user edits the prompt and current-route values locally. Rich resolution
   choices may show labels and descriptions. Native nesting/arrays supported
   by the prepared controls remain editable; show the rest of the safe native
   configuration through the existing inspector. Do not invent ranges, enums
   or compatibility based on a field name or current value.
6. Clicking **Submit and generate** records the submitted draft through the
   app-only response tool. Only after successful storage does the app send a
   user message to its conversation using the official SDK. The message carries
   a review/action identity and concise human-readable summary, not image bytes,
   credentials or a generated shell command.
7. The agent consumes that exact submitted action once. It applies the returned
   prompt/settings through the selected provider Skill, preserving explicit
   user edits. It writes the native request, validates it and executes using
   the returned hash. The original generation task's recovery, inspection,
   import and attachment steps continue unchanged. Built-in Codex calls its
   existing image capability and import path after the same review handoff.
8. A changed reference, incompatible setting, expired review or new validation
   failure returns to the panel with actionable diagnostics. Never silently
   drop a reference/value or execute an unreviewed replacement. Mechanical
   synchronization of accepted prompt/settings into provider-native fields
   does not require a second review; a material creative/model/reference change
   does. The Skill owns this distinction; runtime code does not parse creativity.

The automatic panel rule is Codex-specific and replaces the separate config/
Preview interaction there. It applies even when the old Preview setting was
informational or disabled. Keep other uses of the Studio Preview command and
all Claude Preview/settings/confirmation behavior unchanged. Cancel sends a
cancellation action and never generates. Closing a host tab is not acceptance;
the conversation stays paused. The same review can be reopened explicitly.

### Provider/model changes inside the panel

The complete effective bundled/personal route list supplies selector choices.
Project preferences determine initial selection only. Include built-in Codex
image generation only when the active harness supplies that capability.

Selecting a different provider/model submits a `reconfigure` action containing
the current draft and new exact route identity. The panel immediately shows
that choice as pending, disables generation and sends a user-initiated message
asking the existing Skill to prepare it. It does not call a provider itself.
The Skill checks changed-provider credentials, reads only the selected route's
advice/schema, preserves all non-negotiable references, and prepares its prompt
and controls. It updates `generation.review` with the same review id and the
expected revision. The panel refreshes in place without requiring reopening.

Ordinary control edits do not message the conversation. Reconfiguration does
not authorize execution. A new model's prompt may need reauthoring according to
existing Skill guidance; the refreshed prompt is visible before Submit. Carry
native values only using the current exact-path/type/schema rules, never labels
or guessed equivalence. An incompatible route produces a clear preparation
failure and leaves the previous valid draft available for a deliberate return.
Do not silently revert the selected model or generate with the old one.
The Skill reports failure through the same review tool's `preparationFailure`
variant. The panel shows the diagnostics, retains the pending choice and saved
previous draft, and offers a deliberate return to that prepared route. Cancel
remains available during preparation and after failure.

Only one reconfiguration action can be pending per review. Disable repeated
route changes until it resolves; retain the draft being replaced. Use the
initial tool result and subsequent tool results for immediate updates. A
visible panel may also read its scoped review resource every two seconds while
preparation is pending, stopping when settled, hidden or disconnected. This
uses documented MCP reads; it neither requires an events service nor polls
providers. Revisions prevent late results from overwriting newer user edits.

### Configuration controls and responsibility

Use a fixed, compiled React control renderer, with request-time descriptions
supplied by the Skill from the selected provider's actual schema. This replaces
agent-authored UI HTML; it does not create a maintained provider schema catalog
inside Core or Studio.

`GenerationReviewControls` is a Codex presentation contract. It contains groups
of labelled fields, exact native request JSON-pointer keys for root controls
(native property names inside object controls), input kinds, exact initial JSON
values and schema-backed enum/range/type facts. Its bounded vocabulary is text,
multiline text, number/integer, boolean, enum, multi-enum, object and array.
An enum option can have a label and description. A slider is appropriate only
with explicit bounds; otherwise use numeric input. Preserve null/absent values
where the selected contract allows them. Prompt is the dedicated editor;
references are the Core-derived, review-only gallery, with original roles/order.
No upload or reference-picker workflow is added in this slice.

The presentation schema validates its own envelope and submitted value types.
It does not claim to validate all provider JSON Schema semantics. The UI does
not derive display controls from naming heuristics, store provider-specific
React code or author provider requests. Returned field keys/values are consumed
by the Skill; MCP never applies arbitrary JSON-pointer patches to domain state.
Schema conditions or dependencies that require route preparation go through
`reconfigure` before submission. Cover the actual common image/video/audio
routes in acceptance tests; incomplete settings coverage is not a passing test.

The fixed UI is bundled once per runtime release. No Visualize rendering,
Visualize Skill read or Visualize cache preparation is used in Codex generation.
The existing provider metadata cache remains in effect. There is no newly
promised 24-hour cache for agent-authored control descriptions. Measure cold and
warm schema/preparation cost; a new cross-request control cache would require a
separate, evidence-based decision rather than an undocumented optimization.

### Local media and performance

The app does not fetch localhost or load the Studio website. It asks its local
MCP server for only the references declared by this review. The server uses
Core's registered-reference/path checks and returns resource bytes. The app
uses Blob URLs with correct MIME types and releases them on disposal.

- Generate image thumbnails locally, initially targeting at most 256 pixels on
  the longest edge and roughly 24 KiB each. These are measurement targets, not
  claimed platform limits. Decode/resize is presentation, not content analysis.
- Load visible thumbnails lazily with a small concurrency limit (initially 3).
  Load full images only for expanded preview. Keep media bytes out of model
  arguments, text results, submitted messages and agent-authored UI artifacts.
- Audio/video load on demand and play in the same panel using shared Studio
  media controls. Whole-resource reads do not imply HTTP range streaming. Test
  representative current clips and seeking after load. Do not silently replace
  playable previews with Download or introduce a new transport to hide a failure.
- Resource identities resolve only to references in that review and Project;
  they are not filesystem paths or arbitrary-file-read tools. Recheck Core
  authorization when reading. Never expose provider upload URLs or secrets.
- Measure 1, 6 and 12 references, plus representative large images/clips. Record
  HTML bytes, thumbnail preparation, bytes transferred, time to usable controls,
  full-preview latency and memory release. The panel must become interactive
  without waiting for all full-resolution media.

If representative video sizes do not work through documented resource reads,
report the measured limit and revisit that slice before replacing the existing
preview workflow. No public hosting, HTTPS tunnel or streaming guarantee is
assumed.

### Sidebar launcher

`studio.open` is a global entrypoint associated with
`ui://renku/studio-launcher`. Its server handler runs the installed Renku CLI's
`studio server status --json` using a fixed executable and argument array.
It passes through the reported browser URL when Studio is running; it does not
construct a port, protocol or address.

The launcher registers `ontoolresult` before `connect`, consumes the initial
result and calls `App.openLink({ url })` once. This call cannot require an
in-app browser destination, and native opening has failed. The documented
global entrypoint itself remains an MCP App tab. This implementation therefore
does not yet satisfy R7. No private preference writes or undocumented browser
deep links may be used to pass that gate.
If Studio is stopped, show the existing `renku studio start` instruction; no
automatic server startup is added. The user explicitly rejected launcher and
retry buttons and embedding Studio in an iframe; neither is an accepted
replacement for one-click browser opening.

## Architecture Shape Gate

### Reuse versus extension

The existing Preview UI cannot alone provide provider settings or the host
bridge. Reimplementing generation in MCP is unnecessary. Extend the existing
review presentation inside Studio, and add one bounded Codex protocol package.
The new review handoff is necessary because the user explicitly requests that
Submit resume the conversation; it is connection-scoped interaction state,
not a new durable generation/job/approval system.

```text
packages/codex/                         @gorenku/studio-codex
  src/index.ts                         public server entrypoint exports only
  src/client.ts                        Codex review/control/action contracts
  src/server.ts                        SDK setup, stdio lifecycle, registration
  src/generation-review.ts             opener/update tool and safe projection
  src/generation-review-state.ts       scoped revisions/actions/consumption
  src/generation-review-responses.ts   response and consume tool handlers
  src/generation-reference-resources.ts declared media resource reads
  src/reference-thumbnails.ts          image thumbnail processing
  src/studio-launcher.ts               fixed CLI status delegation
  src/diagnostics.ts                   structured integration errors

packages/studio/
  codex-generation-review.html          isolated browser build entry
  codex-studio-launcher.html            isolated launcher build entry
  vite.codex.config.ts                 bundle both self-contained app resources
  src/app/codex-generation-review.tsx   thin app composition and providers
  src/app/codex-studio-launcher.tsx     thin launcher composition
  src/services/codex-app.ts             official SDK bridge/theme/display/message
  src/features/codex-generation-review/
    codex-generation-review-panel.tsx  review composition and request navigator
    use-codex-generation-review.ts     draft/action lifecycle
    generation-review-controls.tsx    schema-described shadcn control renderer
    use-generation-reference-media.ts lazy resource loading/Blob disposal
  src/features/media-generation-request/
    media-generation-request-view.tsx shared prompt/reference/tab body
    media-generation-reference-card.tsx shared card with lazy preview source
    media-generation-prompt-editor.tsx shared exact-text/mentions editor
  codex-apps-dist/                     built HTML assets, outside source

packages/core/src/server/media-generation-review/
  review-file.ts                      shared exact-byte read/hash/envelope
  preview.ts                          existing safe preview projection

packages/cli/src/commands/
  studio/mcp-command.ts               fixed runtime/UI paths and server start
  studio/index.ts                     bounded studio command registration
  generation/request-file.ts          delegates review read; Engines conversion

studio-skills/
  .codex-plugin/plugin.json           Codex-only MCP connection reference
  codex.mcp.json                      installed renku studio mcp launch
  skills/media-producer/references/codex-generation-panel.md
```

`@gorenku/studio-codex` depends on Core, Diagnostics, official SDKs and thumbnail
processing. It imports neither Engines, CLI internals nor Studio React. Its
server entrypoint receives fixed packaged UI asset paths and CLI executable
arguments from the CLI composition root. No caller-supplied command or arbitrary
file path appears in an MCP tool. `execFile` uses argument arrays, not a shell.

Studio imports only the Codex package's client contract entrypoint for this
build. Its existing local shadcn controls, prompt/reference components and
styles form the review UI. The standalone entry does not initialize the Studio
router, Project browser, HTTP clients or global resource-refresh connection.
Expose the built HTML assets as package export paths
`@gorenku/studio/codex-apps/generation-review.html` and
`@gorenku/studio/codex-apps/studio-launcher.html`; CLI resolves them when starting
MCP. Do not add a forwarding package or duplicate the Studio app bundle.

Extend `MediaGenerationRequestView` with a bounded configuration-content slot
for the panel's controls. Refactor reference media presentation to accept a
thumbnail and lazy full-preview source while retaining its ordinary browser
source path. These are host-specific media/presentation inputs, not a second
Preview domain model. Keep Preview and Inspector dialog composition shared and
unchanged. Use structural `Pick`/`Omit` types for shared presentational props so
they need only the fields actually displayed. The MCP projection removes document/
local paths and Studio HTTP URLs, then supplies resource-backed media through
the lazy loader. Do not fill removed fields with invented placeholder paths.
No MCP imports enter their browser controllers. Desktop panel width
must be handled by the shared presentation without introducing mobile scope.

Refactor exact-byte reading, hashing, envelope parsing and review safety into
Core's `readMediaGenerationReview`. Its server-only result contains `document`,
`requestSha256`, `projectRef` and `projectFolder`. Both preview projection and
CLI loading use that owner. CLI keeps provider-native conversion and its public
expected-hash behavior. MCP binds its safe projection and hash to the same read,
so two independent file reads cannot approve different contents. Do not expose
server paths/raw native requests to the browser merely because this service
returns them internally.

The server's registration body lists four focused tools and scoped resource
handlers. Control-kind dispatch is a bounded presentation registry; no
provider/model/purpose dispatch is added. Public `index.ts` stays exports only.
The state module owns only the interaction transition table. It must not load
schemas, spawn CLI, inspect provider fields or render HTML.

Stop and revise the slice if UI/media reuse requires copying the whole Preview,
if a single function mixes routing/persistence/provider behavior, if Core grows
a provider-control catalog, or if a review response becomes a generic Project
mutation endpoint. Future Cast/storyboard features do not justify a view
registry, new routes or generic entity tools in this plan.

## Public Contracts And Interaction State

- **`renku studio mcp`:** official SDK stdio server; protocol only on stdout,
  diagnostics on stderr. No HTTP listener and no Studio startup side effect.
- **`generation.review`:** model-visible opener/update tool. Input:
  `{ project, reviewId?, expectedRevision?, requests }`, or the existing-review
  failure variant `{ project, reviewId, expectedRevision, preparationFailure }`.
  `preparationFailure` contains structured diagnostics; the two variants are
  exclusive. A failure retains the prepared draft and moves to
  `preparationFailed`. Each ordered request
  supplies `reviewFile`, optional `expectedRequestSha256`, actual route choices
  and `GenerationReviewControls`. Existing ids require the expected revision;
  initial calls create a fresh connection-scoped id. Core supplies prompt,
  references and safe configuration. Return concise text plus UI metadata with
  review id/revision, request identities, projected content and controls.
  Attach `ui.resourceUri: "ui://renku/generation-review"` on the descriptor.
- **`generation.review.respond`:** app-only tool with
  `{ reviewId, expectedRevision, responseId, action, drafts }`.
  `action` is `reconfigure`, `submit` or `cancel`; reconfigure additionally names
  the request and exact selected route. Only declared requests/field keys may
  appear. `responseId` makes a repeated identical response idempotent. Conflicts
  fail before replacing accepted choices. No review-file/domain write occurs.
  After submit/cancel, lock the panel draft;
  reconfiguration locks edits until the prepared replacement or failure arrives.
- **`generation.review.consume`:** model-visible tool taking
  `{ reviewId, responseId }`. Atomically returns an unconsumed response once,
  including original file hashes, accepted prompt/values, selected route and
  revision. A repeated consumption reports `alreadyConsumed` and authorizes no
  second execution. This narrow receipt prevents an accidental repeated Submit
  message from starting the same reviewed work twice; it is not provider retry.
- **`studio.open`:** app-visible global entrypoint with no URL argument;
  `{ running, browserUrl }` comes from CLI status. Associated with the launcher
  HTML resource and `_meta["openai/ui"].entrypoints: [{ type: "global" }]`.
- **`renku-review://<review-id>`:** safe current panel state resource, used for
  pending-preparation refresh. **`renku-reference://<review-id>/<reference-id>`**
  and its `/thumbnail` variant resolve only to declared Core-authorized media.
  Reference identities are opaque and independent of native paths.
- **`GenerationReviewControls`:** request-time presentation envelope described
  above, owned by `packages/codex/src/client.ts`. No Core/database model copies.
- **HTML metadata:** `text/html;profile=mcp-app`; on each resource content item,
  `_meta["openai/ui"]: { preferredDisplayMode: "fullscreen",
  availableDisplayModes: ["fullscreen"] }`. Declare the same app capability.
  Inline is not part of this panel's product behavior. Bundle JS/CSS; no external
  resources or external frame/connect origins are required. Declare `blob:`
  resource/connect sources for local media rendering and audio decoding. Verify Blob media under host
  CSP. If initialization reports another mode but advertises fullscreen, request
  it once via `app.requestDisplayMode`; check the returned mode.

`GenerationReview` has `ready`, `preparing`, `preparationFailed`, `submitted`
and `cancelled` phases with a monotonically increasing revision. It is an MCP interaction, not a
Project record. Draft values remain in the panel until an explicit response;
respond/consume/prepared-update transitions are atomic in the local process.
Keep consumed responses as receipt status for that connection. A server restart
expires the interaction; do not infer approval from a stale message. Require a
fresh review. Do not add a durable job scheduler or background execution loop.

Before accepting or consuming a submit/reconfigure response, compare the review
files against their bound hashes through Core. Cancellation needs no source
hash match. A changed source requires preparation/review,
not merging unknown edits. After consuming a reconfiguration action, the Skill
is expected to replace the temporary request during preparation. Its prepared
update checks the expected interaction revision and binds the new exact file
bytes/hash; it must not reject that authorized replacement merely because the
previous file hash changed. Resource and response lookups remain scoped to the
registered review; test independent reviews/Projects and multiple tabs. An active review
cannot silently become another request by reusing its id.

After an app-only response succeeds, use:

```ts
await extensions.message.send({
  role: 'user',
  content: [{ type: 'text', text: reviewActionMessage }],
  _meta: { 'openai/message': { target: 'active', send: true } },
});
```

Register event handlers before `app.connect()`. Use the app instance belonging
to the review; do not target a new conversation or find a thread by title.
`modelContext.update` alone does not resume a conversation. Do not require an
MCP events service for a user click. Test delivery while the thread is idle,
busy and after the user switches to another conversation. If the SDK/host does
not deliver to the originating conversation, the acceptance gate fails.

If sending fails, preserve the accepted action and show a notification retry;
retry only the message, not storage or generation. On an ambiguous send result,
the same response identity remains safe to consume once. Disable Submit after
acceptance. Interrupted generation resumes through the existing CLI recovery
workflow; do not reconsume an old Submit as a new generation request.

Use Diagnostics with `CODEX_REVIEW_UNSUPPORTED`, `CODEX_REVIEW_INVALID`,
`CODEX_REVIEW_STALE`, `CODEX_REVIEW_EXPIRED`, `CODEX_REFERENCE_UNAVAILABLE` and
`CODEX_STUDIO_UNAVAILABLE`; preserve Core diagnostics at their boundary.
`alreadyConsumed` and cancellation are ordinary results. Unsupported display or
messaging is an explicit integration failure, never false acceptance.

## Packaging And Harness Selection

The Renku runtime bundles the MCP server, official SDKs, two compiled HTML
resources and thumbnail dependency. The existing Node runtime remains the
executable environment; users do not need npm/npx or a separate system Node.
Include the new package/build outputs in workspace and release verification.
Use an established single-file bundling plugin/build step with a pinned version;
verify CSS, fonts, icons and dynamic imports are self-contained. Do not hand-roll
an HTML rewriting protocol. Verify the thumbnail binary for supported archives.

The sister repository's Codex manifest references `codex.mcp.json` through
`mcpServers`; the config launches the installed `renku studio mcp`. Preserve
`renku@renku-local` identity and the existing installer/release owner. Resolve
the installed executable without relying on interactive shell initialization.
Do not register this server in the Claude manifest or a shared root `.mcp.json`.

Media Producer selects the panel in Codex desktop when the Renku review tools
are available, and documents a missing/unsupported integration clearly. It must
not silently revert to Visualize or Studio Preview when the requested Codex
panel cannot open. Claude retains its current instructions and dialog path.
Update shared workflow text and harness branches together so neither path
accidentally runs both surfaces. Provider Skills remain the same generation
owners; update only any instructions that unconditionally demand the replaced
Codex presentation step.

## Implementation Slices

1. **Host acceptance using the official SDK.** Implement the thin stdio entry,
   two app resources and minimal review respond/consume flow. Use one real
   review fixture, editable prompt/resolution, a local reference and a test-only
   continuation that records acceptance without provider execution. Demonstrate
   automatic right-panel opening with chat visible, return-to-original-thread
   messaging and sidebar one-click browser opening. Record host/runtime/plugin
   versions and screenshots. Failure stops workflow replacement; it is not
   repaired through private Codex APIs or an unverified browser screenshot.
2. **Core read reuse and bounded review lifecycle.** Move the shared byte read
   to Core; keep CLI conversion/hash behavior thin. Add revision/hash checks,
   response receipts, pending resource reads, cancel and notification retry.
   Exercise model reconfiguration through an actual Skill round trip.
3. **Complete combined UI and references.** Add the separate Studio build entry;
   reuse the prompt editor, tab body and media presentation; implement native
   settings controls with shadcn. Include ordered request navigation and lazy
   images/audio/video. Measure actual Urban Basilica media and common provider
   controls. Keep Claude Preview/Inspector snapshots and behavior intact.
4. **Skill and distribution adoption.** Update Media Producer's Codex branch to
   validate/open/yield/consume/apply/validate/execute, remove its inline Visualize
   and Studio Preview calls, and document panel Submit semantics. Package through
   the existing runtime and Codex-only plugin connection. Verify installed
   artifacts; no publication is implied by this plan.

## Tests And Guardrails

- **Core owner:** single-byte-read hash/projection consistency; envelope safety;
  same authorized reference access. Keep path/registration invalid cases in
  existing owning tests rather than copying their matrix into MCP/UI tests.
- **MCP lifecycle:** initial/update/reconfigure/submit/cancel transitions,
  expected revisions, duplicate identical/conflicting response ids, consume
  once, stale source hash, connection expiry and two independent Projects.
  Confirm no execution, attachment or arbitrary domain mutation capability.
- **UI:** exact multiline/Unicode prompt editing and mentions; enum descriptions,
  numeric bounds, boolean and nested/array controls, full route list, pending
  model preparation, old values not applied to new routes, ordered multi-request
  navigation, visible errors and cancellation. Use representative full surfaces.
- **References:** lazy visible thumbnails and on-demand full bytes; image zoom,
  playable audio/video, correct roles/order, unavailable references and Blob
  disposal. Do not send media in conversation messages or model text results.
- **Handoff:** Submit resumes the source conversation without a manual message;
  provider/model switch prepares but never executes; a lost/retried notification
  cannot consume twice; busy thread/tab switch does not redirect the action;
  altered source/request preparation requires a new review. Existing Execute
  hash protection and provider validation remain authoritative.
- **Harness regression:** Codex opens one combined panel and no automatic Studio
  Preview/Visualize, including built-in Codex generation; Claude still opens
  Preview and follows its existing settings and confirmation behavior. Native
  Studio request inspection remains available.
- **Launcher:** CLI URL pass-through, running/stopped status, handler order,
  exactly one open request, denied opening, internal/external browser preference.
- **Architecture:** import-boundary checks prevent Codex server imports of
  Engines/CLI internals and panel imports of server/database modules; ensure
  the isolated UI graph does not initialize Studio HTTP/router services. Tests
  protect these capabilities/contracts, not private function-name strings.
- **Release:** bundled Node launch, correct assets/dependencies/platform image
  binary, desktop executable resolution and Codex-only registration.

## Documentation And Final Verification

When accepted, add
`docs/decisions/0105-use-codex-generation-panel-and-studio-launcher.md` and
`docs/architecture/codex-plugin-integration.md`. Confirm that ADR number remains
unused at implementation time. Add concise notices to ADRs 0086 and 0091 for
Codex's new review/continuation surface and template-cache exception; preserve
their original reasoning. Update current generation architecture/reference,
CLI docs, Media Producer Skill/workflow/examples/evals, and Codex setup/browser
preference instructions. Do not rewrite historical plans or remove general
Visualize functionality from unrelated Skills.

After implementation run Studio root `pnpm build`, `pnpm test`, `pnpm lint` and
`pnpm check`, including the new package. Run sister-repository
`pnpm test:media-generation` and `pnpm release:test`. Use focused tests during
each slice. Do not install dependencies implicitly while executing checks.

Perform desktop acceptance on the intended Codex build and Claude Desktop.
Record actual panel placement and visible conversation, initial/mid-edit/model
change/submit states, ordered requests, source-thread continuation, browser
launcher destination and media timings. SDK/mock tests cannot establish host
placement or automatic messaging behavior. A test continuation suffices for
transport checks; paid generation requires authorization for that generation.

Inspect the complete diff, large/heavily modified files, dependency graph and
all public indexes. Confirm Core reuse did not create a god file and the new
renderer did not become a provider-specific switchboard. Reject unrelated
format churn. Do not mark complete while a required interaction only works by
manual panel opening, another conversation confirmation, omitted media/settings
or changes to Claude's existing workflow.

## Completion Checklist

### Review And Host Acceptance

- [ ] Confirm the Codex panel Submit policy, including previously immediate/built-in lanes, is explicit in accepted direction.
- [ ] Demonstrate automatic right-panel opening with conversation visible and no manual opener click.
- [ ] Demonstrate Submit sends to and resumes the originating conversation, including thread switching/busy state.
- [ ] Demonstrate sidebar one-click launch with Codex's internal-browser preference.
- [ ] Record actual host/plugin/runtime versions and native screenshots; do not substitute a browser-only proof.

### Architecture And Contracts

- [x] Add the bounded Codex runtime package and thin `renku studio mcp` entrypoint.
- [x] Use official SDK registration, resource display metadata, capability checks and messaging.
- [x] Refactor shared exact-byte review reads/hashes into Core without changing CLI generation ownership.
- [x] Implement the four named tools, scoped resources, presentation contract and structured errors.
- [x] Keep provider controls request-time/Skill-authored; no Core provider catalog or UI provider dispatcher.
- [x] Enforce revision/source-hash checks, consume-once action receipts and connection expiry.
- [x] Keep domain writes/provider execution out of MCP and the panel.

### Implementation And UI

- [x] Build the isolated Studio review and launcher resources with bundled scripts/styles/assets.
- [x] Reuse prompt editing/mentions, tab presentation, reference cards and media primitives.
- [ ] Implement rich actual native controls, full provider/model choices and ordered request navigation.
- [ ] Complete model selection → agent preparation → same-panel refresh without manual reopening.
- [ ] Preserve exact references and explicitly handle incompatible routes/credentials/preparation errors.
- [ ] Load thumbnails lazily and full image/audio/video only on demand; release Blob URLs.
- [x] Implement Submit/cancel and stored-action notification retry without duplicate execution.
- [x] Confirm closing a panel never authorizes generation.

### Skill, CLI And Harness Surfaces

- [ ] Codex uses validation without Studio delivery before opening the review panel.
- [ ] Agent yields after opening, consumes the submitted action and continues the existing CLI workflow.
- [ ] Apply accepted edits, validate and retain Execute's expected request hash.
- [ ] Built-in Codex follows the requested panel handoff and retains its existing generation/import capability.
- [ ] Remove inline Visualize and automatic Studio Preview calls from Codex generation instructions/evals.
- [ ] Claude Preview/settings/confirmation and Studio Preview/Inspector behavior remain intact.
- [ ] Launcher delegates status/URL discovery to CLI and reports stopped Studio/opening failure clearly; URL delegation works, but native opening still leaves an indefinite status.

### Tests, Performance And Distribution

- [ ] Cover state transitions, stale inputs, duplicate responses/notifications and independent review isolation.
- [ ] Verify actual model reconfiguration and representative image/video/audio settings.
- [ ] Verify media playback and measure 1/6/12-reference cold/warm interaction and large-media limits.
- [ ] Test cancellation, send failure/retry, restart expiry and busy/source-thread routing.
- [x] Add stable import/capability guardrails without private implementation-name tests.
- [ ] Package server, UI, SDKs and image dependencies through the existing runtime archive.
- [ ] Verify executable discovery with bundled Node in the desktop environment.
- [x] Codex-only manifest/config preserves plugin identity and Claude installation.
- [x] Run focused tests, root checks and sister-repository validation.

### Documentation And Final Shape

- [ ] Add the accepted ADR/architecture document and narrow prior ADRs through concise notices.
- [ ] Document exact panel/harness policy, browser destination and measured host constraints.
- [ ] Update CLI/Skill references, examples and evals; preserve unrelated Visualize/cache functionality.
- [ ] Inspect the full diff, large/heavily modified files and dependency graph.
- [ ] Confirm thin public indexes, focused handlers and no broad dispatcher/catch-all abstraction.
- [ ] Confirm no checklist item was satisfied by accepting unreviewable structure or dropping a required interaction.
- [ ] Record all desktop acceptance evidence before marking implementation complete.

## Planning Handoff (Before Implementation)

This is a proposed revision of 0220, not an implementation. Official APIs and
installed host source support the intended panel/resource/message design.
Automatic opening, source-thread continuation, media performance and one-click
browser launching still require the named end-to-end host acceptance slice.
No production code, dependency installation, plugin reinstall, paid generation,
publication or automatic plan review was performed for this revision.

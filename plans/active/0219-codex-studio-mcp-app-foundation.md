# 0219 Existing Studio UI In Codex Panels

Status: abandoned by user direction
Date: 2026-10-01

The user withdrew this proposal. The current integration proposal is
[0220 Codex Generation Forms And Studio Launcher](0220-codex-generation-forms-and-studio-launcher.md).
The research below is historical context, not implementation direction.

## Summary

Display the existing Renku Studio application beside a Codex conversation and
from the Renku plugin's sidebar entrypoint. Keep its screens, editing workflows,
HTTP API, authentication enforcement, media behavior, and CLI-driven live updates.
Existing skills continue calling the Renku CLI.

**Native-panel candidate requiring a substantial UI integration: deliver the existing React application as
an MCP HTML resource, with a local transport adapter for its existing HTTP API
and media.** The local MCP process discovers Studio through the CLI and talks to
the existing server. The sandboxed UI communicates through the official MCP Apps
SDK. It makes no browser network request to localhost, so its operation does not
depend on obtaining an exception to Codex's localhost frame policy.

This is intended to retain the skills, CLI commands, Core services, database,
HTTP routes, screens, and editing workflows. It requires changes to the UI's
transport, packaging, static asset delivery and browser integration. It is not
a minimal embedding of the existing app. Relative implementation effort has not
been measured. Official MCP Apps documentation describes this architecture and provides
a video-resource example. Full Studio performance and browser-feature parity in
the installed Codex host still require implementation and acceptance testing.

**The already working alternative is Codex's built-in browser panel.** The real
local Studio Project Library was inspected there during this research. A small
plugin launcher can request opening its CLI-reported URL through `App.openLink`;
the installed host routes local links according to its local-URL destination
setting. The launcher-to-browser transition has been traced in shipped source,
but has not been exercised end to end with a new SDK plugin. This is explicitly
a browser content panel, not Studio rendered inside the MCP sandbox.

Public hosting, HTTPS, certificates, and tunnels are unnecessary for either of
these designs. Research and previous experiment cleanup are complete. Only this
proposal changed; no replacement proof, production code, dependency install, or
trust configuration was created. The native transport design is a proposal for
a bounded first implementation slice, with full-app acceptance requirements.

## Review Attention

- **Full existing Studio is the target.** Preserve visual components and domain
  workflows. A representative screen is only a first-slice verification target,
  not permission to deliver a reduced app.
- **Delegate to the CLI.** Reuse `renku studio server status --json` for discovery
  and `renku studio start [--no-browser]` for startup/browser launch. The MCP
  adapter must not read internal runtime descriptors or own server configuration.
- **New scope requiring acceptance:** a second build target for the same UI,
  an explicit browser/MCP transport boundary, MCP media resources, and host
  navigation handling. These are necessary for genuine native-panel rendering
  without browser access to localhost. They do not change skill procedures.
- **Candidate new contracts:** `renku studio mcp`, `@gorenku/studio/mcp`,
  `studio.open`, app-only `studio.api.request`, one UI resource, and media
  resources. A bounded transport to the existing Studio HTTP routes is proposed;
  an arbitrary network, shell, filesystem, or domain-state executor is not.
- **Media is the main engineering risk.** Urban Basilica includes videos up to
  34,002,538 bytes and SPZ files up to 29,111,744 bytes. SDK examples demonstrate
  binary media delivery, but do not establish Codex payload limits or acceptable
  Studio performance. Measure these early, before broad UI conversion.
- **The application bundle is another independent gate.** The existing September
  30 build is about 75 MiB across 61 files, including 7 MiB JavaScript, 59 MiB
  bundled images and 9 MiB bundled videos, before Project media. Delivering one
  HTML resource does not mount these files as a same-origin website. Static
  asset delivery and initial document size need their own verified design.
- **Platform actions require acceptance:** supporting-file navigation/downloads,
  uploads, clipboard, routing, storage, fullscreen, and Spark/WebGL must be
  verified in the native host. Existing user actions must remain usable; visual
  redesign and monkey-patching browser globals are outside this proposal.
- **Preserve current behavior:** browser Studio remains available; skills use
  the CLI; edits stay behind existing HTTP/Core commands; live refresh stays
  on the existing event API through the selected transport; the most recently
  engaged Studio instance remains the global CLI context. Opening a panel does
  not bind a chat to a Project.
- **No data migration, cleanup, or publication:** this integration needs no
  database schema change or Project rebuild. Certificate trust changes, public
  exposure, tunnels, lifecycle hooks, background services, and releases are
  separate consequential choices, not hidden setup steps.
- **Choice made visible:** the native transport proposal meets the requested
  native surface with UI infrastructure changes. The browser-panel alternative
  preserves the entire application implementation and needs only opening logic.
  It will not silently replace the native implementation. Dependency installation
  requires explicit authorization under repository rules.

## Requirement Ledger

| ID | Requirement | Response and acceptance |
| --- | --- | --- |
| R1 | Show the existing Studio UI beside the conversation. | Load the actual existing application; verify Project Library, Movie Studio, Settings, media, and editing surfaces rather than a replacement screen. |
| R2 | Also expose Studio from the plugin sidebar. | Declare a global entrypoint on the same opener as the thread entrypoint; verify both in the installed desktop host. |
| R3 | Keep the existing UI unchanged. | Preserve routes, React screens, styles, controls, and domain behavior. Any platform integration required for an existing action must be exposed in Review Attention before implementation. |
| R4 | Retain the substantial skills/CLI investment. | No conversion of skills or domain commands to MCP; verify a representative existing skill/CLI edit reaches the displayed UI through the current event path. |
| R5 | MCP does only the minimum Codex integration. | Native option: opener, HTML resource, bounded app-only transport to existing HTTP routes, and media resources; no domain command migration. Browser option: opener only. |
| R6 | Delegate Studio ownership to the Renku CLI. | Consume the public JSON status contract; retain CLI-owned startup and browser launch. Pass the reported address to the host instead of independently constructing one. |
| R7 | Allow a normal browser as well. | Preserve `renku studio start` and concurrent browser/panel instances. Presentation is a user choice; no silent browser fallback on panel failure. |
| R8 | Use official Plugin Creator guidance and SDKs. | Follow the installed update-plugin workflow and stable MCP Apps/OpenAI Extensions registration, initialization, and metadata contracts. |
| R9 | Remove the earlier hacks. | Completed cleanup record below; no reintroduction of the handwritten protocol server or insecure frame attempt. |
| R10 | Deep research, no invented support claims. | Read the applicable documentation/specifications in full, search the complete Plugins corpus, inspect current Studio and installed host behavior, and label unverified assumptions. |
| R11 | Architecture remains a hard gate. | Core keeps business rules; existing HTTP routes keep delegation; CLI owns runtime discovery; MCP owns presentation transport without domain dispatch or database access. |
| R12 | Keep existing runtime lifetime and context rules. | Reuse one Studio server. Panel closure/MCP disconnect does not stop it. Current most-recent engagement policy remains unchanged. |
| R13 | Reviewable plan in `plans/active/`. | Revise this same plan using the repository template, deliberate contracts, feasibility stops, and a comprehensive checklist. |

## Context

Current owners:

- Studio runtime/UI: `/Users/keremk/Projects/aitinkerbox/studio`.
- Renku plugin/skills: `/Users/keremk/Projects/aitinkerbox/studio-skills`.
- Real Project for later read-only desktop inspection:
  `/Users/keremk/renku-movies/urban-basilica`.

The installed plugin is `renku@renku-local`, currently version
`0.1.0+codex.20260902154804`, with the existing
`.codex-plugin/plugin.json` manifest. Keep its identity and supported packaging;
a portable-manifest conversion is unnecessary for this request. Runtime and
skills/plugin releases retain their existing independent owners.

Accepted constraints come from `AGENTS.md`, the plan template, current package
layering, frontend, Hono, naming, coding-practice, structured-diagnostic,
coordination, CLI, and distribution documentation. ADRs 0008, 0017, 0031,
0077/0078, and 0101 constrain routing, bounded services, live delivery,
distribution, and skills installation. Current plan 0218 preserves the globally
most recently engaged live view; 0213 preserves lazy CLI loading. Generation and
provider plans need no new surface for this integration.

Applied Plugin Creator's update-plugin workflow and its Extensions, local-plugin,
packaging, and creation references, plus the repository's renku-plan skill.
Read the full repository instructions, template, and planning review memory.
No automatic plan review or delegated agent review was run.

## Documentation And Research Evidence

### Reading scope and versions

The supplied page and live Extensions documentation were read in full. The
complete official Plugins documentation corpus was searched for frames,
localhost, local services, HTTPS, origins, browser navigation, storage,
permissions, and UI resources. Relevant pages below were
read in full. Searching the corpus is not a claim that unrelated checkout,
restaurant, or publication form specifications were all read.

| Sources read | What they establish for this request |
| --- | --- |
| [Plugin Extensions](https://developers.openai.com/plugins/build/extensions) | The host integration is an MCP App extension, with distinct global and conversation entrypoints. |
| [OpenAI SDK README](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/README.md), [TypeScript SDK](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/typescript/README.md), [complete extension specification](https://github.com/openai/mcp-extensions/blob/node-v0.1.0/docs/spec.md) | Registration, metadata placement, display modes, capability negotiation, and the actual extension APIs. |
| [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins), [skills](https://developers.openai.com/plugins/concepts/skills), [build skills](https://developers.openai.com/plugins/build/skills), [define tools](https://developers.openai.com/plugins/plan/tools) | A plugin can combine independent skills and a focused MCP capability. UI integration does not require replacing CLI workflows. |
| [Build server](https://developers.openai.com/plugins/build/mcp-server), [add UI](https://developers.openai.com/plugins/build/chatgpt-ui), [reference](https://developers.openai.com/plugins/reference) | Tool/resource linkage, HTML delivery, CSP contents metadata, useful headless results, and optional host APIs. |
| [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines#iframes-and-embedded-pages), [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines), [security/privacy](https://developers.openai.com/plugins/guides/security-privacy) | Full existing editors may be embedded under the ownership policy; framing and sandbox permissions still apply. |
| [Authentication](https://developers.openai.com/plugins/build/auth), [MCP Events](https://developers.openai.com/plugins/build/mcp-events) | Remote authorization and webhook subscriptions are distinct concerns. Neither replaces Studio's local token boundary or current refresh path. |
| [Package plugin](https://developers.openai.com/plugins/build/plugins), [connect/test](https://developers.openai.com/plugins/deploy/connect-chatgpt), [troubleshooting](https://developers.openai.com/plugins/deploy/troubleshooting), [UI changelog](https://developers.openai.com/plugins/changelog) | Supported local packaging and actual-host verification; ChatGPT-specific advice is not a universal Codex guarantee. |
| MCP Apps [README](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/README.md), [stable specification](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/specification/2026-01-26/apps.mdx), [overview](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/docs/overview.md), [quickstart](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/docs/quickstart.md) | SDK lifecycle, sandbox authority, raw HTML resource format, and the limits of URL-only embedding. |
| MCP Apps [CSP/CORS](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/docs/csp-cors.md), [patterns](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/docs/patterns.md), [authorization](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/docs/authorization.md), [testing](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/docs/testing.md), [web-app conversion skill](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/plugins/mcp-apps/skills/convert-web-app/SKILL.md) | Network declarations, optional platform permissions, state, and the difference between framing a site and converting its data transport. |
| MCP TypeScript SDK [README](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/README.md), [server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/docs/server.md), [Bits & Bolts reference plugin](https://github.com/openai/mcp-extensions/tree/node-v0.1.0/plugins/bits-and-bolts) | Official stdio transport and SDK registration. Reference server/build/plugin files were read; frontend transport initialization was inspected. |
| [Desktop browser](https://learn.chatgpt.com/docs/browser), [desktop plugins](https://learn.chatgpt.com/docs/plugins), [Plugin Creator usage](https://learn.chatgpt.com/docs/build-plugins), [site tools](https://learn.chatgpt.com/docs/webmcp) | The built-in browser has an official split view and localhost support. WebMCP is a separate capability and is unnecessary here. |
| Chrome [LNA explanation](https://developer.chrome.com/blog/local-network-access), [complete adoption guide](https://docs.google.com/document/d/1QQkqehw8umtAgz5z0um7THx-aoU251p705FbIQjDuGs/edit) | Local-network/loopback permission and iframe delegation can apply independently of CSP or certificate trust. |
| [Vite server options](https://github.com/vitejs/vite/blob/v7.2.0/docs/config/server-options.md), installed Hono Node adapter | TLS needs a certificate; HMR uses a separate development connection; Hono derives request scheme from the actual socket. |
| [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) | This tunnels MCP calls, not the Studio website as a browser origin. Its bounded HTTP callouts do not supply a transparent web app hosting solution. |

The stable implementation baseline researched on October 1, 2026 is OpenAI
`node-v0.1.0` (published September 29), MCP Apps `1.7.5`, and MCP TypeScript SDK
`1.29.0`. OpenAI's package requires Node 22 or newer; Renku already distributes
private Node 24. Zod 4.4.3 is already represented in the workspace lockfile.

If implementation is authorized, recheck release metadata and pin the verified
SDK baseline. The embedded bundle may use `vite-plugin-singlefile` 2.3.3; its peers
support Vite 7 and Rollup ^4.59.0, and the workspace resolves Rollup 4.60.3. No
package installation has occurred. Studio's browser UI does not need the OpenAI
UI component library or a second React application.

### What is explicitly supported

1. **Full existing application embedding:** OpenAI's iframe policy explicitly
   includes full existing editors and admin interfaces from the MCP server's
   own registrable domain. Therefore rebuilding Studio into native MCP screens
   is not intrinsically required. The policy's local-stdio/localhost ownership
   case is not explicitly resolved in the published examples; public submission
   requirements must not be mistaken for a local-host permission guarantee.
2. **Global and thread entrypoints:** declare both in tool
   `_meta["openai/ui"].entrypoints`. Both accept `{}`. The global entrypoint
   uses the host's app/thread layout; the thread entrypoint opens a content tab
   beside its conversation. Each conversation has its own app instance.
3. **HTML resource plus SDK:** associate the opener using
   `_meta.ui.resourceUri`; serve a `ui://` HTML resource with MIME
   `text/html;profile=mcp-app`. Use `McpServer`, `StdioServerTransport`,
   `registerAppTool`, `registerAppResource`, and frontend `App`.
4. **Framing metadata:** put `_meta.ui.csp.frameDomains` on the returned resource
   content object, inside `contents[]`. A tool result or registration options
   object is not a substitute for this placement. Set display modes there too;
   use the SDK's typed OpenAI metadata for entrypoints and fullscreen preference.
5. **The nested site retains its own origin:** when the actual Studio URL is
   framed, its relative API calls target Studio. Parent `connectDomains` and
   `resourceDomains` do not govern requests inside that nested document.
   Ancestor sandbox/permission restrictions still apply. This distinction is
   why a frame can preserve the existing HTTP service layer.
6. **CLI skills can remain independent:** nothing in these contracts requires
   MCP domain tools for an app that already has working skills and a CLI.

### Things the SDK does not provide

- A URL-only native website panel: external-URL content types are deferred in
  the stable MCP Apps specification. An HTML wrapper is still required.
- A permission to override host CSP, TLS validation, or local-network access.
  The host can reject declared origins and requested permissions.
- A public method that embeds a CLI-opened browser into the MCP sandbox.
  `App.openLink` requests host navigation. In this installed desktop build,
  local URLs can be routed to its built-in browser panel; the SDK contract
  itself leaves the destination to the host. `setOpenInAppUrl` is not an
  iframe transport or an API for forcing the destination preference.
- A same-origin Studio API by setting `_meta.ui.domain`. That field selects a
  component sandbox origin; it does not host/proxy the Studio application.
- A requirement to use MCP Events, tools for each CLI command, resource-based
  media transport, host-managed Project state, or ChatGPT file uploads here.

### Observed restrictions in this installed Codex build

Read-only inspection identified desktop bundle `com.openai.codex` at
`/Applications/ChatGPT.app`, version **26.928.21956**, build **12404**. Evidence
comes from its `Info.plist`, shipped `app.asar`, the earlier host log, and an
unauthenticated response from the public MCP sandbox document. The source
archive was not modified or executed. These observations describe this version;
they are not stable plugin APIs.

| Evidence | Finding | Implementation consequence |
| --- | --- | --- |
| Earlier host log, October 1 at 10:34:54 UTC | Framing `http://localhost:5173/` hit `frame-src 'self' https: data: blob:` and `frame-src 'none'`, then `ERR_BLOCKED_BY_CSP`. Studio itself responded successfully. | A running server or correctly appearing tab is insufficient evidence of an embedded app. |
| Shipped `webview/assets/resource-9e26e1dcc06a.js` | The resource parser recognizes canonical `frameDomains`, but its frame-origin normalization accepts HTTPS and filters HTTP origins out in this build. | SDK conversion or correct metadata placement alone does not permit the current HTTP site. |
| Public `https://web-sandbox.oaiusercontent.com/mcp-app.html` response | Its outer response independently restricts nested frames to HTTPS/self/data/blob. | Resource metadata cannot widen this ancestor policy to local HTTP. |
| Shipped `.vite/build/main-BbeJ4AAR.js` | Native guests retain web security, disallow insecure content, restrict root navigation, deny `window.open` popups, and cancel ordinary downloads. | Replacing the root location or monkey-patching browser behavior is not a supported solution. Supporting-file actions need parity verification. |
| Shipped native permission handling and `webview/assets/widget-4027197e5a6d.js` | Local-network access is explicitly host-gated. No general public SDK switch for arbitrary local-stdio frame origins was found. | Trusted HTTPS is necessary but not proven sufficient for loopback embedding. Do not use private flags, sandbox identities, or app patches. |
| Chrome adoption guide, updated May 18, 2026 | Subframe navigation can be permission-gated; nested frames need delegation through every ancestor. Modern Chrome distinguishes local-network and loopback-network permissions. | A successful standalone HTTPS browser page does not prove the native MCP frame path. |

HTTPS loopback embedding has not been tested in the actual MCP panel. The native
custom sandbox scheme's effective address-space classification is also not
established by the public docs. Do not infer that local HTTPS definitely works
or definitely fails solely from the permission handler. The real host must
settle it without disabling security.

### Current Studio ownership and behavior

| Existing code | Observed contract | Effect on this design |
| --- | --- | --- |
| `packages/cli/src/commands/studio/server-status-command.ts` | `renku studio server status --json` reports running/fresh status, canonical address, descriptor address, and foreground policy. Tokens are represented only by presence booleans. | Use this public command; no internal descriptor reads or token copying in MCP. A read during this research reported the current canonical HTTP server running. |
| `packages/cli/src/commands/studio/start-command.ts`, `browser-launch.ts` | `renku studio start` reuses a fresh server or runs it in the foreground, and opens the system browser. `--no-browser` suppresses that launch. | The CLI owns lifecycle. Its current browser opener has no Codex panel API. Cold startup must preserve the documented visible-terminal policy. |
| `packages/studio/server/runtime.ts`, `vite.config.ts` | Installed Studio and development Studio currently publish an HTTP endpoint. There is no existing HTTPS listener. | Any additional panel endpoint is a real Renku runtime change, not MCP configuration trivia. Development and installed runtimes both need consideration. |
| `server/http/studio-api-token.ts`, `routes/bootstrap.ts`, `src/services/studio-api-fetch.ts` | API calls are relative; a supplied mutation Origin must match the actual scheme and host; requests without Origin still require the token. Bootstrap requires its dedicated header. | Browser mode keeps its token flow. The proposed native local process obtains and retains its own token through the existing bootstrap route; no token crosses into the MCP UI or model result. |
| Installed `@hono/node-server` request construction | Request URL scheme derives from `socket.encrypted`, rather than trusting forwarded-proto headers. | A naive HTTPS reverse proxy into the existing HTTP server produces a scheme mismatch for mutations. Native TLS can preserve the check, if chosen and verified. |
| `src/app/use-studio-coordination.ts`, `services/studio-events-api.ts` | Each UI instance registers a browser session; the app polls current HTTP events every two seconds and invalidates existing queries. Activity and focus remain part of global context. | Native mode can carry the same requests through the SDK without a replacement event system. Browser mode remains as implemented. Test focus and visibility behavior. |
| `src/app/theme-provider.tsx` | Theme uses Studio's own localStorage and system preference. Coordination uses sessionStorage. | Preserve Studio theme behavior; verify nested storage availability rather than replacing it with host-owned state. |
| `src/services/supporting-files.ts`, `server/http/supporting-file-response.ts` | Supporting files open in a new browser tab; some responses download, and previews deliberately deny framing. | In-place framing of files is not a substitute. The existing action conflicts with the observed native popup/download restrictions. |
| `src/ui/video-player.tsx`, screenplay external-file dialog | Video can request fullscreen; an export path can be copied to the clipboard. | These are existing features to test against ancestor permissions, not reasons to rewrite playback or screenplay workflows. |
| Runtime release assembly and sister plugin release tools | Studio assets/server code ship in the Renku runtime; the plugin supplies skills and the launch connection. | Keep the small wrapper/server with runtime assets and preserve separate release ownership. |

A naive TLS proxy is particularly misleading: the page may load, but a save can
send `Origin: https://...` while Hono constructs `http://...`, resulting in a
403. The native transport proposal does not introduce TLS or relax Origin
validation: a trusted local Node process uses the existing authenticated HTTP
contract, while browser requests retain their existing same-origin checks.

## Alternative Research And Recommendation

| Approach | Local only? | Existing skills/CLI retained? | Finding |
| --- | --- | --- | --- |
| Existing Studio in Codex browser panel | Yes, current HTTP server | Entirely | Actual Studio Library rendered in the installed in-app browser. Lowest implementation effort; separate from MCP rendering. |
| Official plugin launcher using `App.openLink` | Yes | Entirely | Installed host source routes local URLs to the configured local-URL destination, including the in-app panel. Native launcher transition still needs an SDK integration test. |
| Existing React UI delivered as MCP HTML, local API/media transport | Yes | Entirely | A possible native port of the UI's browser integration. Uses documented SDK mechanisms; practical suitability for the full app remains unverified. |
| Current HTTP URL in a native MCP iframe | Yes | Entirely | Blocked in the installed host, also reported in open Codex issue 45913. Cannot deliver the requested result. |
| Trusted local HTTPS iframe | Yes | Entirely | HTTPS survives origin normalization, but local-network permission and platform parity remain unverified. Not the recommended foundation. |
| Public hosting or a public relay/tunnel | No | Potentially | Conflicts with the explicit local-only constraint. |

The important correction is that **transporting the UI's existing API requests
through MCP does not require converting the skills or CLI to MCP**. The previous
proposal excluded this alternative too broadly. One React application can have
browser and MCP transports while its creative workflows continue to use the CLI.

### Evidence for native transport

- The official [web-app conversion guide](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/plugins/mcp-apps/skills/convert-web-app/SKILL.md)
  describes retaining an existing web application and running it in both browser
  and MCP environments, using `App.callServerTool` for backend communication.
- The [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/specification/2026-01-26/apps.mdx)
  specifies HTML resources, host-mediated tool calls and resource reads, and
  app-only tool visibility. These are standard capabilities, not injected
  browser privileges or handwritten postMessage protocols.
- OpenAI's [network security guidance](https://developers.openai.com/plugins/guides/security-privacy#network-access)
  distinguishes sandboxed UI networking from server-side networking. A local
  stdio MCP process can call its local Studio HTTP server; it does not need the
  iframe's permission to connect to localhost.
- Official [binary-resource patterns](https://github.com/modelcontextprotocol/ext-apps/blob/v1.7.5/docs/patterns.md#serving-binary-blobs-via-resources)
  and the [video-resource example](https://github.com/modelcontextprotocol/ext-apps/tree/v1.7.5/examples/video-resource-server)
  use `resources/read`, base64 blobs, and browser object URLs for playback.
  The example offers several sizes, including approximately 150 MB. That is
  evidence for the protocol pattern, not a Codex payload-size guarantee.
- An [open Codex localhost issue](https://github.com/openai/codex/issues/45913)
  independently reproduces allowlisted local HTTP being blocked. It has no
  published maintainer resolution as of this research. The recommended native
  path avoids this connection rather than relying on an undocumented fix.

The proposed data flow is:

```text
Existing skills -> existing Renku CLI -> existing Core / persisted state
                                                   |
                                                   v
Codex native panel <-> official SDK <-> local MCP process <-> Studio HTTP server
 existing React UI                       fixed local API       existing routes
                                         and media transport   and event stream
```

No Studio website is published. UI data calls travel through the host's MCP
connection directly; the model does not have to generate a command for every
click or poll. App-only visibility keeps transport tools out of the model's
normal tool inventory. This is not a claim about Codex's overall telemetry or
conversation data policy.

### Evidence for the browser-panel alternative

The [desktop browser documentation](https://learn.chatgpt.com/docs/browser)
explicitly describes localhost and side-by-side browser/conversation use. During
this research, computer-use inspection of the actual Codex in-app tab at
`http://localhost:5173/` showed the real Renku Studio Project Library, project
cards, Settings, and normal application controls. This verifies rendering, not
a full editing/media regression test.

The official `ui/open-link` method accepts a URL and leaves the browser choice
to the host. Read-only inspection of installed source established this chain:

1. MCP App `App.openLink` reaches the widget's host navigation handler.
2. The handler submits ordinary desktop URL navigation.
3. Native navigation reads the separate local-URL destination preference.
4. With `in-app-browser`, it opens the browser panel; with `external-browser`,
   it opens the external browser.

Relevant shipped files are `widget-4027197e5a6d.js`,
`app-initial-135a4ef2552c.js`, and `.vite/build/main-BbeJ4AAR.js`.
`open-local-url-in-target-preference` is the inspected internal preference key,
not a proposed plugin API. Do not modify private preferences or invoke internal
IPC. A native settings inspection was unavailable to computer use, so the user's
current selection was not established. A new plugin's exact entrypoint-to-panel
transition remains untested.

A conversational opener can also use the existing Codex `open_in_codex` tool
with the CLI-reported address and right placement. That needs no Studio MCP
server to render the page. A sidebar icon still needs a plugin entrypoint and
its small official SDK launcher. The launcher cannot promise or force a browser
destination through `App.openLink`; the host owns that choice.

This alternative is appropriate if the user prioritizes unchanged application
code. It is not substituted for the requested native implementation in this
plan, and it does not count as native acceptance evidence.

## Native Scope Based On The Actual Code

### Application bundle size and delivery boundary

The existing `packages/studio/dist` build dated September 30, 2026 contains
61 files totaling 78,906,910 bytes (about 75 MiB). It was inspected without a
rebuild. The breakdown is 45 WebP files (59.10 MiB), nine MP4 files (9.05 MiB),
four JavaScript files (6.99 MiB), CSS (0.11 MiB), and HTML/SVG. These are shipped
application assets, separate from the user's Project media. The main JavaScript
chunk is about 1.44 MiB and the dynamically imported Spark chunk about 4.83 MiB.

The current HTML loads `/assets/...js` and `/assets/...css` from Studio's origin.
An MCP HTML resource supplies a document; it does not mount `dist` as an HTTP
origin or automatically resolve browser asset requests against MCP resources.
The single-file build guide is evidence of a packaging mechanism, not evidence
that this 75 MiB application can be transferred or started efficiently in Codex.
The [bundler's own documentation](https://github.com/richardtallent/vite-plugin-singlefile)
also describes limitations and does not guarantee every referenced asset is inlined.

Do not blindly inline the entire build. A practical native design must separate
the executable UI from on-demand bundled images/video and Project media, and
resolve every emitted chunk/worker/WASM dependency. The current proposed media
resource covers Studio API media, not static `/assets` files; a reviewed static
asset contract is still missing. Specify its package/build ownership, resource
identifiers and load behavior before implementation. Measure initial HTML size
and startup in Codex before calling this a suitable full-app architecture.

This is a port of the UI's browser integration while sharing rendering and
business logic. It is not an unchanged website embedded by its URL. The native
candidate must remain labeled unverified; preserving all source unchanged is
currently supported only by the browser-panel alternative.

| Area inspected | Required native adaptation |
| --- | --- |
| `src/main.tsx`, `src/app/app.tsx`, existing feature components and styles | Mount the same React application from a second build entry. Keep screens and controls. Bundle local scripts, styles, fonts, images, workers and WASM so they do not fetch localhost. |
| `src/services/studio-api-fetch.ts` and approximately 20 consuming service files | Introduce an explicit transport boundary here. Preserve the `Promise<Response>` service contract. Move token handling behind the browser/local-server transports. Update callers that construct token headers. |
| `services/screenplay/story-arc.ts`, `structure.ts`, `scenes.ts` | Move their direct fetches to the same request boundary; do not leave hidden localhost calls. |
| `src/services/file-uploads.ts` | Carry current upload bytes/content type through the native transport; measure realistic payloads. Preserve the existing HTTP upload owner and validation. |
| Media UI primitives and approximately 30 media consumers | Resolve API media references to native resource bytes/object URLs, with cancellation and URL cleanup. Browser mode continues using HTTP media URLs. Updating API fetch alone cannot fix images, video or audio element URLs. |
| `features/movie-studio/locations/spark-location-world-viewer.tsx` | Verify Spark's binary/SPZ loading, workers/WASM and WebGL inside the MCP host. A blob URL must not silently lose file-type information needed by the loader. |
| `src/app/use-project-session.ts` | Current routing reads pathname and uses history.pushState. Introduce an explicit embedded route location while preserving domain route names and the browser URL behavior. The sandbox document URL cannot simply become a Studio server route. |
| `src/app/theme-provider.tsx`, session coordination | Verify permitted storage, separate session identity, focus/visibility and existing context semantics. No new Project selection model. |
| Supporting-file navigation, downloads, clipboard, fullscreen | Use advertised public host capabilities where required and verify the existing action end to end. No blanket override of fetch, window.open, history or storage. |

Read-only file-size inspection of Urban Basilica found 63 MP4 files totaling
about 586 MB (largest about 34 MB), and four SPZ files totaling about 116 MB
(largest about 29 MB). Native delivery must be lazy and release unused buffers.
Base64 adds about one third to the wire payload before serialization overhead;
whole-file decoding also temporarily duplicates memory. The official video
example loads a complete file before playback and does not provide HTTP Range
streaming. Measure startup, seeking, concurrent previews, memory, and cancellation.
Do not claim transparent HTTP streaming or an unlimited host message size.

## Architecture Shape Gate

The following shape is proposed for the native option. It changes presentation
infrastructure, not domain ownership. The first slice below is intentionally
bounded so media and host behavior can be established before full conversion.

```text
packages/studio/
  mcp/
    index.ts                         public Node entrypoint, thin
    studio-mcp-server.ts             official SDK registration/lifecycle
    studio-cli-status.ts             fixed public CLI discovery call
    studio-api-transport.ts          local HTTP forwarding and private token
    studio-media-resource.ts         resource envelope and local media reads
    studio-panel-resource.ts         packaged HTML and host metadata
    app/
      studio-panel.html              root for the same Studio React app
      studio-panel.tsx               SDK handshake, transport, React mount
  src/services/
    studio-api-fetch.ts              existing request entrypoint, transport selection
    studio-browser-transport.ts      extracted current HTTP/token implementation
    studio-mcp-transport.ts          App.callServerTool and Response construction
    studio-media-source.ts           HTTP URL or resource/blob lifecycle
  src/app/
    studio-route-location.ts         browser or embedded location mechanics
  tsconfig.mcp.json                  Node adapter build
  vite.mcp.config.ts                 embedded UI build
  mcp-dist/                          generated Node output
  mcp-ui-dist/                       generated HTML output

packages/cli/src/commands/studio/
  mcp-command.ts                     thin lazy CLI entrypoint

studio-skills/
  .codex-plugin/plugin.json          existing identity and MCP reference
  mcp.json                           local stdio launch connection
```

- `@gorenku/studio/mcp` is the intentional public package export; `index.ts`
  only assembles/exports the bounded entrypoint. Node transport code must never
  enter the browser bundle. The SDK client belongs only in the embedded build.
- `studio-api-fetch.ts` becomes smaller by extracting its existing browser
  transport, not by keeping parallel token implementations. Callers use the
  same service contract. Explicit build/bootstrap selection determines mode;
  no exception-based fallback to a different transport.
- Existing HTTP handlers remain the only route-to-Core dispatch. MCP must not
  recreate command inventories, branch on Cast/Scene/generation purposes, import
  Core services, open databases, or validate creative artifacts.
- The local transport accepts only the CLI-discovered local Studio origin and
  Studio API paths. Its boundaries reject arbitrary origins, redirects outside
  that boundary, filesystem paths, shell commands, and caller-selected token or
  Origin headers. Existing routes/Core retain all domain validation.
- This is a transport for an already existing API, not a generic state mutation
  API. Any implementation needing direct database/domain patches fails the gate.
- Media transport carries opaque bytes. Object URL creation/revocation has one
  owner. Feature components do not each implement resource reading/base64 logic.
- Route location owns only browser versus embedded navigation. Existing route
  interpretation stays with its current owner; do not duplicate route parsers.
- Runtime release assembly owns executable dependencies and assets. The sister
  plugin only wires the launch connection; it does not install runtime packages.
- Startup stays in the existing CLI/visible-terminal workflow. A local stdio
  connection does not make the MCP process the owner of Studio's lifetime.

Stop if the request transport becomes a domain dispatcher, media processing
starts interpreting content, duplicated React screens appear, a compatibility
facade is added, or one module accumulates networking, routing, domain rules,
file processing and UI lifecycle. Split by the stated owners before continuing.

## Proposed Contracts

### Runtime and entrypoints

Retain the public `renku studio server status --json`, `renku studio start`,
`renku studio start --no-browser`, `renku studio stop`, and current-context
commands. Add `renku studio mcp` to run the SDK stdio presentation adapter.
The plugin connection uses `command: "renku"`, `args: ["studio", "mcp"]`.
It uses Renku's installed private runtime rather than an assumed system Node.

Discovery uses fixed CLI arguments and its JSON contract. Studio's local origin
is selected by Renku; MCP does not choose HTTP/HTTPS, ports, certificates or
runtime descriptor paths. Protocol stdout is reserved for the SDK; subprocess
output is captured and diagnostics use stderr.

`studio.open` accepts `{}` and reports `StudioPanelLaunch` containing
`studioUrl: string` for host navigation when requested. The native React app
gets its data from its SDK connection, not by framing that address. Opener
annotations describe read-only status discovery. Starting the server is an
existing CLI operation in a visible terminal, not a hidden side effect.

Declare global and thread entrypoints using the OpenAI SDK metadata types.
Link to `ui://renku/studio/v1` with MIME `text/html;profile=mcp-app`. Resource
metadata belongs on the returned `contents[]` object. Advertise fullscreen
using the documented resource and initialization contracts, with title `Studio`
and the prescribed monochrome icon. Use the same HTML resource for both entrypoints.
The bundle must not require localhost frame/connect/resource CSP entries.

### API transport

Propose app-only `studio.api.request`, with `_meta.ui.visibility: ["app"]`.
It carries the existing HTTP method, relative Studio API path/query, and an
optional body envelope: content type, encoding (`utf8` or `base64`), and bytes
represented as a string. The response preserves HTTP status, content type and
body, so existing Studio response/diagnostic handling remains authoritative.
Use SDK calls, not a custom host protocol. Mutation annotations must reflect
that this app-only transport can perform existing UI writes.

Transport initialization is explicit. Browser mode delegates to the extracted
current fetch/token owner. Native mode constructs a Response from the SDK reply.
Update service callers to stop assembling authentication tokens themselves.
Do not pass arbitrary request headers through the MCP contract. HTTP error
responses retain their existing status and structured diagnostics; transport
failures are distinct from domain failures.

The local adapter obtains its token from the existing bootstrap route using
that route's required header and retains it in process memory. Node requests
use the existing no-Origin local-client path, which still requires the token
for writes. Browser Origin enforcement remains intact. The bootstrap response,
token, and credentials must never be returned as a transport result; reserve
bootstrap for the transport owner. Token renewal preserves the existing rule:
retry only a known authentication rejection that occurs before mutation.

Even read-only inspection of Studio runs POSTs for session activity and focus.
The first slice therefore needs JSON request bodies and truthful mutating-tool
annotations; a GET-only bridge would break current coordination. Use read-only
interaction with the populated Project and isolated fixtures for durable edits.
Full binary uploads and all write journeys are verified in the next slice.

### Media and platform boundaries

Propose `renku-studio-media://local/{encodedPath}` resources, where encodedPath
represents an existing relative Studio media API path including its query.
The server decodes and validates the transport boundary, then reads through the
existing Studio HTTP route. It never reads arbitrary filesystem paths or accepts
an origin from the UI. MIME type comes from the existing response. Deliver
opaque bytes via the SDK's blob resource pattern and create object URLs only
inside the UI. Unmount, source replacement, cancellation and errors release
references/buffers; do not preload the whole movie library.

For the first proof, test whole-file resources with real representative media
sizes and concurrency. If that fails, report measurements. Any chunk/range
contract must be deliberately specified in this plan before implementation;
the SDK's documented chunked-tool example is not automatic streaming support.
No arbitrary new file-size cap may silently remove current Studio functionality.

The first slice exercises embedded navigation without changing domain routes.
Before full rollout, specify the exact public host capability used for each
supporting-file/download action, and verify host support. App.openLink may open
a local supporting-file URL in a browser; that is acceptable only for the
existing external-file action, not as a silent replacement for the Studio panel.
Do not promise downloadFile or any newer SDK method without checking capability
availability in the selected installed host.

### Lifetime and diagnostics

Close/disconnect disposes the UI session, object URLs, and MCP transport; it does
not stop Studio. Browser and native UI can remain open against the same runtime.
Preserve global most-recent engagement semantics; do not bind a chat to a Project.

Use existing structured HTTP/Core diagnostics without translation into a second
domain vocabulary. Proposed presentation errors are `STUDIO_PANEL001` for CLI
invocation failure, `STUDIO_PANEL002` for invalid status output,
`STUDIO_PANEL003` for stopped runtime, `STUDIO_PANEL004` for missing host
capability, and `STUDIO_PANEL005` for transport failure. Return expected MCP
failures using SDK error/result conventions with actionable details and no secrets.
Do not retry uncertain mutation outcomes or switch to a browser automatically.

## Implementation Slices And Acceptance Gates

### 1. Prove native delivery with the existing application

This is the proposed next implementation, not code already written. Obtain
explicit dependency-install authorization under repository rules, then use the
researched official SDK versions and normal local plugin installation workflow.
No certificates, HTTP exceptions, public services or host patches are needed.

Add the isolated SDK server/resource build, thin CLI command, and embedded
entrypoint. Mount the existing App and ThemeProvider. Add the explicit request
transport including existing session/focus JSON POSTs. The target is the real
Project Library and its actual components/data, plus representative navigation
and media. Keep the existing browser entrypoint working.

Before expanding conversion, demonstrate in an actual MCP App tab:

- official SDK initialization and local stdio connection;
- a specified static asset contract, measured initial document size/startup,
  and on-demand bundled image/video loading without loading the whole build;
- global and thread entrypoints loading the actual Studio components;
- requests served by the local Studio process without UI-to-localhost networking;
- a real image, video playback and seeking, and SPZ/WebGL loading;
- resource transfer at observed approximately 34 MB video / 29 MB SPZ sizes,
  with measured latency, cancellation, memory and repeated-open behavior;
- existing event polling carried through the transport and visible updates;
- a distinct native UI session and usable embedded routing.

Use read-only Urban Basilica inspection and isolated fixtures for any necessary
write-based event checks. Record host version and exact failures. A normal browser
tab, iframe load event, or successful tool return is insufficient evidence.
If media/host constraints fail this gate, stop broad conversion and present the
measured limitation with the working browser alternative. Do not paper over it
with a reduced app, unlimited buffering, or public network access.

### 2. Complete the existing API and media callers

After slice 1 passes, complete binary uploads and verify existing write journeys.
Refactor the remaining token-building service callers around `studio-api-fetch.ts`
and the three direct screenplay fetch sites. Test same-origin browser behavior
and local transport token handling in their owning layers.

Wire media consumers through the common media-source owner. Complete routing,
focus, storage and lifecycle adaptation using the same app. No new domain tools,
CLI workflow migration, replacement React screens or purpose registries.

### 3. Preserve platform actions and distribution

Complete supporting files/downloads, file input, clipboard and fullscreen with
advertised host APIs or the existing browser action as explicitly specified.
Preserve Studio's current visual UI. Revise this plan with exact capability
contracts if slice 1 identifies a platform gap; do not bury an action loss.

Include built Node entrypoint, UI assets and SDK dependencies in existing runtime
release assembly/verification. Wire the sister plugin with its existing identity
and supported installation commands. Keep independent runtime/plugin releases.
No publication is part of local acceptance.

### 4. Verify full Studio and document support

Complete the matrix below in the installed Codex host and the ordinary browser.
A representative skill/CLI edit must refresh the native UI without an MCP version
of that command. Native mode is complete only when the existing app's relevant
behavior works, including media and external-file actions.

## Tests And Guardrails

Automated checks should cover SDK handshake/resource metadata, fixed CLI discovery,
HTTP envelope serialization and structured failures, URL/origin/path confinement,
token privacy, mutation retry safety, media lifetime/cancellation, routing, and
representative existing service/UI behavior under each explicit transport.
Do not duplicate Core domain-validation matrices in MCP tests.

Architecture checks protect import/package boundaries and forbidden capabilities:
no Node SDK in browser features, no Core/database imports in MCP, no arbitrary
network/filesystem/shell executor, and no global browser monkey-patching. Avoid
private function-name needles and inventories of today's commands/routes.

| Desktop acceptance area | Required result |
| --- | --- |
| Native entrypoints | Sidebar/global and current-conversation entrypoints show the full existing Studio app in an MCP App tab. |
| Browser coexistence | Existing HTTP browser app remains functional alongside the native UI. |
| Project and editor navigation | Library, Project, Movie Studio, Settings, relevant editors, back/forward and reopening retain their current meaning. |
| API writes and authentication | Existing saves and errors work; browser Origin checks remain; no token enters MCP output; uncertain mutations are not retried. |
| Skills and updates | Existing CLI/skill commands update persisted state and the native UI via the current event API. |
| Coordination | Separate sessions and current engagement semantics; hidden/disconnected panels do not take over global context. |
| Media | Images, audio, waveform previews, video seeking/fullscreen, and real SPZ/WebGL load with acceptable measured behavior. |
| Files | Existing imports/uploads, supporting-file opens/downloads, and clipboard actions remain usable. |
| Appearance and storage | Existing screens, theme, layout and controls are retained; storage is scoped appropriately to each UI instance. |
| Lifecycle | Runtime restart/stopped-server errors, SDK disconnect, resource cancellation and panel reopen behave clearly without stopping Studio. |
| Desktop sizing | Verify actual split-panel widths and resize behavior; no mobile scope. |

## Documentation And Final Verification

Once the design passes acceptance, document it in
`docs/architecture/codex-studio-panels.md`, current CLI reference and sister plugin
docs. Record the exact host/version and browser/native distinction. Add an ADR
for the accepted presentation transport; no database migration or rewrite of
creative-skill instructions is required. Do not edit unrelated historical plans.

For this research revision, read the complete plan and diff and confirm only the
proposal changed. No production tests are warranted for this document-only work.
No automatic plan review or reviewer subagent is part of this task.

For implementation, run focused Studio/CLI tests while iterating, then:

```bash
pnpm build
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm test
pnpm check
```

Run the existing installed-product release verification when packaging changes.
Inspect the complete diff, diff statistics, new/large modules, thin indexes and
package boundaries. Preserve formatting. Actual native-host verification is a
separate requirement from browser E2E tests.

## Completion Checklist

### Research And Review Attention

- [x] Read relevant official extension/SDK/networking documentation and reference examples.
- [x] Inspect current CLI, UI, HTTP auth, event, routing and media ownership.
- [x] Distinguish observed host restrictions from documented API guarantees.
- [x] Verify the actual local Studio Library renders in Codex's browser panel.
- [x] Trace official link opening to the installed local-URL destination behavior; label the untested launcher transition.
- [x] Identify a native local-only design that retains every existing skill/CLI command.
- [x] Expose UI transport, packaging, media and platform adaptation as material scope.
- [ ] Accept the native transport direction and authorize dependency installation before implementation.

### Architecture And Contracts

- [ ] Use CLI-owned origin discovery, lifetime and installed private runtime.
- [ ] Add thin `renku studio mcp` and `@gorenku/studio/mcp` entrypoints.
- [ ] Register official global/thread metadata, `studio.open` and the HTML resource.
- [ ] Register app-only API transport with truthful read/write annotations for its implemented phase.
- [ ] Constrain transport to existing Studio HTTP API/media paths and keep tokens private.
- [ ] Keep HTTP route/Core domain ownership and structured diagnostics intact.
- [ ] Extract existing browser/token transport; update callers directly without compatibility shims.
- [ ] Preserve domain routes while separating embedded navigation mechanics.

### Native Proof And Implementation

- [ ] Render the existing React App in an actual installed native MCP tab.
- [ ] Specify and verify bundled static asset delivery and initial HTML size/startup; do not treat MCP resources as an automatically mounted website.
- [ ] Prove API reads and current event polling without sandbox-to-localhost network access.
- [ ] Measure representative image/video/SPZ transfer, playback, seeking, WebGL, memory and cancellation.
- [ ] Record native host evidence before broad conversion; do not count browser rendering as native proof.
- [ ] Complete existing write/upload flows and three direct screenplay fetch callers.
- [ ] Update all relevant media consumers through one source/lifetime owner.
- [ ] Complete route/session/focus/theme/storage behavior for the embedded environment.
- [ ] Specify and verify supporting-file/download, clipboard, file-input and fullscreen host actions.
- [ ] Package built assets/dependencies through the existing runtime and wire the sister plugin.

### Skills, CLI And User Behavior

- [ ] Keep skill procedures and domain CLI commands unchanged.
- [ ] Demonstrate a representative CLI mutation refreshing the native UI using isolated data.
- [ ] Retain every relevant existing Studio screen and workflow; no reduced replacement app.
- [ ] Verify ordinary browser/native coexistence and global current-context behavior.
- [ ] Preserve foreground startup and runtime lifetime independent of panel closure.
- [ ] Keep Urban Basilica inspection read-only and avoid unrelated data/file changes.

### Tests And Documentation

- [ ] Cover SDK protocol, discovery failures, response serialization and host capability failures.
- [ ] Cover path confinement, private token handling, rejected origins and mutation retry safety.
- [ ] Cover resource cleanup/cancellation and routing with representative UI journeys.
- [ ] Enforce stable import/capability boundaries rather than private implementation names.
- [ ] Complete the actual desktop acceptance matrix and installed-product verification.
- [ ] Document accepted setup, native/browser distinction, measured limitations and preserved skills.
- [ ] Record the accepted transport ADR; no schema migration or public hosting setup.

### Final Verification

- [ ] Run appropriate focused and root tests/checks after implementation.
- [ ] Inspect the full diff/statistics and every new or heavily modified large file.
- [ ] Confirm thin indexes, focused transport/media/route owners, and no broad domain dispatcher.
- [ ] Confirm no formatting churn, token leakage, security bypass or unrelated change.
- [ ] Confirm no required behavior was silently dropped to pass the native proof.
- [ ] Mark complete only after full native acceptance, not after the first slice.

## Cleanup And Planning Record

The previous handwritten proof server, iframe HTML, tests, README, plugin MCP
connection, and its five remaining processes were removed under the user's
explicit cleanup instruction. The original plugin manifest/installation was
restored. No populated Project data or unrelated skill work was removed.

This revision records the additional native transport research and verified
browser alternative in the same plan. It removes local HTTPS as the preferred
implementation dependency and corrects the assumption that UI transport would
require a skills/CLI migration. No replacement proof or production implementation
was created during this research.

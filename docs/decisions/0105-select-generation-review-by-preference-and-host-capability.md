# 0105 Select Generation Review By Preference And Host Capability

Date: 2026-10-02

Status: accepted

## Context

The packaged Codex generation review combines prompt, exact references and native
configuration. Visualize remains useful for comparison. A Codex model or MCP tool
registration does not establish that its hosting interface can render a panel:
Codex desktop and Codex CLI use the same MCP client identity.

The Studio sidebar launcher did not reliably open the local application. The
user explicitly removed it and rejected installing/trusting localhost certificates.

## Decision

The existing global Renku config owns optional `codexGenerationReview`, with
values `panel` and `visualize` and effective default `panel`. Core validates it
and returns it in `generation context` as
`workflowPolicy.codexGenerationReview`. New configs write the default; reading an
omitted setting does not rewrite the config. There is no Project setting, UI
toggle, schema migration or separate configuration-read command.

The independent optional global `codexGenerationReviewDisplayMode` accepts
`inline` and `fullscreen`, with effective default `inline`. Core validates it
with `CONFIG016` and returns `workflowPolicy.codexGenerationReviewDisplayMode`.
New configs write the default; existing configs need no rewrite. It applies only
to the packaged review. The resource reads current Core config on each read and
sets `openai/ui.preferredDisplayMode`, advertising both supported modes. The app
advertises the same modes and accepts the actual host mode without forcing a
fullscreen transition. Under the
[OpenAI display-mode contract](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#display-modes),
this preference is an initial hint; the host can choose or switch modes. Host
changes adjust layout without discarding drafts. Inline uses bounded height and
SDK size notifications; fullscreen fills the host viewport.

`generation.review.capabilities` reports the current initialized MCP client and
panel advertisement. Eligibility requires the exact current Codex client name
`codex-mcp-client` and `io.modelcontextprotocol/ui` advertising
`text/html;profile=mcp-app`. The opening tool enforces the same gate before any
request read. Tools remain discoverable on unsupported connections so their
presence cannot be mistaken for a UI capability. Advertisement is not proof of
rendering: the app additionally requires inline/fullscreen display and active-conversation
messaging through the official SDKs. No executable, environment variable or
model-name heuristic identifies the hosting interface.

Media Producer resolves one presentation path per review:

- Eligible Codex desktop with `panel`: Validate Engines requests, open the combined
  panel, yield, consume its exact Submit once, apply accepted edits, validate the
  revised file and execute using its hash. No automatic Studio Preview or
  Visualize. Submit is the review/confirmation handoff, including built-in images.
- Codex desktop with `visualize`: retain the Visualize configuration workflow,
  ADR 0091's cache, Project `displayPreview` and existing confirmation policy.
- CLI, Claude and other/unidentified interfaces: conversational configuration
  and mandatory Studio Preview, overriding Project `displayPreview: false`.

Known unsupported capability is an explicit Preview route. Failed panel opening
or handshake stops the selected panel workflow; it does not silently select a
different surface. A missing probe in trusted Codex desktop indicates an incomplete
connection and stops panel preparation. With no trusted desktop context or probe,
the host is unidentified. Mandatory Preview delivery failure also prevents execution.
An explicitly selected but unavailable Visualize Skill is reported rather than
silently replaced. Preference changes affect the next review.

Provider Skills still author native fields and translate accepted prompt edits.
Engines still validates and executes. Core still owns safe review reads, references
and focused attachment. The MCP runtime owns only ephemeral revisions and
consume-once actions. Built-in image generation remains a separately checked
capability. Preview CLI commands keep their explicit behavior; Skills select
when to invoke them. No generation execution becomes an MCP tool.

## Consequences

The Studio sidebar entrypoint, launcher resource and tool are removed. The plugin
ships only the isolated generation review HTML plus its local MCP runtime.
No certificates, certificate trust or embedded Studio application are introduced.
Existing Studio Preview/Inspection and Visualize support remain available.

Config, runtime and distributed Skills must ship together. Runtime protocol tests
verify current client/capability combinations and unsupported opening rejection.
Skill evaluations cover the host/preference matrix and exact handoff ordering.
Native desktop acceptance is recorded separately in plan 0220; protocol and
fixture tests do not establish live rendering in every harness.

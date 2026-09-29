# 0216 Reliable Generation Execution Handoff

Status: source implementation complete; full fresh-agent and desktop verification pending
Date: 2026-09-29

## Summary

Make the generation handoff reliable enough that the agent can execute the
reviewed request, display the returned media, review it, and attach it without
reconstructing provenance or fetching an already completed provider request.
Move mechanical file integrity and provenance serialization into the existing
CLI. Simplify the shared Skills around those guarantees and verify the actual
agent behavior across image, audio, and video workflows.

The recent video runs demonstrate that configuration, Preview, immediate media
display, complete context, and compact attachment output can work. They also
demonstrate that more instruction paragraphs alone have not made the handoff
reliable. This plan addresses the remaining failure without reducing creative
context or skipping review.

## Review Attention

The four implementation changes are: automatically save import-ready provenance;
check the prepared request inside Execute; return concise execution output; and
remove repeated discovery and mechanical preparation roundtrips in shared Skills.
The tests below protect existing configuration, cache, Preview, context, display,
and attachment behavior across media types.

- **Automatic new output file:** every successful `generation execute` and
  `generation recover` writes one import-ready `provenance-<uuid>.json` inside
  the requested output directory. It contains the existing exact provenance
  envelope, including the provider receipt. This removes agent serialization
  and unnecessary provider recovery from normal attachment.
- **CLI contract changes:** execute/recover default to concise readable output;
  `--json` retains the full result and adds `provenancePath`. Validate adds
  `requestSha256`. Execute accepts `--expected-request-sha256` to compare the
  exact file it loads before any provider work. The shared external-provider
  workflow uses this flag after preparation.
- **Failure behavior:** provenance assembly, validation, and write failures use
  structured diagnostics. A request hash mismatch stops before provider work.
  A failure to save provenance after provider completion must identify that
  generation already succeeded and identify available output paths; it must not
  suggest paying for another generation or embed a large receipt in an error.
- **Preserved:** full current briefing, current provenance schema and Inspector,
  creative judgment, provider validation, cache freshness rules, inline model
  controls, Studio Preview and prompt editing, existing confirmation policy,
  immediate media display, review before attachment, and compact import output.
- **No database migration, Settings change, UI redesign, data cleanup, or
  deletion of user files.** Existing runtime and Skills release ownership stays
  separate. Source verification is not installed-plugin verification.
- **Scope assumption:** the CLI guarantees apply to the existing Engines
  execute/recover commands for all registered providers. Codex image generation
  remains harness-owned; its review/attachment workflow is regression-tested
  without pretending that it runs through these commands. Location World keeps
  its separate existing execution path.
- The user accepted these four changes and authorized implementation.

## Requirement Ledger

| ID | Requirement and source | Owner and proof |
| --- | --- | --- |
| R1 | Remove avoidable post-generation delay and receipt reconstruction; user request and observed unnecessary Recover | CLI provenance file; direct Core import integration and agent trace |
| R2 | Reduce pre-execution roundtrips without executing stale Preview edits; user request and current Preview contract | CLI file equality check; provider-Skill changed-request path; mismatch tests |
| R3 | Preserve inline configuration, Studio Preview, confirmation, and immediate display; explicit user requirements | Shared Skills; visible desktop and agent acceptance checks |
| R4 | Use the implemented configuration cache; explicit user requirement | Existing Core cache and shared Skill; fresh/miss/expired route tests |
| R5 | Preserve necessary context across purposes; explicit user constraint against purpose-based pruning | Unchanged Core projection; existing coverage scorer and cross-purpose trials |
| R6 | Eliminate demonstrated redundant discovery and unchanged guide rereads without prescribing every tool call | Shared Skills; evidence-based redundant-call checks |
| R7 | Prove behavior with evals, not just prose or implementation-shaped tests; explicit user request | Studio Skills evals, real CLI fixtures, fresh agent trials |
| R8 | Preserve package ownership, opaque creative values, exact provenance, and structured failures; hard architecture rules | CLI serialization only, existing Core parsers/attachment and Engines execution; boundary tests |

## Context And Evidence

### Accepted owners and related work

Read alongside:

- `docs/architecture/media-generation.md` and its contract reference;
- `docs/architecture/media-model-library.md`;
- `docs/architecture/cli-performance.md`;
- `docs/architecture/coding-practices.md`, `naming-guidelines.md`, and
  `reference/structured-diagnostics.md`;
- decisions 0086, 0087, 0088, and 0041;
- plans 0213–0215 and their outstanding verification gates;
- sister `studio-skills/skills/media-producer/` and the five provider Skills.

0213 owns earlier startup and provider-loading improvements. 0214 owns the
generation-context provenance projection. 0215 owns consolidated readable
briefings and the already implemented compact `media import` follow-up. This
plan builds on those working-tree changes; it does not mark their outstanding
acceptance gates complete or rewrite their implementation history.

### Measured run evidence

Primary run: `codex://threads/01a0ee99-09db-7182-9e69-2413415a255f`,
**Generate H3 Max shot plan take**, The First Patron, Fal H3 Max image-to-video,
15 seconds at 480P. Comparison run:
`codex://threads/01a0ee80-951c-72e2-97d2-7f59df269f54`.

| Interval | Comparison run | Primary run | Interpretation |
| --- | ---: | ---: | --- |
| Initial request to configuration | 4m55s | 4m14s | Includes creative preparation and context; not a controlled benchmark |
| Accepted settings to Preview response | 43s | 39s | Request writing, validation, hashing, and Preview separated by tool/model gaps |
| Generate message to execution start | 17.2s | 22.0s | Still includes host and model latency; not 22 seconds of CLI computation |
| Execution command | 42.7s | 26.0s | Different requests; not evidence of a provider optimization |
| Result to first inline media display | 4.4s | 3.4s | Preserve this working behavior |
| Result to completed import | 30.2s | 75.7s | Primary run unnecessarily recovered the completed provider request |
| Completed import to final answer | 35.1s | 7.5s | Compact import output removed attachment rediscovery |

The primary run read the complete 2,480-line briefing after recovering clipped
pages. It correctly used a cache miss for a different route, rendered the inline
configuration, respected 480P, displayed the returned video before analysis,
and used compact import output without post-import queries.

Its successful Execute returned an untruncated result, including provenance,
but no file containing that provenance. Later it invoked Recover with the same
provider request id and a second output directory to obtain a serializable
receipt. That fetched/downloaded already completed work. Approximately 36
seconds elapsed between the unnecessary recovery tool call and completed import;
that interval includes other work and is not entirely provider recovery time.

Preparation also fetched a provider-filtered model list before fetching all
five indexes for configuration, and attempted to read a missing optional
personal guide. Large bundled guide reads caused clipping and rereads. These
are workflow inefficiencies, not grounds for dropping creative context.

The latest run proves neither fresh-cache reuse nor repeatable overall latency.
Earlier scenarios correctly invalidated changed catalog/template contracts or
used different routes. They must not be scored as failed cache hits.

### Existing implementation and chosen extension

- `generation/execute.ts` assembles artifacts and provenance only in its return
  value. `recover.ts` imports that assembly function from the execute handler.
  Neither saves provenance. Extend this existing composition, moving shared
  result assembly to a focused module used by both commands.
- `media-import-documents.ts` already reads a provenance JSON file through
  Core's `parseMediaGenerationProvenance`. Reuse it unchanged. The agent can pass
  the generated file directly to `media import --provenance`.
- `generation/request-file.ts` already reads the request once, calls Core
  envelope/safety validation, and resolves local markers. Compute the hash from
  those same source bytes, not from a second read or reserialized JSON.
- `generation/validate.ts` already validates the prepared request. Return its
  source hash with that result. Execute already delegates final native
  validation to Engines; the new equality check does not replace that.
- `generation/preview.ts` delivers existing Core previews. Preview edits only
  the top-level prompt; the agent/provider Skill must still rebuild native
  prompt-bearing values when that prompt changes.
- Model discovery intentionally returns an optional guide location without
  reading creative advice. Keep that boundary. Missing optional Markdown is
  ordinary absence, not a catalog error or a reason for wider discovery.

Keeping commands unchanged would still require the agent to capture and
serialize a potentially large response correctly every time; the observed run
failed that handoff. Extending existing command output and file loading solves
the mechanical problem without adding a new domain object or command family.

## Product Behavior

### Normal external-provider flow

1. Read the full current briefing and relevant available guidance. Obtain the
   complete effective model list once for this unchanged configuration workflow;
   derive selected-provider choices from that same result.
2. Inspect the existing cache for the exact selected route and dependency
   fingerprints. Reuse a fresh schema/template; materialize a fresh request
   payload into it. Preserve miss, invalid, incompatible, and expiry behavior.
3. Render the actual inline configuration and end the turn so the user can
   change settings. Reading the Visualize skill is not rendering a component.
4. After settings acceptance, author the review file and call Validate. Retain
   its `requestSha256`. If validation succeeds, show Studio Preview under the
   existing policy. Sequential dependent operations may share one tool
   invocation; do not require a model response between each mechanical step.
5. After required confirmation, call Execute directly with the retained hash.
   The CLI checks the loaded bytes before provider work. There is no separate
   shell hash call or unchanged-request revalidation command in this path.
6. Execute returns concise artifact information and the saved provenance path.
   Display the exact returned local media immediately, then review it using
   available capabilities. Keep the original command handle through polling.
7. Attach the reviewed result using its source path and saved provenance file.
   Use the compact import completion report for canonical paths and identities;
   finish without querying them again when already supplied.

The request-authoring, validation, and Preview sequence still has real failure
boundaries: stop on invalid input or failed Preview delivery. Batching removes
unnecessary agent decisions, not those checks. Host permissions remain external
to Renku and must still be satisfied.

### Changed requests and creative review

On `CLI_GENERATION_REQUEST_CHANGED`, no provider operation has run. Read the
changed request and apply current user direction through the selected provider
Skill. A Preview prompt edit requires updating the native request where that
provider's authoring workflow requires it. Validate the revised document and
retain its new hash. Follow the existing review/confirmation policy for the
revised request; do not introduce a new blanket approval rule.

Hash equality proves only that the review-file bytes are unchanged. It does not
claim immutable referenced media, current provider schema, consent, or creative
correctness. Engines and Core retain their existing responsibilities.

Keep one appropriate review pass. Video frame inspection, audio-stream presence,
and verified spoken content are different evidence. Do not claim speech or
continuity was verified from sampled frames alone. Do not add a transcription
installation or automatic regeneration to speed up or complete ordinary review.

## Architecture Shape Gate

Production changes remain in the existing CLI generation boundary:

```text
packages/cli/src/
  arguments.ts                         flag parsing and help
  commands/generation/
    command.ts                         thin dispatch and output selection
    request-file.ts                    one read, source hash, Core parsing
    validate.ts                        Engines validation and returned hash
    execute.ts                         hash precondition, execution composition
    recover.ts                         recovery composition
    execution-result.ts                typed report assembly and exact provenance file IO
    execution-output.ts                readable execute/recover presentation
```

`execution-result.ts` is the shared implementation owner, not a re-export or a
wrapper around `execute.ts`. It owns a command-local file output, not Project
metadata. Core remains the owner of provenance validation and durable attachment.
Engines remains the owner of provider transport, schemas, uploads and downloads.

Keep result assembly, file writing, and failure translation as focused functions.
The execute and recover handlers orchestrate those functions; neither interprets
creative contents. `command.ts` retains a bounded handler table. Select output
through typed handler metadata or a small command-output mapping rather than
adding a long command-path conditional chain. Context's existing text renderer
continues to work. No new `index.ts` is needed.

Skills changes live in the existing shared workflow and provider references;
purpose guides inherit the common handoff. Eval-only parsing/scoring lives in
the existing `evals/generation-context/` directory, not in runtime modules.

Stop and revise the slice if implementation requires provider/purpose branches
in the output writer, creative parsing, adapter-owned attachment rules, a broad
state mutation API, another generation workflow dispatcher, or a module mixing
command parsing, provider protocol, persistence, and rendering. Passing tests
does not excuse those shapes.

## Contracts

### Exact request comparison

- `generation validate --file <request> --json` adds `requestSha256`, a lowercase
  64-character SHA-256 hex digest of the exact UTF-8 file bytes read for that
  validation. Existing success fields remain.
- `generation execute --file <request> --output <directory>
  --expected-request-sha256 <digest>` compares against the same byte buffer it
  parses and executes. The flag is optional for direct CLI callers and used by
  the shared prepared-request workflow. It is not an authorization token.
- A malformed flag produces `CLI_GENERATION_REQUEST_HASH_INVALID`. A mismatch
  produces `CLI_GENERATION_REQUEST_CHANGED`, identifies the request file, and
  tells the caller to inspect/reprepare it. Both fail before provider context
  creation, schema requests, uploads, or submission.
- Whitespace-only edits also change this byte hash. No semantic normalization
  or prompt comparison is performed. Execute uses its loaded document rather
  than rereading a file after checking it.
- Validate and Execute remain separate processes; the digest is supplied by the
  caller. No pending request state is added to Renku.

### Saved provenance and execution presentation

For successful Execute and Recover:

- Assemble the existing safe provenance from the exact loaded review document
  plus returned receipt. Validate it through the existing Core parser. Preserve
  every opaque creative/native value and receipt field; do not reconstruct it
  from terminal text or from a mutable request reread after execution.
- Save exactly that provenance object as UTF-8 JSON, using a unique
  `provenance-<uuid>.json` filename inside the resolved `--output` directory.
  It must be directly consumable by existing `media import --provenance`.
  One file serves every artifact returned by that execution.
- Write a uniquely named temporary sibling with exclusive creation and
  restrictive permissions after Engines returns. Publish the complete JSON
  atomically. Keep final files distinct when an output
  directory is reused; never overwrite an earlier provenance file.
- Reuse `resolveOutputDirectory`'s existing Project-relative output boundary.
  Do not add a second CLI path-security policy or separate preflight file lifecycle.
- Return `provenancePath` as the absolute local path of the published file.
  The file is ordinary command output, not an Asset or a replacement for the
  provenance Core persists on attachment.
- Default readable output includes completion, optional provider request id,
  every artifact and its existing metadata, and `provenancePath`. It omits the
  long provenance body. Never clip the artifact collection or warnings.
- `--json` returns existing `requestId?`, `artifacts`, and `provenance`, plus
  `provenancePath`. Saving happens in either mode and before success output.
  A closed or clipped stdout consumer therefore cannot destroy the saved
  provenance. Structured consumers can still access the complete result.

Use default text for agent reading/display and direct attachment. Use `--json`
when code consumes fields. Neither choice requires a second execution or a
provider query. Ordinary attachment no longer needs Python or jq to extract or
rebuild provenance.

### Failure and recovery boundaries

- Provenance assembly and Core validation failures after provider completion
  report the known provider request id, every downloaded media path, and an
  instruction not to submit another generation. Keep Core validation codes,
  issues, and reasons; do not publish invalid provenance.
- `CLI_GENERATION_PROVENANCE_WRITE_FAILED` covers file-write/publication failures,
  with the failed path and actionable IO detail. State that the provider already
  completed, include its request id when present, and identify downloaded media.
  Preserve a complete unpublished temporary provenance file and identify its
  path when publication fails. Do not put the full result in diagnostic context.
- Do not emit success with a missing or partial published file. Never remove
  prior output or completed media. No automatic resubmission follows a write
  failure. Test failure after a successful provider return explicitly.
- Existing Engines failures retain their own diagnostics. Recovery remains for
  a known provider request whose local execution/download did not finish.
  Missing agent memory of a successful receipt is resolved from its saved local
  provenance, not by calling Recover or generating again.
- This guarantees provenance publication for successful command completion.
  It does not claim crash recovery from termination before Engines returns.

## Implementation Slices

### 1. Capture executable regression fixtures (R1, R7)

Extend CLI handler/integration fixtures with a successful multi-artifact result
and a large opaque receipt. Record the primary session's unnecessary recovery
sequence in the existing sister eval run evidence. Capture baseline invocation
counts and timings without copying private prompts into committed fixtures.

### 2. Implement the execution result handoff (R1, R8)

Extract report assembly from `execute.ts` into `execution-result.ts`; update
Execute and Recover directly. Add safe file preparation/publication and the
named diagnostics. Add `execution-output.ts` and bounded output routing in
`command.ts`. Keep Core attachment and provenance schema unchanged.

### 3. Implement prepared request comparison (R2, R8)

Extend `request-file.ts`, Validate output, argument parsing/help, and Execute
with the exact contracts above. Hash the loaded bytes once. Preserve native
provider validation and the existing unchanged-request document used to build
provenance. Do not add automatic provider-native prompt rewriting.

### 4. Simplify shared Skills and cross-purpose callers (R1–R6)

Update sister `skills/media-producer/SKILL.md`, `references/workflow.md`,
`references/inline-generation-configuration.md`, and
`references/shot-plan-video/workflow.md`:

- Replace agent-managed hash/serialization instructions with returned hash,
  Execute flag, and direct provenance-file handoff.
- Present one cohesive settings-to-Preview sequence, stopping at actual failures
  and user interaction boundaries. Remove contradictory unconditional rereads
  of an unchanged prepared document.
- Read the full effective route list once and reuse its catalog digest and
  choices. Resolve only selected advice. Treat missing optional advice as
  absence; do not initiate a search or repeat catalog discovery to repair it.
- Retain current bounded-read/full-coverage guidance without adding stricter
  pagination rules. A legitimately clipped guide may need its unread portion;
  a fully read unchanged guide does not need a second full read.
- Preserve immediate media presentation, command-handle polling, review, exact
  attachment, existing permissions, and fresh cache materialization.

Audit and update executable examples in Fal, Pika, Replicate, WaveSpeed, and
ElevenLabs provider Skills. Review purpose references for character sheets,
profiles, voice samples, Location sheets/Hero workflows, Prop sheets, Lookbook
images/sheets, Scene Storyboard sheets, Shot Plan reference images, image edits,
dialogue audio, and Shot Plan video. Change duplicated mechanical instructions
where present; keep creative guidance and purpose-specific import requirements.
Storyboard extraction continues to use its existing grouped import contract;
read saved provenance programmatically when building that existing document.

### 5. Run behavioral evals and record delivery evidence (R3–R7)

Extend `evals/generation-context/execution-handoff.mjs`, its script tests,
`forward-test-cases.md`, and the existing configuration/read-coverage evals.
Add trace normalization in `evals/generation-context/session-evidence.mjs` and
its focused test: extract only visible command/tool arguments, outputs, exit
codes, displayed media, user continuations, and timestamps. Exclude hidden
reasoning and embedded image bytes. Keep raw private sessions local.

Run the fresh agent acceptance scenarios below after verifying the actual CLI
build and loaded Skill contents. Record source revisions, working-tree hashes,
loaded Skill hashes, cache state, output files, and evidence links in a dated
run record. Static tests, synthetic traces, and operator-led CLI tests do not
count as autonomous agent trials.

## Tests And Guardrails

### CLI owner tests

- Saved provenance equals returned provenance exactly and imports through the
  existing Core parser; long/multiline/Unicode values and nested receipts survive.
- Execute and Recover each delegate once; both output modes publish first.
  Optional request id, several artifacts, image/audio/video metadata, and empty
  optional fields retain their meaning.
- Two successful calls using the same directory retain distinct provenance
  files. Existing files remain untouched; existing output-path checks still apply.
- Inject write and publication failure
  after provider success and assert accurate concise diagnostics,
  preserved media, and zero automatic provider retries.
- Lost stdout after publication leaves the complete file available. JSON remains
  complete; readable output exposes artifact paths without long recipe echo.
- Validate's digest is of its loaded bytes. Matching Execute calls Engines once;
  invalid/mismatching digest calls it zero times. A file edit after the check
  cannot change the loaded document passed to Engines or saved provenance.
- Unchanged-request execution still performs Engines validation. Changed prompt,
  reference, configuration, and whitespace fixtures take the mismatch path.

Cover these at the CLI owner; do not repeat the entire matrix in Core or Studio.
Use existing complexity/import-boundary enforcement. Do not add tests that
freeze private helper names or enumerate every handler's implementation name.

### Representative integration journeys

Use existing injected Engines seams and isolated Project fixtures, without paid
requests, to execute → save provenance → import → inspect stored provenance.
Prove original source media and saved provenance are used, with no Recover call.
Include a large receipt and one grouped Storyboard attachment using its current
import shape. Reuse existing Core ownership validation rather than duplicating
its invalid-target matrix.

### Skill behavior and actual agent acceptance

| Scenario | Required evidence |
| --- | --- |
| Video, exact route with fresh cache | Uses stored schema/template; zero configuration schema fetches or template regeneration; new request payload and actual inline rendering |
| Same route with expired cache | One configuration refresh; reuse unchanged template, rebuild changed schema; no stale-on-error |
| Different route | Correct miss/new preparation; never reuse incompatible controls |
| Unchanged prepared video | One Execute with expected hash, no shell hash/extra Validate, no Recover after success; early playback, review, direct saved-provenance import |
| Preview prompt edit | Stops stale execution; provider Skill updates native request, validates revised document, preserves user direction |
| External image and audio | Same output/attachment handoff; full context and relevant review preserved |
| Codex character sheet | Harness generation, full context, Preview policy and exact attachment still work without Engines execution flags |
| Large briefing and missing optional guide | Complete visible briefing coverage; no repair loop for absent advice; no successful unchanged guide reread |
| Interrupted provider/download | Poll original handle; use known-request Recover only when justified; never duplicate generation |

Synthetic traces must include failing variants, particularly a successful
Execute followed by unnecessary Recover, a fresh template reused with an old
payload, omitted inline rendering, and skipped briefing ranges. Score behavior
and evidence, not exact wording or the number of incidental local file reads.

Run at least two fresh agent trials for the ordinary cached video path and one
each for changed Preview prompt, external image, and external audio. Use
controlled provider results for repeatability and exercise actual CLI
serialization/attachment in the paired integration tests. Also perform one
desktop end-to-end media run against the real project under existing generation
policy, verifying inline controls, Preview, first media display, attachment and
Inspector. A fixture replay is not live provider verification. If independent
agent or live verification cannot be run, leave that gate explicitly open.

### Performance acceptance

Hard acceptance is removal of specific waste: zero receipt-only Recover calls,
zero provenance extraction commands in ordinary imports, zero post-import
rediscovery when completion supplied the fields, and zero duplicate catalog
fetches for unchanged configuration. A fresh cache must be genuinely observed.

Measure separate intervals for settings-to-Preview, confirmation-to-first-tool,
tool scheduling, CLI execution, provider polling/download, first media display,
review, import, and final response. Use the existing `renku.performance`
instrumentation for owned phases; do not sum overlapping timers or label all
execution time provider inference.

Targets in controlled warmed runs: confirmation's first tool invocation executes
directly; hash/file-publication overhead below 100 ms median across ten local
fixtures; no model turn between successful validation and Preview delivery;
media display within 5 seconds of observed result; final response within 10
seconds of import. Record misses and their cause rather than silently relaxing
targets. Real host scheduling and creative analysis remain measured separately;
the CLI cannot guarantee a few-second end-to-end conversational response.

## Documentation

Update `docs/cli/commands.md`, `docs/architecture/media-generation.md`,
`docs/architecture/cli-performance.md`, and the structured diagnostics reference
for the accepted contracts and measured limits. Update current sister Skill
examples and eval records in the same implementation slice. No domain ownership
decision changes, so no new ADR or rewrite of historical ADRs is planned.

## Final Verification

Run suites sequentially because existing integration fixtures share cleanup:

```bash
pnpm build:cli
pnpm test:cli
pnpm --filter @gorenku/studio-cli test:integration
pnpm test:engines
pnpm check
```

In `studio-skills`, run `pnpm test:media-generation`. Run the independent agent
and desktop scenarios separately and retain evidence. No dependency installation
is required. Verify which CLI executable and Skill revision each trial actually
uses; do not edit installed plugin caches to make a source test appear deployed.
Follow each repository's existing release/install workflow when delivery is
authorized, and distinguish source-passed from installed-verified in the handoff.

Inspect the complete diff, `git diff --stat`, large changed modules, handler
complexity, and thin entrypoints. Preserve unrelated working-tree changes and
existing formatting. Inspect the final saved provenance through the ordinary
Inspector rather than inferring durable correctness from CLI stdout alone.

## Completion Checklist

### Review and architecture

- [x] Accept the named output file, default presentation, hash field/flag, and diagnostics.
- [x] Preserve full context, creative opacity, existing policy and cache semantics.
- [x] Keep CLI output IO separate from Core durable attachment and Engines protocol.
- [x] Match the Architecture Shape Gate with focused handlers and bounded output routing.
- [x] Confirm no broad dispatcher, catch-all module, compatibility alias, or god file.

### CLI implementation

- [x] Save exact provenance for Execute and Recover before either success output mode.
- [x] Preserve distinct files, existing path checks, atomic publication and completed media on failure.
- [x] Emit complete JSON and readable artifact/provenance-path output.
- [x] Return Validate's exact source hash and support Execute's named precondition flag.
- [x] Reject malformed/stale hashes before provider work; retain Engines validation.
- [x] Identify completed media and retained temporary provenance on write failure without large error payloads.
- [x] Keep existing import/provenance and Inspector contracts unchanged.

### Skills and user surfaces

- [x] Replace shell hashing and ordinary provenance extraction with CLI handoff.
- [x] Consolidate settings-to-Preview operations without crossing user review boundaries.
- [x] Reuse one complete catalog result; handle absent optional advice without repair loops.
- [x] Keep actual inline configuration, settings continuation, Preview and early media display.
- [x] Audit all five provider Skills and the named image/audio/video purpose references.
- [x] Preserve Codex and Storyboard-specific execution/import paths.
- [x] Keep complete briefing coverage without adding purpose-based pruning.

### Tests and evals

- [x] Pass exact serialization, output-mode, multi-artifact and import integration tests.
- [x] Pass write-failure, existing output-path, distinct-file and closed-output tests at the CLI owner.
- [x] Report completed work on Core provenance validation failure; cover Execute/readable and Recover/JSON with preserved media and no provider retries.
- [x] Pass matching/changed-file tests and verify zero provider work on mismatch.
- [x] Extend behavior scorers and visible-session extraction with positive/negative evidence.
- [ ] Run two independent fresh-cache video trials and changed-prompt/image/audio trials.
- [x] Prove fresh/expired/different-route cache behavior and new payload materialization.
- [ ] Verify Codex character-sheet behavior and full briefing coverage.
- [ ] Verify justified interrupted-request recovery without duplicate generation.
- [ ] Complete desktop playback, Preview, attachment and Inspector verification.
- [ ] Record phase timings, redundant-call counts, source/loaded versions and limitations.

### Documentation and final verification

- [x] Update named CLI/architecture/diagnostic docs and current Skill examples.
- [x] Run the listed build, tests and checks sequentially without installing dependencies.
- [x] Distinguish source tests, controlled agent trials and installed/live verification.
- [x] Inspect complete diff/stat, large files, thin entrypoints and formatting preservation.
- [x] Confirm no completion item relies on accepting unreviewable code structure.
- [ ] Mark complete only after required behavioral gates pass; record any blocked gate plainly.

## Planning Verification

Completed one bounded author consistency/simplification pass against the
requirement ledger, current command contracts, template, and working-tree scope.
No automatic plan review ran. The user subsequently accepted the simplified four
changes above and authorized implementation.

## Implementation Evidence — 2026-09-29

The four source changes are implemented. CLI output serialization and the
request-byte comparison contain no provider/model-specific branches. Core,
Engines provider code, schemas, caching policy, and Studio UI are unchanged.
All five provider Skills and shared/purpose-specific examples use the handoff.

Passed: CLI build; root `pnpm check`; 120 CLI unit tests followed by the expanded
six-case execution-result suite; 37 integration tests followed by the extended
handoff test; 85 Engines tests; nine Core cache tests; 57 Skill tests and current
route/purpose validators. The integration proves saved-file import and Inspector
provenance, stale Preview-edit rejection, revised-request execution, and saved
provenance surviving a closed output consumer. No receipt-only Recover occurs.

An independent preparation-only agent evaluation chose the intended execution,
attachment and cache paths. It exposed contradictory reread/discovery wording,
which was corrected. It did not execute generation or render a new configuration.
The remaining full fresh-agent, Codex generation and desktop checks above remain
open; no installed-plugin or end-to-end latency success is claimed.

Warmed hash plus provenance serialization/publication: ten runs, median 0.430 ms,
range 0.385–0.530 ms. This excludes startup, provider, model and host delays.
Detailed evidence and source hashes are in sister Skills
`skills/media-producer/evals/generation-context/runs/2026-09-29-cli-provenance-handoff.md`.
No release, plugin installation, paid generation, migration or user-file cleanup
was performed. The unrelated existing Studio console warning remains.

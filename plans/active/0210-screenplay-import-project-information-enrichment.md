# 0210 Screenplay Import Project Information Enrichment

Status: implemented
Date: 2026-09-27

## Review Attention

- **Requested behavior:** An agent-guided screenplay import should draft missing Project logline, synopsis, and premise from the imported script. It may replace a value that is clearly temporary or unfinished, but should preserve substantive authored text field by field.
- **Scope interpretation:** The visible story fields are the primary target. The agent may correct a clearly temporary Project title only when the supplied script has an explicit, unambiguous title. Aspect ratio and Project language remain user-selected production settings; screenplay content alone does not determine them.
- **Additional behavior needed for a reliable retry:** The Project Information pass also runs when an explicit `import-fdx` returns `unchanged`. This fills fields left empty after an earlier interrupted run without changing the Screenplay.
- **Contracts and side effects:** Reuse `renku info show --json` and `renku info set`; no new CLI command, flag, Core service, route, schema, Settings option, diagnostic, or database migration. Successful enrichment writes only the selected existing Project Information fields and triggers the existing Studio refresh event.
- **Preserved behavior:** FDX import remains a deterministic, source-authoritative Screenplay operation. Detected external FDX exports still require Studio review. The importer still creates no Cast, Location, Prop, analysis, or other creative artifacts.
- **Approval point:** This plan assumes “other fields here” means the logline, synopsis, and premise, with the limited title case above. Automatic changes to aspect ratio, Project language, or additional Project development fields would be a separate product choice.

## Summary

The Big Fish Project shown in Studio has an imported Screenplay and a valid title, but its Project logline, synopsis, and premise are empty. The current `screenplay-drafter` skill imports the FDX and hands candidate facts to `movie-director`; it does not write these Project story fields. Add one agent-owned Project Information pass after a successful explicit import. The agent reads the accepted canonical screenplay, drafts the three fields, compares them with the current Project values, writes only missing or clearly placeholder fields, and verifies the result.

## Requirement Ledger And Product Behavior

| Source | Required outcome | Owner and verification |
| --- | --- | --- |
| User request | Fill the logline, synopsis, and premise as part of agent-guided script import. | `screenplay-drafter` import workflow; skill eval with an empty Project Information state. |
| User request | Preserve already meaningful values; allow the intelligent agent to replace obvious placeholders or unfinished notes. | Agent's field-by-field judgment; skill eval with mixed meaningful and placeholder values. |
| User request and visible Project Info surface | Keep a meaningful Project title. Use an explicit script title only if the current title is clearly temporary. | `screenplay-drafter`; eval with substantive and temporary titles. |
| Current architecture | Store Project story metadata on Project through the existing Core-owned command, separate from FDX-backed Screenplay content. | Existing `renku info show/set` and Core patch boundary; readback verification. |
| Current FDX source rule | Do not turn the deterministic importer or detected Studio update flow into an AI-writing path. | Skill instructions and regression eval. |
| Operational recovery | If import succeeded but the Project Information write did not, an explicit retry can finish the metadata pass even when import reports `unchanged`. | Skill eval for the interrupted/retried path. |

For each field independently:

1. After an `imported`, `refreshed`, or `unchanged` result from an **explicit, agent-guided** `renku screenplay import-fdx`, read the canonical Screenplay and `renku info show --project <project-name> --json`.
2. Read enough of the complete script to understand its beginning, central conflict, major turns, and ending. For a long script, work through it in bounded portions and consolidate notes before drafting. Do not write a confident plot summary from only the first scenes, a filename, the FDX title page, or outside knowledge of a familiar film. If the script cannot be read sufficiently, leave the fields alone and report why.
3. Draft a concise one-sentence story hook for `logline`, a coherent plot account for `synopsis`, and the central dramatic proposition for `premise`. Keep these distinct; do not copy one text into all three fields. The agent can use the user's supplied story brief to resolve ambiguity, but the imported script is the authority for what its story contains.
4. Treat null, absent, empty, or whitespace-only values as missing. Treat unmistakable working text such as `TBD`, `TODO`, `placeholder`, or an explicitly unfinished note as replaceable by judgment, not by a Core or CLI keyword list. A short but meaningful sentence is substantive. When quality is ambiguous, preserve it and mention the possible improvement rather than silently replacing it. Substantive text that disagrees with the imported script also remains untouched; report the discrepancy for the user.
5. Inspect the supplied FDX title page only if the current Project title is clearly temporary. Use a source-authored, unambiguous title if available. Do not infer a title from the filename, slug, character name, or story topic. Leave aspect ratio and Project language unchanged.
6. Re-read Project Information immediately before writing; omit any field that became substantive since the initial read. Send one `renku info set --project <project-name> ... --json` containing only the chosen fields. If none qualify, do not issue a mutation. Read back `renku info show --json` and tell the user which fields were filled, which were preserved, and which could not be drafted.

This workflow does not change bare CLI imports run without the skill, nor Studio's independently detected export flow. A failed FDX import does not start enrichment. If FDX import succeeds and the later Project Information write fails, report that partial outcome precisely; do not re-import just to retry the metadata write.

## Context And Evidence

- `docs/architecture/data-model-and-storage.md` makes Project the direct owner of title, logline, synopsis, and premise; Screenplay storage does not mirror them.
- `docs/architecture/screenplay-fdx-import.md` and ADR 0093 keep the FDX importer deterministic and source-authoritative, and keep detected Studio updates behind review. Agent-written Project Information is a separate post-import action.
- `packages/cli/src/commands/project-information-command.ts` already implements `info show`, `info set`, and JSON output for all proposed fields. `info set` calls `createProjectDataService().patchProjectInformation` and emits existing Studio refresh/focus events. `packages/core/src/server/project-information/patch-command.ts` validates and persists the patch inside Core. `docs/cli/commands.md` documents these commands.
- `packages/studio/src/features/movie-studio/project-information/project-information-panel.tsx` consumes Project Information and refresh events; no Project Info UI change is needed.
- `studio-skills/skills/screenplay-drafter/SKILL.md` currently handles `imported` and `refreshed` by reading back the Screenplay, but says `unchanged` has no follow-up mutation. Its FDX path then gathers candidate Cast/Location/Prop evidence for `movie-director`. `references/screenplay-json-workflow.md` documents the same import path. `evals/fdx-import-enrichment.md` tests fact enrichment but not Project story fields.
- The local Big Fish Project database has one Screenplay import record, `title = Big Fish`, and null logline, synopsis, and premise, matching the supplied screenshot. The populated Urban Basilica Project has substantive values for all three fields and provides a preservation example. These are read-only evidence; implementation verification must use an isolated test Project rather than writing to either real Project.
- Completed plans 0168 and 0170 established the FDX importer and Core-owned Project Information patching. Plans 0178 and 0198 and ADR 0093 constrain refresh/review behavior; this proposal does not reopen them.

## Architecture Shape Gate

This is a **skill-only change**. No production TypeScript module is proposed.

- Agent workflow owner: `studio-skills/skills/screenplay-drafter/SKILL.md`, with command-order detail in `references/screenplay-json-workflow.md`.
- Durable mutation entrypoint: existing `renku info set`; read entrypoint: existing `renku info show --json`. The skill never edits SQLite, Project files, or an FDX-backed Screenplay directly.
- Creative judgment stays in the agent. Core retains only its present structural Project Information validation and persistence. Do not add placeholder scoring, story summarization, or source-text interpretation to Core, CLI, Studio routes, or React.
- The skill's import section should stay a focused sequence, not become a generic metadata framework or a second import coordinator. `movie-director` keeps ownership of enabled downstream stages. No new registry, dispatcher, `index.ts`, or public API is needed.
- Stop and revise the plan before implementation if a missing command is demonstrated, if the change starts requiring runtime semantic rules, if the detected Studio update path is being altered, or if the skill begins mutating unrelated Project development fields.

## Contracts And Chosen Approach

The three options are: (1) reuse the existing Project Information CLI unchanged, (2) extend its Core/CLI contract, or (3) introduce a new screenplay-import metadata concept. Option 1 covers the current request. A new command or automatic Core import side effect would mix deterministic source ingestion with creative writing, and a new persisted metadata object would duplicate Project's existing fields.

The public commands remain:

```text
renku screenplay import-fdx --file <absolute-fdx-path> --json
renku screenplay show --json
renku info show --project <project-name> --json
renku info set --project <project-name> [--title <text>] [--logline <text>] [--synopsis <text>] [--premise <text>] --json
```

The optional `--title` appears only when the title rule qualifies. No new result field, diagnostic code, or versioned skill document is introduced. No `info clear` call is part of enrichment.

## Implementation Slices

1. **Skill workflow:** Update `studio-skills/skills/screenplay-drafter/SKILL.md` to run the Project Information pass after explicit FDX import and before returning evidence to `movie-director`. Replace the current blanket `unchanged` instruction with “no Screenplay/fact mutation, but finish missing Project Information.” State the field judgment, readback, partial-failure, and preservation rules above.
2. **Command reference:** Update `studio-skills/skills/screenplay-drafter/references/screenplay-json-workflow.md` with the exact `info show/set` order and one-field-or-multi-field patch example. Keep FDX candidate fact and detected-export guidance intact.
3. **Skill evaluation:** Extend `studio-skills/skills/screenplay-drafter/evals/fdx-import-enrichment.md` with Project Information cases: all three empty; mixed empty, meaningful, and obvious placeholders; meaningful but stale text; `unchanged` retry; failed import; and a long source that cannot be summarized from its opening alone. Assert no alteration of aspect ratio or Project language and no new automatic downstream stages.
4. **Accepted documentation:** Add one concise paragraph to `docs/architecture/screenplay-fdx-import.md` clarifying that agent-guided Project Information enrichment is a separate post-import skill action using existing Project commands. The importer itself remains deterministic. No CLI reference change or ADR is required because their contracts do not change.

## Tests And Guardrails

- Manually exercise the updated skill/eval scenarios using an isolated Project or simulated command responses. Check exact field selection and generated writing quality against the complete supplied Screenplay; a phrase-matching test cannot prove that the summary is faithful.
- Verify one combined `info set` call writes only qualifying fields, and an all-substantive state makes no mutation. Verify `info show` readback and the existing Studio refresh path in an isolated local run if practical.
- Confirm an `unchanged` Screenplay import can finish previously missing metadata without changing the Screenplay; a failed import cannot start enrichment.
- Review the skill diff for accidental changes to Cast/Location/Prop handoff, FDX source authority, detected-export review, or downstream stage dispatch.
- No new Core, CLI, or UI test matrix is planned because those contracts are unchanged. Existing Project Information and FDX importer tests continue to protect their owning boundaries.

## Documentation

The two `screenplay-drafter` files and its eval are the agent-facing contract. The architecture reference receives only the post-import ownership clarification. Existing CLI documentation stays accurate. The implementation handoff should mention that this behavior requires an agent running the skill; a direct CLI or Studio import alone still performs deterministic ingestion.

## Final Verification

1. Reread the modified skill and workflow reference end to end, then walk the eval scenarios with empty, mixed, substantive, and retry states.
2. Use an isolated test Project for any actual `import-fdx` or `info set` run. Read Big Fish and Urban Basilica only to compare expected empty and populated states; do not modify them during plan implementation verification.
3. If production code remains untouched, run the studio-skills repository's existing checks only when they cover modified files; otherwise use the documented manual skill eval. Do not add a Core test merely to mirror skill prose.
4. Inspect `git diff --stat` and complete diffs in both repositories. Confirm no formatting churn, new command/route/schema, changed importer, broad dispatcher, or large unrelated skill section; no `index.ts` is changed. Confirm the Project Information mutation still enters through Core's existing command.

## Implementation Record

Implemented on 2026-09-27 in the sister `studio-skills` repository's
`screenplay-drafter` skill, workflow reference, and FDX import eval. The Studio
repository's FDX architecture reference now states the post-import ownership
boundary. No production code or CLI contract changed.

Verification: `pnpm test` passed in `studio-skills`; `git diff --check` passed
in both repositories. A read-only `renku info show --project big-fish --json`
confirmed the current title, aspect ratio, and language are present while the
three story fields are absent. The eight skill eval cases were walked against
the final instructions using simulated outcomes. No automated agent eval runner
exists for this creative workflow, and no real Project data was mutated.

## Completion Checklist

### Review Area

- [x] Confirm the scope interpretation for title versus narrative fields and keep aspect ratio and Project language unchanged.
- [x] Confirm every new step maps to the requirement ledger and no adjacent FDX or downstream workflow was redesigned.
- [x] Confirm the final skill text is focused and reviewable, with no broad enrichment framework.

### Architecture And Contracts

- [x] Reuse `renku info show/set` and Core-owned Project Information patching without new CLI, API, schema, Settings, or diagnostic contracts.
- [x] Keep source-authoritative FDX import and detected Studio update review unchanged.
- [x] Keep placeholder and creative-quality judgment in the agent, never Studio runtime code.

### Implementation Slices

- [x] Add the field-by-field Project Information pass to the `screenplay-drafter` FDX import path.
- [x] Read the complete canonical story sufficiently before writing logline, synopsis, and premise; preserve substantive current text.
- [x] Handle a clearly temporary title only when the supplied FDX states an unambiguous title.
- [x] Recheck Project Information before one selective `info set`, skip mutation when no field qualifies, and verify by readback.
- [x] Let `unchanged` finish missing metadata; report import-success/metadata-failure separately and avoid enrichment after failed import.
- [x] Preserve the existing Cast/Location/Prop evidence handoff to `movie-director`.
- [x] Update the screenplay JSON workflow reference with exact CLI order and flags.

### Tests And Guardrails

- [x] Extend the FDX import skill eval with empty, mixed, placeholder, substantive, retry, failure, and long-script cases.
- [x] Check that aspect ratio, language, and nonqualifying Project fields are never written.
- [x] Check that explicit agent-guided import gets enrichment while direct CLI and detected Studio updates retain their current contract.
- [x] Verify representative behavior with an isolated Project or simulated CLI responses; do not mutate Big Fish or Urban Basilica.

### Documentation

- [x] Clarify post-import agent ownership in the accepted FDX architecture reference.
- [x] Confirm CLI docs remain accurate and no ADR change is needed.

### Final Verification

- [x] Reread all changed guidance and run the relevant skill eval walkthrough.
- [x] Inspect `git diff --stat` and complete diffs in both repositories; remove formatting churn.
- [x] Inspect heavily modified files, confirm no `index.ts` expansion or catch-all module, and confirm no checklist item depends on unreviewable structure.
- [x] Mark the plan complete only after the skill, reference, eval, and documentation changes pass the checks above.

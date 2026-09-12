# Parallel Worktrees With Linear Main

Date: 2026-09-11
Status: recommended workflow; automation skills described below are not installed

## Recommendation

Keep GitHub and a linear `main`. Give each independent implementation task a
short-lived `codex/<task>` branch in its own worktree. Use one integration agent
to land completed tasks, one at a time, as squash commits. Pull requests are
optional; they are not required for this single-developer workflow.

You decide what to build and which tasks may land. Agents prepare commits,
resolve routine conflicts, review the combined result, run checks, and push when
authorized. They ask for a product decision only when the two changes express
incompatible intent. A clean text merge is not proof that the changes work
together.

Example history after two tasks land:

```text
main:  A -- B -- C -- D
                  |    |
                  |    one tested squash commit for task two
                  one tested squash commit for task one
```

Task branches are implementation bookkeeping. You do not need long-lived
feature branches, merge commits, a develop branch, or mandatory PR ceremonies.

## Relationship To Plan 0199

[Plan 0199](../../plans/active/0199-isolated-worktree-testing-with-ephemeral-projects.md)
defines isolated servers, fixture projects, and safe test cleanup. This document
defines how code from those environments reaches `main`.

The plan remains proposed. Its `pnpm studio:test` and `pnpm renku:test` commands
are not available merely because this guide mentions them. Until its isolation
and cleanup corrections are implemented, serialize filesystem-heavy and browser
verification across worktrees; existing fixed test ports and global temporary
cleanup can interfere. Agents can edit independent code concurrently, but must
not claim fully isolated concurrent verification yet.

## Three Responsibilities

| Responsibility | Owns | Must not do |
| --- | --- | --- |
| Primary checkout | Your manual Studio session, local `main`, release commands | Be switched, cleaned, or updated under an active personal session by a worker |
| Task agent | One task branch, its code, focused tests, completion handoff | Push `main`, edit another task's worktree, or silently expand shared contracts |
| Integration agent | Ordered landing queue, candidate worktree, combined review/tests, authorized push | Integrate moving task tips, force-push, or publish a candidate whose base changed after verification |

Only one integration agent may publish to `main`. Workers may run concurrently;
integration is serial. Keep the queue in that agent's task conversation initially:
task branch, frozen commit, scope, prerequisite task if any, and landing status.
No queue database, daemon, or scheduled automation is required.

## 1. Start An Independent Task

Fetch `origin/main`, inspect the worktree inventory, and create a unique branch
and directory from the fetched commit. Record that base commit in the task
conversation. Do not reuse a branch or folder owned by another active task.

Example commands, with task names and paths chosen for the actual task:

```bash
git fetch origin
git worktree list
git worktree add -b codex/location-inspector ../studio-location-inspector origin/main
```

If the primary checkout contains unpublished commits or uncommitted work needed
by the task, identify that dependency before branching. Do not silently copy
those files into the new task or assume `origin/main` includes them.

Prefer independent tasks. If task B changes an API introduced by task A, land A
first and start B from the updated `origin/main`. Avoid stacked task branches
initially: squash landing does not preserve the source branch's ancestry, which
makes later dependent-branch integration less straightforward.

Each worktree has its own workspace package links and generated outputs. Reuse
pnpm's package store, not another checkout's whole `node_modules` directory or
its `dist`/`server-dist` outputs.

Dependency provisioning requires the installation authorization in `AGENTS.md`.
When authorized, use the pinned pnpm and `pnpm install --frozen-lockfile` for an
unchanged dependency graph. This does not authorize dependency updates, build
allowlist changes, registry changes, or lowering the release-age policy. Missing
dependencies are a setup prerequisite, not permission to use `npx` or another
package manager to bypass the policy.

## 2. Implement And Hand Off

The worker follows the task scope and repository architecture rules, makes
focused commits, and runs the relevant checks. It may commit several times;
the integration agent will create one coherent commit for `main`.

Before handing off, the worker stops editing and supplies:

- task branch, worktree path, base commit, and final commit hash;
- intended behavior and boundaries that must remain unchanged;
- commands run, their results, and any verification limitations;
- dependency, schema, public API, or sister-skill changes;
- expected overlap with other tasks and any prerequisite task;
- confirmation that all intended changes are committed and the worktree is clean.

Use exact commit hashes for the handoff. A branch name alone is a moving target.
If the worker must continue, it sends a replacement handoff; the earlier review
and test evidence does not cover its new changes.

## 3. Prepare One Landing Candidate

The integration agent freezes the next handoff and fetches the latest
`origin/main`. It records that commit as the candidate base, then creates a
separate candidate worktree. It never performs integration in your primary
checkout or in the worker's directory.

```bash
git fetch origin
git worktree add -b codex/integrate-location-inspector ../studio-integrate-location-inspector origin/main
```

Inside the candidate worktree, inspect the worker's change relative to its
recorded base and the changes that landed on `main` since that base. Check that
the task contains only the promised work before applying it:

```bash
git merge --squash <frozen-task-commit>
```

This prepares the merged result without creating a merge commit. Resolve
conflicts, inspect the complete staged diff against the candidate base, stage
only intended paths, and create one commit describing the resulting behavior.
The commit body records the source task commit and candidate base for traceability.
Do not describe intermediate fixes or discarded approaches as the final feature.

Git's [squash merge contract](https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---squash)
preserves the combined file changes without recording merge ancestry. Retire the
task branch after landing; do not keep adding work to it and squash it repeatedly.
Start subsequent work from the new `main`.

### Conflict Handling

| Conflict | Agent action |
| --- | --- |
| Imports, adjacent edits, or renamed callers | Reconstruct both intended changes, preserve the owning package, resolve, and test the affected behavior |
| Two changes to a public contract | Update the integrated callers consistently when both requirements are compatible; ask only if the intended behavior conflicts |
| Dependency manifest or lockfile | Inspect source/version and policy changes before installing; do not use blanket ours/theirs or regenerate the lockfile without dependency-operation authorization |
| Drizzle migrations or journal | Do not hand-merge generated SQL or rewrite shipped history; use the accepted Drizzle workflow against the current integrated schema and prove the combined upgrade path |
| Product requirements contradict each other | Explain the concrete alternatives and pause this task; another independent queued task can proceed |

Check semantic overlap even when Git reports no conflict. For example, one task
can rename a Core command while another adds a caller in a different file, or
two individually valid migrations can produce an invalid combined history.

If abandoning a conflicted candidate, preserve it for inspection and start a
new uniquely named candidate if needed. Do not assume `git merge --abort` will
undo a squash merge, and do not use a destructive reset or delete the worktree
without the explicit authorization required by `AGENTS.md`.

## 4. Review And Test The Combined Commit

Run checks on the candidate that will actually land, not just on the original
task branch. The integration agent reviews the full candidate diff for
correctness, architecture boundaries, scope, and accidental formatting changes.

For production-code changes, use the existing gates:

```bash
pnpm build
pnpm test:final
```

`test:final` runs `check`, unit tests, integration tests, and Studio browser smoke.
Add focused onboarding, migration, browser regression, or desktop checks when
the changed behavior requires them. Do not repeat every domain edge matrix at
all layers. Documentation-only changes need link, content, and diff checks,
not a full product build.

For a named architecture review, the existing
[`renku-code-quality-review` skill](../../.agents/skills/renku-code-quality-review/SKILL.md)
can inspect the exact candidate diff. It complements correctness review; it does
not replace it. An independent reviewer agent can be requested explicitly, but
the integrator remains responsible for the final outcome and test evidence.

Record the candidate commit, base commit, checks, and review result in the
integration conversation. Verify tracked files and the index remain clean after
testing. Any subsequent source fix changes the candidate: commit it and rerun
the affected checks before claiming that candidate is verified. Do not bypass
failing checks to get the queue moving.

## 5. Publish Without Changing Your Primary Checkout

Only publish when the user has authorized integration and push for this task or
the named queue. A request to prepare or review a candidate alone is not push
authorization. When authorization already covers landing, routine successful
merges do not require another confirmation.

Immediately before publishing:

1. Fetch `origin` again.
2. Confirm `origin/main` still equals the recorded candidate base.
3. Confirm the clean candidate HEAD is the commit that passed review and tests.
4. Push that commit with an ordinary, non-force push:

```bash
git push origin HEAD:refs/heads/main
```

Run this from the candidate worktree. The candidate is a direct descendant of
the tested base, so the push advances remote `main` linearly. Git's normal
[push rules](https://git-scm.com/docs/git-push) reject a competing divergent
update; never respond by force-pushing. If `main` moved, make a new candidate
from the new tip, reapply the frozen task, and revalidate the combined result.
Never publish first and rely on later checks to validate the merge.

Verify the remote result after push. If network failure makes the result
ambiguous, inspect remote `main` before retrying; do not squash the same task
again. Record the landed commit and mark the task complete in the queue. If
another writer advanced `main` afterward, verify the landed commit is its
ancestor rather than treating a newer tip as evidence of failure.

Direct pushes depend on the repository's GitHub rules. These rules were not
inspected for this guide. If they require PRs, use one agent-created PR per
candidate and the required checks; do not disable protection to follow this
document. PRs become useful later for server-enforced checks or more developers,
but are not necessary for a locally enforced single-integrator workflow.

## 6. Refresh Main And Clean Up Deliberately

Publishing from the candidate does not move the primary checkout's local `main`
or change its running Studio files. At a convenient point, stop/pause the manual
server, ensure the primary checkout is clean, then fast-forward it:

```bash
git fetch origin
git merge --ff-only origin/main
```

If local `main` has unpublished commits or uncommitted changes, preserve them and
explain the divergence; never reset or stash them automatically. Rebuild/restart
as needed. Continue running releases from the ordinary primary checkout on
`main`, as required by the existing release scripts.

Agents stop only their owned test servers. Worktree and branch deletion requires
explicit cleanup authorization. Do not use `git branch --merged` as the sole
cleanup proof: a squash commit does not make the source task commit an ancestor
of `main`. Use the recorded task-to-landed-commit mapping and remote verification.

If a landed change proves faulty, prepare a new revert or repair commit on top
of current `main`, test it, and land through the same queue. Do not rewrite
published history. Reverting source code does not undo a database migration or
restore personal project data; those require the documented recovery procedure.

## Agent Automation You Can Use Now

Give an agent this document and a bounded request. These prompts do not require
new tools, a PR service, or custom automation infrastructure.

### Worker Prompt

> Implement [task] in a new codex/[task] branch and separate worktree from
> origin/main. Follow docs/development/parallel-worktree-integration.md. Keep
> scope to [scope]. Use already provisioned dependencies; report missing setup.
> Commit the work and provide the frozen handoff with tests and limitations.
> Do not push main or modify my primary checkout.

### Integration Prompt With Landing Authorization

> Integrate [branch and frozen commit] using
> docs/development/parallel-worktree-integration.md. You may create a candidate,
> resolve routine conflicts, commit, run existing checks, and push the verified
> candidate to origin/main. Review correctness and architecture before landing.
> Do not install/update dependencies, weaken security settings, delete worktrees
> or branches, change my primary checkout, or run releases. Ask only when the
> task requires an unresolved product decision or separately authorized action.

### Queue Prompt

> Act as the only integration agent for [named task queue]. Integrate each frozen
> handoff serially using the guide, including conflict resolution, review, tests,
> and authorized non-force pushes to origin/main. Start each candidate from the
> latest origin/main. Workers must not publish main. Report the landed commit
> for each task and the concrete reason for any blocked task.

The queue prompt starts work when sent; it does not install a recurring watcher.
If later requesting unattended monitoring, authorize its queue scope and push
policy explicitly. A Skill is reusable instructions, not a scheduler or access
control boundary.

## Optional Reusable Skills

Once the workflow has been exercised, package these three focused instruction
sets as repository Skills. The following are proposed names and responsibilities,
not commands or installed Skills today:

| Proposed Skill | Responsibility and output |
| --- | --- |
| `renku-worktree-start` | Inspect the base, create one worktree/branch, check authorized prerequisites, report ownership and base hash |
| `renku-worktree-finish` | Check scope and working-tree cleanliness, run appropriate verification, commit, produce the frozen handoff |
| `renku-worktree-integrate` | Consume one handoff, prepare a squash candidate, resolve conflicts, review/test, conditionally publish, record landing evidence |

Keep these as ordinary Git workflows with explicit paths and commit hashes.
Do not invent an environment registry, generic merge engine, automatic
dependency installer, or blanket conflict-resolution policy. The existing
review Skill can be invoked explicitly as part of integration instructions.
Automation should remove mechanical merge work, not decide new product behavior
or grant itself broader permissions.

## Dependency Security Check

Checked 2026-09-11 against `pnpm-workspace.yaml`, the effective targeted output of
`pnpm config list --json`, `pnpm --version`, the installed dependency metadata,
and the release workflow. Effective pnpm is **11.7.0**, despite the older
Homebrew launcher; the pinned version is already present locally. No dependency
installation, package update, vulnerability scan, or malware analysis was run.

| Active control | Meaning |
| --- | --- |
| `minimumReleaseAge: 10080` | Seven-day delay for newly published versions |
| `minimumReleaseAgeStrict: true` | Fail rather than relax the age requirement when no eligible version exists |
| `minimumReleaseAgeIgnoreMissingTime: false` | Do not bypass the age check when publication time is missing |
| `trustLockfile: false` | Apply supply-chain checks to loaded lockfile entries |
| `blockExoticSubdeps: true` | Restrict transitive exotic package sources; this is not a blanket ban on every non-registry direct dependency |
| `allowBuilds` | Allow dependency build scripts for `bufferutil` and `esbuild`; explicitly disallow them for `better-sqlite3` and `workerd` |
| Pinned pnpm and CI frozen lockfile | Consistent package-manager version and dependency resolution in release builds |

This is a strong baseline. Age delays and script restrictions reduce exposure,
but cannot prove that an old package or allowed build script is benign. Package
code also executes when tests, compilers, or the application import it, even if
its installation scripts were blocked. Worktrees separate files; they do not
sandbox code or prevent a process with your privileges from accessing secrets.

Suggested hardening, not applied by this document:

- Change `verifyDepsBeforeRun: warn` to `error` so stale dependencies block
  execution instead of just warning. This is a consistency check, not a malware
  scanner. Do not use automatic installation to fix it silently.
- Evaluate `trustPolicy: no-downgrade`, which is not configured, to reject a
  reduction in publisher trust evidence. It is not proof of safe source code.
- Review version-specific build approvals for the two allowed packages; their
  current package-name approvals are not restricted to reviewed versions.
- Pin GitHub Actions to reviewed full commit SHAs. The current release workflow
  uses mutable `@v4` tags. Reduce the workflow-wide `contents: write` permission
  to read by default and grant write only to jobs that actually need it.

Repeated frozen installs do not inherently select a new dependency release each
time. Prefer the shared pnpm store and unchanged reviewed lockfile over copying
arbitrary dependency trees. Treat dependency updates and changes to install
scripts, registries, security policy, or release workflows as explicit review
items before executing the changed code. Avoid ambient provider/release secrets
in routine test subprocesses; test-home isolation is not a security sandbox.

Sources: [pnpm dependency policy](https://pnpm.io/settings/dependency-resolution),
[pnpm build and execution policy](https://pnpm.io/settings/build),
[pnpm supply-chain guidance](https://pnpm.io/supply-chain-security), and
[GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use).
The current web docs include newer pnpm features; use the repository-pinned
version when applying any settings changes.

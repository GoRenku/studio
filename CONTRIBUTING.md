# Contributing to Renku Studio

Renku is under active development. Keep contributions focused, explain the
problem they solve, and preserve the package boundaries described below.
Installation and filmmaking tutorials belong on [gorenku.com](https://gorenku.com);
this guide covers working on the source.

## Set up a checkout

You need Git, Node.js **22.12 or newer in the 22.x line, or 24.x**, and pnpm
**11.7 or newer in the 11.x line**. The root [`package.json`](package.json)
declares the supported ranges and pins pnpm 11.7.0 in `packageManager`.

Fork the repository on GitHub, clone your fork, then run from its root:

```bash
pnpm install
pnpm build
pnpm dev:studio
```

Open [http://localhost:5173](http://localhost:5173) in a desktop browser.
The initial build compiles the workspace dependencies. For subsequent UI work,
start the development server; when editing a shared package, rebuild it or run
its watch script in another terminal, for example `pnpm dev:core`.

To exercise the CLI from this checkout after building:

```bash
node packages/cli/dist/cli.js --help
```

Development Studio uses the normal local configuration and Project Library.
Treat that data as real: use a disposable project for changes that mutate data.
See the [README configuration section](README.md#local-configuration-and-project-storage)
for default paths and first-run behavior. Provider keys are managed in Studio
Settings and are not needed for normal unit tests. Never include credentials or
private project media in a contribution.

## Keep changes in the owning layer

Read [AGENTS.md](AGENTS.md), the
[architecture overview](docs/architecture/README.md), and
[coding practices](docs/architecture/coding-practices.md) before changing code.
In particular:

- Core owns domain validation, project relationships, and durable mutations.
  Server routes and CLI handlers parse input, call core, and format results.
- Engines owns provider schemas and execution. React renders projections and
  sends intent; it does not implement project metadata rules.
- Use structured diagnostics at package boundaries. Validate the owned envelope
  around prompts and media, not their creative contents.
- Use local shadcn UI components for interactive controls in Studio feature code.
- Preserve existing formatting and keep edits focused. Update callers directly
  when contracts change; do not add compatibility aliases or re-export shims.
- Architecture tests should protect boundaries and behavior, not private helper
  names or inventories of current implementation functions.

For schema work, follow the documented
[Drizzle migration workflow](docs/architecture/reference/drizzle-migrations.md): the
TypeScript schema is the source of truth, and Drizzle Kit generates and applies
migrations. Do not hand-write a parallel migration mechanism.

Discuss adjacent product or architecture changes before expanding a contribution.
For substantial planned work, use [the plan template](plans/PLAN_TEMPLATE.md),
including Review Attention, the Architecture Shape Gate, and a completion
checklist. Keep accepted decisions in `docs/`.

## Update both sides of agent-facing changes

[studio-skills](https://github.com/GoRenku/studio-skills) contains the agent
plugin and filmmaking guidance. If you change a CLI command, JSON contract,
generation workflow, or agent-visible behavior, inspect its skill callers and
update the relevant instructions, examples, and evaluations there. Reference
the companion pull request so reviewers can assess the changes together.

Skills guide creative decisions and use the CLI; they must not work around
missing core validation or write project database state directly.

## Verify your change

Start with the affected package's checks, then use the root verification
commands appropriate to the change. The [README command table](README.md#development-commands)
explains their scope. For a complete runtime verification pass:

```bash
pnpm build
pnpm test:final
```

Browser tests require Playwright's Chromium installation. If it is missing,
install it explicitly with:

```bash
pnpm --filter @gorenku/studio test:e2e:install-browsers
```

For website changes, run its separate build and checks:

```bash
pnpm build:website
pnpm --filter @gorenku/website check
```

Verify Studio UI changes at desktop sizes. Live provider tests are opt-in and
may incur charges; they are not part of the normal contributor checks. Follow
[local development notes](docs/operations/local-development.md) when a change
requires live-provider verification.

For documentation-only work, check statements against the implementation,
validate links and examples, and inspect the complete diff; an unrelated full
runtime test run is not necessary.

## Submit a pull request

- Describe the concrete problem, the resulting behavior, and relevant tradeoffs.
- Include checks run and any checks you could not run. For a bug fix, explain a
  reproducible trigger; for UI work, include a current screenshot when useful.
- Update the relevant documentation and tests with the implementation.
- Inspect the complete diff for unrelated edits, formatting churn, generated
  output, secrets, and changes to personal project data.

Contributors submit pull requests. Creating releases, publishing artifacts,
and deploying the public website are maintainer responsibilities; contributor
setup does not require release or deployment credentials.

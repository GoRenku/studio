# Renku Studio

**An open-source, local-first film studio you direct through Codex or Claude Code.**

[![License: AGPL-3.0](https://img.shields.io/github/license/GoRenku/studio)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/GoRenku/studio)](https://github.com/GoRenku/studio/releases/latest)

You give direction in your agent's conversation. Renku keeps the screenplay,
visual language, cast, locations, scene Beats, Shot Plans, Blender previs and
generated footage in one project on your computer, and Studio shows it all in
your browser, for live-action, hybrid and fully AI films.

![A Blender previs of a harbor walk beside the AI-generated take of the same shot](docs/readme-media/previs-to-shot.webp)

<sub>A Blender previs and the AI-generated take of the same shot, from Urban
Basilica, the sample film made alongside Renku.</sub>

## Install

Works with **Codex** (desktop app or CLI) and **Claude Code** (Claude
Desktop's Code tab or the terminal). Each needs its own plan or API account.
You also need an API key with credit for at least one media provider, such as
fal.ai; you pay providers directly and Renku adds no markup.
macOS 13.5+ (Apple silicon or Intel) or Windows 10 (1803+) / 11, x64.

macOS:

```sh
curl -fsSL https://downloads.gorenku.com/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://downloads.gorenku.com/install.ps1 | iex
```

Then start Studio (on macOS, in a new Terminal window):

```sh
renku studio start
```

Setup adds the Renku plugin from [Studio Skills](https://github.com/GoRenku/studio-skills)
to Codex and Claude automatically. The [download page](https://gorenku.com/download/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme)
has every step, [tutorials](https://gorenku.com/tutorials/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme) take you to a
first scene, and other agents use the [skills guide](https://gorenku.com/agent-skills/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme).

## See it in action

[Watch the 2-minute launch film](https://gorenku.com/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=studio-readme)

## Made with Renku

<p>
  <img src="docs/readme-media/made-with-renku-storyboard.jpg" width="32%" alt="A pencil storyboard of three shots">
  <img src="docs/readme-media/made-with-renku-character-sheet.jpg" width="32%" alt="A character sheet with costume, face and hand studies">
  <img src="docs/readme-media/made-with-renku-council-chamber.jpg" width="32%" alt="A generated shot in a council chamber">
</p>

Storyboard, character sheet and a generated shot from Urban Basilica, the
sample film made alongside Renku. [Explore the project](https://github.com/GoRenku/sample-project).

Renku is free and open source, made by one developer. If it helps your work,
starring this repository helps other filmmakers find it. Questions and
finished scenes are welcome in
[Discussions](https://github.com/GoRenku/studio/discussions).

## How it works

![Codex directing a scene alongside Renku Studio, with Blender previs and generated footage](docs/screenshots/codex-and-renku.png)

Renku's skills teach your agent filmmaking workflows and use the `renku`
command line to read and update your project. Studio runs locally and shows
the screenplay, cast, locations, shot plans and media so you can review the
work and tell the agent what to change. Creative choices stay with you and
your agent; Renku keeps the project consistent.

## For contributors

This repository is the technical entrypoint for the Studio runtime, CLI, and
shared domain implementation. To work on the code, read
[CONTRIBUTING.md](CONTRIBUTING.md). Everyone taking part follows the
[Code of Conduct](CODE_OF_CONDUCT.md).

### How the repositories fit together

- **[studio](https://github.com/GoRenku/studio)** (this repository) owns project
  storage, domain commands, generation engines, the CLI, and the browser app.
- **[studio-skills](https://github.com/GoRenku/studio-skills)** owns the Renku
  agent plugin: filmmaking instructions, workflow references, samples, and
  supporting scripts. Its skills use the separately installed `renku` CLI to
  work with Studio projects; the plugin does not bundle the Studio runtime.

Creative decisions live in the user/agent workflow. Core owns domain validation
and durable changes. When a CLI contract changes, update its callers and the
corresponding skill references in `studio-skills` together.

### Repository organization

| Path | Responsibility |
| --- | --- |
| `packages/core` | Domain contracts, validation, commands, projections, SQLite/Drizzle storage, assets, and generation context. |
| `packages/engines` | Provider catalogs, input schemas, simulation, and provider execution. |
| `packages/diagnostics` | Structured errors, warnings, locations, and suggestions. |
| `packages/cli` | The `renku` command surface for people and agents. |
| `packages/studio` | React browser app, local Hono server, and UI primitives. |
| `packages/website` | The public website at gorenku.com, built with Astro. |
| `docs` | Accepted architecture, CLI, operations, and decision documentation. |
| `plans/active` | Current implementation plans and completion checklists. |
| `plans/exploration` | Open product and technical exploration. |

The CLI and Studio server call core-owned commands. React consumes projections
and sends user intent through the server. Keep business rules in their owning
package rather than duplicating them in UI, HTTP, CLI, or skill code.

### Local configuration and project storage

Manage provider API keys in **Studio Settings**, or in the optional provider
step during first-run setup. Keys are saved in `.env` in the configuration
folder below. The provider credential resolver reads those saved keys;
exported shell API-key variables do not override them.

The first-run UI offers **Use this Project Library** to create the recommended
root folder for movie projects. These are the defaults implemented in core:

| Platform | Configuration folder | Recommended Project Library |
| --- | --- | --- |
| macOS | `$HOME/.config/renku` | `$HOME/Movies/Renku` |
| Linux | `$HOME/.config/renku`, or `$XDG_CONFIG_HOME/renku` when `XDG_CONFIG_HOME` is an absolute path | `$HOME/Videos/Renku` |
| Windows | `%LOCALAPPDATA%\Renku\Studio` | `%USERPROFILE%\Videos\Renku` |

The configuration folder contains `config.yaml` and provider credentials.
Mutable state (the current Project, Studio runtime and events, provider
metadata and price caches, and the Default Model List copy) lives in the Renku
state directory: `${XDG_STATE_HOME:-$HOME/.local/state}/renku` on macOS and
Linux, `%LOCALAPPDATA%\Renku\Studio\State` on Windows. Project databases and
media live in the Project Library. These paths are implemented in
[`packages/core/src/server/config/paths.ts`](packages/core/src/server/config/paths.ts).

The current UI confirms the recommended folder; it does not offer a custom
folder picker. To choose another root, close Studio and run
`renku init <storage-root>` with an absolute path **before completing onboarding**.
This command preserves existing configuration; it does not relocate an existing
library.

### CLI for technical work

Use `renku --help` for the command overview and the
[CLI reference](docs/cli/commands.md) for complete arguments and document shapes.
After building this checkout, invoke its CLI from the repository root with
`node packages/cli/dist/cli.js --help`; replace `renku` in the examples below
with `node packages/cli/dist/cli.js` to use your local build.

Angle-bracket values are placeholders to replace with real project names, IDs,
paths, or provider identifiers.

| Command | Purpose |
| --- | --- |
| `renku about` | Report product and CLI package information. |
| `renku init <storage-root>` | Create configuration, or report the existing configuration. |
| `renku create <project-name> --title <title>` | Create a movie project and make it the current authoring project. |
| `renku project open <project-name>` | Set the current authoring project. |
| `renku project current --json` | Inspect the current authoring project. |
| `renku project close` | Clear the current authoring project. |
| `renku project migrate <project-name>` | Apply pending project database migrations. |
| `renku studio start` | Start the local Studio web application. |
| `renku studio stop` | Stop the local Studio server. |
| `renku studio server status --json` | Inspect the local Studio server status. |
| `renku studio current --json` | Read the current browser focus and context. |
| `renku project select <project-name>` | Request that Studio display a project. |
| `renku director context --json` | Read project readiness and directing context. |
| `renku info show --json` | Inspect project information. |
| `renku settings show --json` | Read Project Settings, distinct from global provider credentials. |
| `renku screenplay show --json` | Read the screenplay. |
| `renku generation context --purpose <purpose> --target <target> --json` | Read core-owned context for a generation purpose and target. |
| `renku generation schema show --provider <provider> --model <model> --json` | Inspect a provider model's input schema. |
| `renku generation validate --file <request.json> --json` | Validate a generation request document. |

The persisted **authoring project** and the browser's **current selection** are
separate: opening a project in the CLI is not the same as selecting it in Studio.
The reference also covers cast, locations, props, Lookbooks, scene Beats, Shot
Lists, Blender Previs, media attachment, provider execution, and Trash.

### Development commands

Contributor prerequisites and initial setup are in [CONTRIBUTING.md](CONTRIBUTING.md).
Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build diagnostics, engines, core, Studio, and CLI in dependency order. |
| `pnpm dev:studio` | Start the Studio development server at `http://localhost:5173`. |
| `pnpm dev:core` | Watch and compile core while developing. |
| `pnpm test` | Run the five runtime packages' unit-test suites. |
| `pnpm test:integration` | Run core, CLI, and Studio integration tests. |
| `pnpm test:e2e:studio:smoke` | Build browser-test dependencies and run the isolated Studio smoke suite. |
| `pnpm lint` | Lint the five runtime packages. |
| `pnpm check` | Run type checks, test type checks, lint, architecture checks, test-partition checks, and release-tool tests. |
| `pnpm test:final` | Run `check`, unit tests, integration tests, and Studio smoke tests. |
| `pnpm dev:website` | Start the website development server. |
| `pnpm build:website` | Build the website separately. |
| `pnpm --filter @gorenku/website check` | Run Astro checks for the website. |

Focused runtime scripts include `pnpm build:core`, `pnpm test:engines`,
`pnpm test:cli`, and `pnpm lint:studio`. The root runtime build and verification
scripts do not include the website. See [`package.json`](package.json) for the
exact script definitions. Creating and publishing releases is maintainer work,
not part of the contributor workflow.

### Documentation

- [Contributor guide](CONTRIBUTING.md)
- [Documentation map](docs/README.md)
- [Architecture overview](docs/architecture/README.md)
- [Layers of responsibility](docs/architecture/layers-of-responsibility.md)
- [Data model and storage](docs/architecture/data-model-and-storage.md)
- [Media generation](docs/architecture/media-generation.md)
- [CLI command reference](docs/cli/commands.md)
- [Local development notes](docs/operations/local-development.md)
- [Parallel worktrees and agent-assisted integration](docs/development/parallel-worktree-integration.md)
- [Architecture decision records](docs/decisions)
- [Renku agent skills](https://github.com/GoRenku/studio-skills)

## License

Copyright © 2026 Kerem Karatal. Renku Studio is licensed under
[GNU AGPLv3](LICENSE). The license covers the software, not the films and other
creative work people make with it. Third-party materials retain their own
licenses. The Renku names and brand assets are covered by the separate
[trademark policy](TRADEMARKS.md).

# 0004 Use Human-First CLI Guidelines

Date: 2026-05-05

Status: accepted

## Context

Renku Studio needs a command-line interface for humans and agents working with
local Studio projects. The CLI will be used interactively while creating,
inspecting, validating, and running project workflows, and it will also be used
from scripts and automated agent runs.

That means the CLI has two responsibilities:

- be clear, discoverable, and helpful for people using it directly;
- behave predictably as a composable command-line tool in automation.

The project already uses `meow` as the Node.js command-line helper for argument
parsing, help text, flags, and command wiring.

Renku Studio is focused on movie production. Adding a `movie` namespace after the
`renku` binary would make common commands longer without adding meaningful
disambiguation.

## Decision

Use the Command Line Interface Guidelines as the product design baseline for the
Renku Studio CLI:

```text
https://raw.githubusercontent.com/cli-guidelines/cli-guidelines/refs/heads/main/content/_index.md
```

Use `meow` as the first CLI parsing and help-text helper in
`@gorenku/studio-cli`.

Use `renku` as the binary name. Do not add a redundant `movie` namespace to
Renku Studio commands. Commands should use shapes like:

```bash
renku init <storage-root>
renku create --file project.yaml
renku cast add ...
```

Use YAML for CLI and local application configuration, and use camelCase keys for
YAML and Markdown front matter throughout Renku Studio.

The global Renku config path is fixed:

```text
~/.config/renku/config.yaml
```

The first config shape is:

```yaml
version: 0.1.0
storageRoot: /absolute/path/to/storage
```

`storageRoot` is required. It has no default and must be provided explicitly by
the user during `renku init`.

Design the CLI around these operating rules:

- Commands are human-first by default. They should explain what happened, what
  failed, and what the user can do next.
- Commands remain automation-friendly. Primary command output goes to `stdout`;
  status messages, progress, warnings, and errors go to `stderr`.
- Successful commands return exit code `0`; failed commands return non-zero
  exit codes that map to clear failure modes.
- Top-level and subcommand help should be useful on its own. Support `--help`,
  `-h`, `help`, and subcommand help where the command shape allows it.
- Help should lead with common examples before exhaustive option details.
- Invalid input should fail clearly and, when the intended command is obvious,
  suggest the likely correction instead of printing a stack trace.
- Commands that may mutate project state should make the target project and
  planned action clear before doing surprising or destructive work.
- Machine-readable output should be explicit, for example through a `--json`
  flag, so scripts do not need to parse human-oriented prose.
- Missing configuration, invalid mappings, and unsupported workflow states
  should fail clearly instead of falling back silently.

The first command surface should stay small and grow from the project workflows
Renku Studio actually supports. Prefer a stable, discoverable command shape over
adding speculative commands early.

## Consequences

- CLI implementation and tests should treat help text, exit codes, stdout, and
  stderr as part of the public interface.
- `meow` is the expected place for top-level parsing and help behavior unless a
  future CLI requirement shows it is too small for the command model.
- `renku init` creates or inspects the fixed global config file and remains a
  thin wrapper over config functionality owned by `@gorenku/studio-core`.
- New commands should include examples and clear error messages as part of their
  initial implementation, not as polish added later.
- Human-readable output can be friendly and explanatory, while `--json` output
  should stay stable and structured for automation.
- The CLI package should avoid hiding broken project state with fallback logic;
  failures should point users and agents toward the missing or invalid contract.

# Use Agent Media Execution Policy For External Built-In Image Generation

Date: 2026-06-30

Status: accepted

## Context

Codex can generate images through a built-in tool that is not a Renku provider
adapter and is not available to every agent surface. Renku Studio still needs a
clear way to tell agents when that external built-in path is appropriate for
take-owned image dependencies such as first frames, last frames, reference
images, and video prompt sheets.

Putting Codex as a provider in `packages/engines` would make the generated
image path look like a normal Renku-managed generation run. That would be
incorrect because Renku cannot estimate, execute, or receipt that external
tool through the engines package.

## Decision

Renku Studio uses an agent media execution policy owned by core configuration.
The policy is exposed through generation context, generation model list reports,
director context, and shot-video take authoring context.

The configured image-generation default execution path is one of:

- `ask`
- `codexBuiltInWhenAvailable`
- `renkuManaged`

The effective default is `ask` when no project configuration is present.

Codex built-in generation is represented as an external agent capability in
the report, not as a Renku model provider. Reports identify the preferred
external capability as `codex.gpt-image-2` when the purpose can use it, and
state that it is not available in Renku and requires the agent harness tool.

When an agent uses external built-in image generation, it stages the resulting
file inside the project and imports that project-relative file through the
normal CLI media import path. The import has no Renku generation receipt.
Corrected images can replace the selected prepared input in the same slot
through the focused media import command.

## Consequences

- `packages/engines` remains focused on Renku-managed provider adapters,
  schemas, estimates, and execution.
- Core owns the policy and exposes it consistently to CLI, Studio, and agent
  surfaces.
- Agents can make an informed routing choice without guessing from provider
  names or duplicating purpose rules.
- Non-Codex agents can see that an external built-in path requires a harness
  capability and can ask the user or use the Renku-managed path instead.
- Images created outside Renku are normal prepared inputs after import, but
  they do not pretend to have a Renku generation run receipt.

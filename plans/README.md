# Renku Studio Plans

This folder is for active plans, exploratory thinking, and archived planning
material.

- `active/` contains current implementation plans.
- `exploration/` contains product, story, UI, and technical exploration.
- `archive/` contains old plans kept for context.

Use `PLAN_TEMPLATE.md` for new active implementation plans. In particular,
plans that change production code must include an Architecture Shape Gate before
implementation begins. That gate must describe the intended module/file shape,
public entrypoints, internal ownership split, dispatcher strategy, and explicit
stop conditions for avoiding god files or broad catch-all modules.

Accepted decisions should move into `docs/`, especially `docs/decisions/`.

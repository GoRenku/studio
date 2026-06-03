# Coding Practices

Date: 2026-06-03

Status: current

Role: reference

## Purpose

This document records implementation practices that apply across Renku Studio.
It exists so code shape problems are caught before they become architecture
problems.

## Keep Functions Focused

Functions should do one job at one level of abstraction.

Avoid functions that mix several of these responsibilities:

- command routing;
- purpose dispatch;
- flag parsing;
- JSON file parsing;
- domain validation;
- service calls;
- output formatting;
- event emission;
- persistence;
- provider execution.

When a function starts doing multiple jobs, split the work into deliberately
named handlers, parsers, services, or domain functions before adding more
branches.

## Cyclomatic Complexity

High cyclomatic complexity is not allowed as a normal implementation style.

Default targets:

- exported command entry points: complexity `3` or lower;
- command handlers and UI event handlers: complexity `8` or lower;
- domain functions: keep complexity low enough that each branch represents a
  meaningful domain case;
- nesting depth: generally `2` or lower.

If a function naturally exceeds those targets, pause and introduce a clearer
structure:

- a command-handler map;
- a typed registry;
- a strategy object;
- a small parser;
- a purpose-specific module;
- a focused validation function;
- a table of explicit domain cases.

Do not hide complexity by moving branches into anonymous callbacks or nested
ternaries.

## Forbidden Command Shapes

Command code must not be written as one large exported function that handles many
unrelated command paths.

Do not add:

- long `if` / `else if` chains for command routing;
- nested ternary dispatch chains;
- purpose dispatch embedded inline in command entry points;
- functions that parse flags, branch by purpose, call services, write output,
  and emit side effects in one body.

The CLI is a crucial human-facing and agent-facing contract. It should stay thin
over core, but thin code must still be structured.

Preferred CLI shape:

```text
exported command entry point
  builds runtime
  dispatches to command handler
  writes result

command handler
  parses command-specific flags
  calls core service
  returns result

purpose registry or handler map
  maps purpose ids to focused handlers
```

## Structured Branching

Use branching when it represents real domain logic. Avoid branching when it is
only compensating for missing structure.

Acceptable branching examples:

- discriminating a tagged union;
- validating mutually exclusive options;
- handling a small number of explicit domain states;
- returning structured diagnostics for known failure cases.

Unacceptable branching examples:

- routing a whole command family in one function;
- dispatching every media generation purpose with nested ternaries;
- handling unrelated file formats, side effects, and service calls in one
  function;
- using fallbacks to guess old names, partial matches, or obsolete shapes.

## Tests And Enforcement

When touching a complex area, add enforcement that keeps it from regressing.

Prefer:

- ESLint `complexity` rules scoped to the package or folder;
- ESLint `max-depth`;
- ESLint `no-nested-ternary`;
- focused static tests when lint cannot express the local rule well;
- handler-level tests that prove dispatch tables route commands correctly.

Do not install new tooling dependencies unless the user explicitly approves
dependency installation.

## Relationship To Architecture

Complexity limits are architecture rules, not style preferences. If a module is
hard to extend safely, the architecture is not finished.

This matters especially for:

- CLI command files;
- Studio server route handlers;
- media generation purpose dispatch;
- dependency graph planning;
- Studio feature components with several independent UI modes.

When a plan introduces new command paths, providers, purposes, or dependency
states, the plan must name the handler or registry shape that keeps the
implementation reviewable.

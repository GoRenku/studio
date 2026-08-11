# 0077: Use Self-Contained Agent-First Beta Distribution

Date: 2026-08-09

Status: accepted

> **Partially superseded by ADR 0078.** The runtime archive remains
> self-contained, but it no longer bundles or versions the agent plugin, and
> releases are now created from repository-owned tags rather than an arbitrary
> workflow version input. The historical decision below is otherwise preserved.

## Decision

Distribute Renku as one self-contained, versioned product archive installed by
platform bootstrap scripts from `downloads.gorenku.com`.

The public product consists of:

- the `renku` CLI;
- the browser-based Studio and its local Node server;
- Renku's Codex and Claude skills/plugin metadata;
- private internal runtime packages and their production dependencies; and
- the complete Core-owned Drizzle migration history.

Internal workspace packages remain private and are not published independently
to npm. The agent is an essential part of the product rather than an optional
audience segment.

Codex and Claude Code, whether used from their desktop apps or terminal
harnesses, invoke `renku` directly through their normal local shell tools. The
distribution does not add a separate protocol bridge for a command surface the
coding agents can already use.

The beta supports macOS arm64/x64 and native Windows x64 PowerShell without
WSL. It reuses installed Node `^22.12.0 || ^24.0.0`; otherwise it uses a private
official Node 24 runtime without modifying the user's system Node.

Studio is a foreground local web application. Renku does not ship Electron or a
notarized native desktop bundle during this beta.

## Operational Consequences

- Routine releases write only objects in the existing `renku-downloads` R2
  bucket and use the existing `downloads.gorenku.com` domain.
- No routine release creates or changes Cloudflare buckets, DNS, Workers,
  Pages, custom domains, or dashboard configuration.
- Immutable version objects are uploaded before beta aliases and installers.
- The installers verify SHA-256 before activation and keep versioned installs.
- FFmpeg and ffprobe are not runtime or installation prerequisites.
- Urban Basilica is never distributed; it remains internal development data.
- Linux packaging is deferred until after the initial beta.

# 0103 Show Keyed Providers As Agent Defaults

Date: 2026-09-27

Status: accepted

## Context

Project Settings used fixed Image, Video, and Audio provider menus. The menus
ignored saved API keys and excluded configured providers. A provider preference
is an initial choice for the Media Producer agent, not a guarantee that a
particular model or operation is available.

## Decision

All three Project Settings provider menus show keyed Fal.ai, Pika, Replicate,
and WaveSpeed, using the existing sanitized credential status resource.
ElevenLabs is offered only in Audio when keyed. World Labs is never offered in
these menus because it is dedicated to Location World generation. Image always
offers keyless ChatGPT Images 2.5 (Codex) first and retains Codex as the
new-Project default. Studio does not inspect media routes, models, or provider
capabilities to populate these menus.

Core continues to store each preference as an opaque string in Project
Settings version 6. Removing a key does not rewrite the saved preference.
Studio identifies a missing key or a provider unavailable in the current menu
without changing the saved value. It directs missing-key cases to global API
key Settings. Media Producer starts from the preference, checks only the actual
request through Skills and current provider information, and asks the user if
that provider cannot fulfill it. It never silently switches providers.

The Codex choice names the Images 2.5 product family. The available built-in
tool does not expose a Flare or Sunburst selector, so neither exact API variant
is implied by this choice or by provenance without tool evidence.

## Consequences

- A saved key makes a general media provider selectable as an agent default;
  ElevenLabs remains Audio-only and World Labs remains Location World-only.
  Menu presence does not certify media or model support or remote authentication.
- Core and Engines gain no provider/media eligibility table or model-specific
  Settings check. Credential storage, routes, and generation execution stay as
  they are.
- Existing hard-coded model references elsewhere in Core and Engines require
  separate provider-protocol cleanup; this decision adds none.

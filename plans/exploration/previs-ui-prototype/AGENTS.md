# Prototype Instructions

## Accepted Previs direction

- Quick design iteration is the priority. The user explicitly does not want
  full-scale testing or bulletproofing for this prototype. Make only lightweight
  checks needed to show the changed experience, then hand it back for feedback.

- Keep the charcoal surfaces, amber accents, fine borders, restrained typography,
  inset Description surface, colored legend dots and active-cue outline shown in
  `references/combined-monitor.png`. These are intended final styling, not wireframes.
- Keep two equal monitor panes at every revision, using the Revision 3 sizing.
  Show a quiet placeholder when a generation is absent. Prev/Next must not grow
  or shrink the workspace. This supersedes the earlier adaptive-single preference.
- Do not add a Compare button.
- Use exactly one shared playback timeline in the normal paired view.
- Prev/Next changes the selected revision, video, cues and associated generation.
- Keep the colored cue timeline above the vertical cue list, as in the user's
  September 9 screenshot. Keep all key points in the list, with color dots and
  play controls; play associated voice audio when available.
- Use the actual ShotDescriptionViewer from the Shot List in both the compact
  Description box and its larger dialog, including its syntax colors.
- Preserve the existing MediaCard entry pattern, showing video, title and Beats.
- Keep this an isolated UX prototype; backend integration and the formal plan
  follow user feedback.
- Do not automate fullscreen inside the Codex in-app browser: the September 9
  verification entered fullscreen for the whole Codex app and the user had to
  force quit it. Continue windowed checks in Chrome. Fullscreen verification is
  outstanding; do not claim that the app freeze has been fixed.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

# Website learning guides

The public website separates installation, first-session setup, and filmmaking
instruction so that downloading Renku remains a focused task.

- `/download/` retains the platform installer, Codex plugin installation, and
  Studio launch instructions. It links onward to Quick Start.
- `/quick-start/` covers device-wide provider credentials, Project creation,
  agent-assisted FDX import, and the Codex/Studio review loop.
- `/tutorials/` is a visual course overview. Eight individual chapter routes
  cover Inspiration, Lookbooks, Cast and world design, Scene Beats, Beat
  Storyboards, Shot List planning, Blender Previs, and video generation.
- Shot List and Blender Previs are alternative planning approaches. Both have
  a path into video generation; completing both is not required.

## Content ownership

All implementation lives in `packages/website`. `src/data/tutorials.ts` owns
the ordered editorial chapter content. `src/pages/tutorials/[slug].astro`
generates the chapter pages and previous/next navigation. `LearnLayout.astro`
and `styles/learn.css` own shared reading presentation. `LearnNav.astro` owns
the three learning destinations. `CodexPrompt.astro` only displays and copies
authored example prompts; it does not execute or interpret them.

The guides reuse the website's Fraunces and IBM Plex Sans typography, existing
color tokens, Studio screenshots, provider marks, and harbor media. The
tutorial pages are static; they do not invoke providers or change Studio data.

## Editorial checks when workflows change

Verify wording against the current owning implementation and documentation:

- Onboarding and Settings provider credential controls; Core's provider catalog.
- Project Library Create Project dialog.
- `docs/architecture/screenplay-fdx-import.md` for source authority and updates.
- Decisions 0048 and 0080 for the two Lookbook roles and Beat Storyboard style.
- The sister `studio-skills` project for specialist workflow handoffs and current
  generation, Shot List, and Blender Previs capabilities.

Do not imply that FDX import creates production department records, that saving
a provider key verifies account access, or that generated scene takes are an
assembled final film. Example prompts use user-replaceable targets and are
creative guidance, never Studio runtime validation contracts.

## Verification

Run `pnpm --filter @gorenku/website check` and
`pnpm build:website:cloudflare`. Review desktop screenshots and test learning
navigation, anchors, prompt copying, installer tabs, and embedded playback.
Check internal links and fragments in the generated static pages. Publishing
is a separate operation using the existing website deployment workflow.

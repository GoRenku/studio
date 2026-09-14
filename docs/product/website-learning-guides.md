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

Distinguish deterministic FDX import from Movie Director’s follow-up stages:
Project Settings can enable continuity subjects, media, analysis, Beats, and
storyboards after import. Do not imply that saving a provider key verifies
account access or that generated scene takes are an assembled final film.

Read the owning `SKILL.md` and relevant workflow references before writing or
revising tutorial copy. Name the skills in instructional prose. Explain their
standard behavior separately from optional user direction; prompts should ask
for outcomes rather than repeat context gathering, validation, saving, routing,
or generation review already handled by the skills. Keep manual Studio actions
such as creating Inspiration folders and uploading grabs in the UI instructions.
Movie Director coordinates broad requests; skill descriptions also allow focused
requests to route without a skill name in the example prompt. When references
disagree, describe the verified common workflow without inventing a hard product
requirement. Example prompts are creative guidance, never runtime contracts.

Voice and generation guidance follows Media Producer’s `cast-voice-sample`,
`shot-plan-dialogue-audio`, `inline-generation-configuration`, and
`video-reference-continuity` references, plus Casting Director’s voice-casting
workflow. Distinguish default Cast Voices from selected Shot Plan dialogue takes,
and native generated audio from support for uploaded audio references. The Codex
configuration screenshot and the actual Studio Audio screenshot use the shared
tutorial figure treatment, including rounded corners, a border, and a caption.
The inline configuration selector is described as Codex-only.
Generation Preview copy follows the Media Generation Request dialog’s Prompt,
References, and Configuration tabs. Configuring or updating a preview does not
submit a generation.

## Verification

Run `pnpm --filter @gorenku/website check` and
`pnpm build:website:cloudflare`. Review desktop screenshots and test learning
navigation, anchors, prompt copying, installer tabs, and embedded playback.
Check internal links and fragments in the generated static pages. Publishing
is a separate operation using the existing website deployment workflow.

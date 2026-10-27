# Website learning guides

The public website separates installation, first-session setup, and filmmaking
instruction so that downloading Renku remains a focused task.

- `/download/` covers the platform installer, automatic Claude/Codex plugin
  setup, and Studio launch instructions. It links onward to Quick Start. Above
  the install steps, "What you'll need" lists the supported computers, the
  agent app and plan it needs, and a provider API key; "What generation costs"
  shows three real, dated example requests.
- `/agent-skills/` covers independent skills installation and updates for other
  agents, with explicit agent selection and project/global scope.
- `/quick-start/` first explains the agent-first working model: ask the agent to
  act or explain, review the result in Studio, then give feedback. It also covers
  device-wide provider credentials, Project creation, screenplay import or
  authoring, and the Codex/Studio review loop. It ends with a first generated
  image: a Location hero image, made with Codex's built-in image tool in Codex
  or with a keyed provider in other agents.
- `/tutorials/` is a visual course overview. Eight individual chapter routes
  cover Inspiration, Lookbooks, Cast and world design, Scene Beats, Beat
  Storyboards, Shot List planning, Blender Previs, and video generation.
- Shot List and Blender Previs are alternative planning approaches. Both have
  a path into video generation; completing both is not required.
- The optional sample project guide explains how to clone the Basilica project
  directly into the configured Project Library and open it from Projects.
- `/tutorials/casting/` follows Big Fish's Karl through scene-specific Looks,
  casting candidates, comparison, wardrobe, and character sheet rounds with
  one pick per costume. It explains the Codex plugin panels and Studio's
  Casting tab, plus the quick agent-led approach used for Basilica and Sintel.
  Current one-option requests still use the Look/costume round contracts;
  the guide does not imply a separate direct-to-Cast sheet generation API.
- `/tutorials/character-arcs/` uses Edward Bloom to explain the arcs produced
  by screenplay analysis for protagonists and key supporting roles, the
  Interpretation label, arc types, scene evidence, and turning-point cards.
  One person's arc spans all their age-specific Looks. The Inspiration
  chapter links to this guide, and Cast and world links to the casting guide.
- Recipes work through one technique on a real scene, using media from
  recorded Renku runs. The first is "Previs a dialogue scene in Blender",
  built on Basilica Scene 2. A recipe makes no time claim it has not measured
  and describes no step Renku does not support.
- `/journal/` (with `/journal/rss.xml`) holds notes on how films and Renku are
  made. `/changelog/` shows the Renku Studio releases that have written notes,
  read from GitHub Releases when the website is built.

## Content ownership

All implementation lives in `packages/website`. `src/data/tutorials.ts` owns
the ordered editorial content of chapters, recipes and practical guides; each
entry's `kind` decides its group, labels, sidebar and previous/next links. `src/pages/tutorials/[slug].astro`
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
- Casting Director's Looks, casting rounds, wardrobe plan, and Cast media
  handoff references; Media Producer's character sheet reference; ADR 0127
  and the Studio Casting tab/shared Compare implementation.
- Screenplay Analyst's Character Arc guidance and CLI workflow; ADR 0125
  as updated by ADR 0127, and the Studio Arc tab implementation.

Download page facts:

- Re-check agent app plan requirements on the vendors' pricing pages and update
  the "Plans checked" date with them.
- Cost examples come only from real Urban Basilica generation records, priced
  at the provider's published list price on a stated date. Refresh all three
  together and keep the record, date and price source in the comment beside
  them in `download.astro`.
- System requirements match `distribution/install.sh` and
  `distribution/install.ps1`; the provider list matches onboarding.

Distinguish deterministic FDX import from Movie Director’s follow-up stages:
Project Settings can enable continuity subjects, media, analysis, Beats, and
storyboards after import. Do not imply that saving a provider key verifies
account access or that generated scene takes are an assembled final film.

Read the owning `SKILL.md` and relevant workflow references before writing or
revising tutorial copy. Name the skills in instructional prose. Explain their
standard behavior separately from optional user direction; prompts should ask
for outcomes rather than repeat context gathering, validation, saving, routing,
or generation review already handled by the skills. Show agent-directed
Inspiration collection as the primary path, with Studio folder creation and
image upload as a manual option. Make clear that those manual controls do not
imply every filmmaking workflow has a Studio button.
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

# 0233 Website Proof And Learning Content

Status: done for Basilica, published by the maintainer on 2026-10-17. Sintel's previs and take come later.
Date: 2026-10-15

## Review

### What visitors will see

1. **Home page: a new "Made with Renku" section**, right after "The workflow"
   strip. It follows one real scene through four stages: the screenplay page,
   the storyboard, the Blender previs and the finished video take. A switch at
   the top picks the film:
   - **Basilica** (live action), Scene 3 "The Harbor Argument". All four stages
     exist today.
   - **Sintel** (animated), Scene 3, the back-alley scene. Today it has the
     page and four storyboards. Its previs and take appear when you make them.
     Until then the Sintel view shows only the stages that exist, with no
     "coming soon" boxes.
2. **Quick Start gets a fifth step, "Make your first image"**, using an
   existing Studio screenshot of the Harbor Quarter location image.
3. **A Journal** at `/journal/` with an RSS feed. The first post is "How the
   harbor scene was made". I draft it from the project records; you edit and
   approve it.
4. **A Changelog page** at `/changelog/`, built from the release notes on
   GitHub Releases (your D1 answer).
5. **One recipe, "Previs a dialogue scene in Blender"**, built from Basilica
   Scene 2 material that already exists.
6. **Navigation:** Journal goes in the header. Journal and Changelog go in the
   footer.

### Taken out in this revision

- The "Why I built Renku" page. It can come later.
- The music video recipe. Renku is built for films and series with scripts and
  characters. If users start trying music videos, that is the signal to add
  support.
- New production runs. The timed storyboard run (old D5) and the first-session
  screen recording are both out. Everything uses content that already exists.

### Where it stands (2026-10-17)

Done and published:

- Made with Renku on the home page, Scene story layout, with the Basilica and
  Sintel switch.
- Quick Start step 05, the Journal with its RSS feed and first post, the
  Changelog, the recipe, and the new header and footer links.
- Credit lines: "Basilica, a short film by Kerem Karatal. Made with Renku." and
  the Sintel credit with links to durian.blender.org and the CC BY 3.0
  license, noting that only the script is Sintel's and everything else was
  made in Renku Studio.
- Captions and lip sync checked by the maintainer on every video with speech,
  including the recipe's joined two-clip video.

Changed after the first review, at the maintainer's request:

- The harbor take is the second take (`gsb7`). It used an ElevenLabs v4
  six-line dialogue recording as its audio reference. "What the take was
  given" shows that take's five references (Mara and Urban sheets made with
  Codex, the Harbor Quarter sheet, a frame from the first take, the previs),
  a player for the recording, and the take's own direction text. The first
  take and why it was replaced are covered in the journal post, with the
  maintainer's dialogue-panel screenshot.
- The journal post has a cover image, inline storyboards, previs and reference
  images with captions, and proper spacing.
- The recipe shows the selected takes of both clips (Clip 1 take 3, Clip 2
  take 1) played back to back, as Studio plays them. A new section explains
  why the 30-second previs was generated as two clips and how Studio shows
  them. The recipe is linked from the tutorials page header and from the
  Blender Previs chapter.

Still open:

- Sintel's previs and take. When they exist, add them to
  `src/data/made-with-renku.ts`; the section needs no code change.

Decisions made along the way:

- Layout: Scene story (stacked stages, take full width at the end).
- The Shot Planning section's collapsed harbor videos were removed and replaced
  with a link to the new section.
- Show what the video model was given: yes.
- No Sintel recipe and no "Why I built Renku" page for now.
- The changelog reads GitHub Releases at build time (0231 D5).

### Technical changes worth noticing

- Tutorial entries get a group field (chapter, guide or recipe), replacing the
  yes/no `optional` flag. Visible effect: a chapter's sidebar lists only
  chapters, and the last chapter's "next" link goes back to all tutorials
  instead of into the practical guides.
- The two videos hard-coded into the Blender Previs chapter page move into the
  tutorial data, so recipes can show video the same way. The chapter looks the
  same.
- `legal.css` is renamed `article.css` so the journal and changelog share the
  Terms and Privacy reading column. Terms and Privacy look the same.
- The changelog asks GitHub for releases during the build. If GitHub can't be
  reached, the build fails, the same as plan 0232's star count. It shows only
  releases that have notes. The 25 older releases have no notes, so the page
  links to GitHub for those.
- No new dependencies, no deletions apart from the stylesheet rename, nothing
  in the Basilica or Sintel projects is changed, and nothing outside
  `packages/website` changes except two docs files.

## Mockups

Two layout mockups (Filmstrip and Scene story) were shown on 2026-10-17 from a
scratch file; Scene story was chosen. The mockups were not kept.

## Context And Evidence

### Related plans

- 0231 owns the release notes. GitHub Releases are the only source (decided
  2026-10-17, D1).
- 0232 owns the header star button, the "Renku project" footer row, link
  previews and the sitemap. 0232 and this plan both edit `SiteHeader.astro`,
  `SiteFooter.astro` and `BaseLayout.astro`; whichever lands second rebases.
- 0234 owns analytics. The recipe page is counted by the existing tutorial
  path rule.
- 0236 may change Quick Start step 02 and the sample-project guide.

### Current website

- Astro 7.0.6, static output, Cloudflare Pages. No content collections yet.
- Home (`src/pages/index.astro`): Hero, WorkflowStrip, five FeatureSections,
  ShotPlanningSection, VideoFeatureSection, Audience, FAQ, CTA.
  `ShotPlanningSection.astro` contains the collapsed harbor videos (removed by this plan).
- Quick Start has four steps and no generated image.
- Tutorials: eight chapters and three guides in one array in
  `src/data/tutorials.ts`, separated by `optional?: boolean`. The Blender Previs
  chapter's two videos are a slug-specific block in `[slug].astro`.
- The sibling site `../ai-films` already has a journal built with a `glob()`
  content collection. This plan follows the same pattern.

### Basilica (read-only, `/Users/keremk/renku-movies/urban-basilica`)

- Decided 2026-10-17: the section shows the second take, `s03-p01-video-gsb7.mp4`,
  which used an ElevenLabs v4 six-line dialogue recording as its audio
  reference. "What the take was given" shows its five image and video
  references, including a Codex-made Mara sheet, plus the recording and the
  take's own direction text. The first take (`gn6p`) is described in the
  journal post.

- **Scene 03 · The Harbor Argument**, `EXT. Harbor Quarter - EVENING`. It has
  nine screenplay lines and seven Beats (revision
  `scene_beat_sheet_cpp7a9eh`).
  - Storyboards: Beats 1–4 from `storyboards/03/02-iteration/`, Codex built-in
    GPT Image 2.
  - Blender previs: three render revisions. Revision 3 (`previs-gt2m`, 17 s,
    silent) is already on the site as `harbor-blender-previs.mp4`.
  - Take: `s03-p01-video-gn6p.mp4`, MiniMax H3 Max on fal.ai, 15 s, 768p, with
    sound. It speaks the first four lines (Beats 1–4) and is already on the site
    as `harbor-generation.mp4`. Its stored request names five references and
    holds the direction text shown in the section.
  - Reference provenance: Urban's sheet and the lookbook sheet are fal.ai GPT
    Image 2. The location sheet is Codex GPT Image 2. Mara's sheet is
    "imported", with no record.
- **Scene 02 · The First Patron** (recipe): previs revision 6 (`previs-gkh9`,
  30 s, with dialogue audio and hard cuts), revision 1 (`previs-g51n`), and the
  take `s02-p02-video-ghm2.mp4`.
- **Harbor Quarter hero** `locations/harbor-quarter/hero-gmz0.png`: Codex
  built-in, selected (Quick Start step 05).

### Sintel (read-only, `/Users/keremk/renku-movies/sintel`)

- 14 Scenes, imported from `sintel-final-script.fdx`.
- **Scene 3**, `EXT - BACK ALLEY NEAR MARKET - DAY`: eight screenplay lines.
  Four Beat storyboards in `storyboards/3/00-iteration/` (`s3-b01-image-g403` …
  `s3-b04-image-gqdt`), recorded as Codex built-in `chatgpt-images-2.5`.
- No previs or takes yet. They are added to the section once they exist and
  have recorded provenance.
- The source film and script belong to the Blender Foundation (CC BY 3.0).
  The credit line is required wherever Sintel appears.

## Product Behavior

### Made with Renku (home, `#made-with-renku`)

The eyebrow reads "Made with Renku" and the heading reads "One scene, from the
page to the take." A film switch offers Basilica and Sintel; Basilica is
selected first. Each film shows, in order:

1. **The page**: the scene's lines, word for word from the project, set as a
   screenplay page.
2. **The storyboard**: four Beat storyboards with their Beat titles.
3. **The previs**: the latest revision with a poster frame, and a still of
   revision 1 at the same moment, to show that the staging changed.
4. **The take**: the video with a poster, captions, the model and provider, and
   "Voices and sound were generated with the video."
5. **What the take was given**: the reference pictures and the collapsed
   direction panel with the exact stored text.
6. Credit line, plus links to the journal post, the recipe and the sample
   project.

A film shows only the stages that have real media. There is no placeholder
copy. Videos never autoplay or preload; only posters load. Every number and
model name comes from the project records.

The film switch is a small client script that swaps visible panels and pauses
any playing video. It needs no framework.

### Quick Start step 05 (`#first-image`)

"05 · Make your first image" goes after "04 · Direct". Prompt example: "Create
a hero image for [a Location from your screenplay]." In Codex, the default
image route is Codex's built-in image tool and needs no provider key. Other
agents ask which provider to use, which needs a key from step 01. The figure is
a Studio screenshot of the Harbor Quarter location with its hero image. The
checkpoint reads: "The image appears on the Location in Studio." The eyebrow
changes to "Five steps", and the reading list gains the new step. The wording
is checked against the Media Producer route guide when it is written.

### Journal

- `/journal/`: newest first, showing the date, title and one-line description,
  with a link to the feed.
- `/journal/<post>/`: post page.
- `/journal/rss.xml`: RSS 2.0, summary only. Every page advertises it.
- Launch post: "How the harbor scene was made", drafted from project records.
  You add what did not work and why a second take was made, then approve it.

### Changelog (`/changelog/`)

Newest first. Each entry shows the version, the date, the notes, and "View on
GitHub". The page says Renku is in beta and links GitHub's release feed and
full release list. If no release has notes yet, the page waits for 0231's
first release with notes instead of shipping empty.

### Recipe: Previs a dialogue scene in Blender

`/tutorials/previs-a-dialogue-scene/`, built on Basilica Scene 02. The steps:
pick the scene and its dialogue, ask for a Blender previs, review the render,
direct changes (who is on screen while speaking, cuts, timing), compare
revision 1 with revision 6, then hand the reviewed revision to video
generation. Media: the revision 6 render with captions, a revision 1 still,
the "Clip 1" take, and a Studio screenshot of the previs plan. Copy is checked
against the Blender Shot Planner and Media Producer skills.

### Not in this plan

The About page, a Sintel recipe, music video support, new generation runs, the screen
recording, everything owned by 0231, 0232, 0234 and 0236, and any change to
Studio, Core, CLI, Engines or Studio Skills.

## Media Sources

The website README records each copied file with its source path and
transform.

| Website file | Source | Transform |
| --- | --- | --- |
| `src/assets/films/basilica/harbor/beat-01.png` … `beat-04.png` | `storyboards/03/02-iteration/s03-b01…b04` | copied unchanged |
| `src/assets/films/basilica/harbor/previs-poster.jpg`, `previs-revision-1.jpg` | `scenes/03/01-shot-plan/previs/renders/previs-gt2m.mp4`, `previs-gzbc.mp4` | one frame each, same moment |
| `src/assets/films/basilica/harbor/take-poster.jpg` | `scenes/03/01-shot-plan/s03-p01-video-gn6p.mp4` | one frame |
| `src/assets/media/harbor-blender-previs.mp4`, `harbor-generation.mp4` | existing | reused |
| `public/captions/harbor-take.en.vtt` | Scene 3 lines 2–5 | written; timing confirmed by playback |
| `src/assets/films/basilica/harbor/reference-*.jpg` | Urban, Harbor Quarter, Imperial Wound sheets; Mara only after confirmation | `sips -Z 1600`, JPEG 85 |
| `src/assets/films/sintel/scene-3/beat-01.png` … `beat-04.png` | Sintel `storyboards/3/00-iteration/s3-b01…b04` | copied unchanged |
| `src/assets/screens/location-hero-harbor-quarter.png` | Studio, Harbor Quarter location | screenshot 1440×900 @2x |
| `src/assets/media/first-patron-previs.mp4`, `first-patron-take.mp4` + stills, captions, plan screenshot | Basilica Scene 02 files named above | site's existing encode settings |

Screenshots come from a locally running Studio opened on each project. Nothing
in either project is edited.

## Architecture Shape Gate

### Ownership

All changes are in `packages/website`, plus two docs files. Pages render data,
data files own copy and media wiring, and content collections own Markdown.

### File layout

```text
packages/website/
  src/content.config.ts                  NEW  journal + releaseNotes collections only
  src/content/release-notes-loader.ts    NEW  GitHub Releases loader for releaseNotes
  src/data/article-dates.ts              NEW  date formatting shared by journal and changelog
  sitemap-integration.mjs                skips non-page files such as journal/rss.xml
  src/content/journal/how-the-harbor-scene-was-made.md  NEW
  src/pages/journal/index.astro          NEW
  src/pages/journal/[id].astro           NEW
  src/pages/journal/rss.xml.ts           NEW  RSS 2.0 endpoint
  src/pages/changelog.astro              NEW
  src/styles/article.css                 RENAMED from legal.css; adds Markdown body styles
  src/pages/privacy.astro, terms.astro, terms/2026-09-23.astro   class names → article-*
  src/data/made-with-renku.ts            NEW  films, scenes, stages, media, links
  src/components/MadeWithRenkuSection.astro  NEW  section markup, scoped styles, film switch
  src/pages/index.astro                  adds the section after WorkflowStrip
  src/components/ShotPlanningSection.astro   collapsed videos removed, link to #made-with-renku added
  src/data/tutorials.ts                  TutorialKind, section videos, recipe entries
  src/pages/tutorials/[slug].astro       group-aware labels, sidebar, pagination; data-driven videos
  src/pages/tutorials/index.astro        Recipes group
  src/pages/quick-start.astro            step 05
  src/components/SiteHeader.astro        Journal link
  src/components/SiteFooter.astro        Journal, Changelog
  src/layouts/BaseLayout.astro           RSS alternate link
  src/assets/films/{basilica,sintel}/*   NEW  stills, storyboards, references
  src/assets/media/*, src/assets/screens/*, public/captions/*.vtt   NEW
  README.md                              structure, journal, changelog, media sources
```

### Shapes

- `made-with-renku.ts` exports `madeWithRenkuFilms: MadeWithRenkuFilm[]`. Each
  film has `id`, `title`, `kind` label (for example "Animated short"),
  `credit`, `scene` (number, title, heading, `lines`), and optional `storyboard`,
  `previs`, `take` and `given` stages. A stage that is absent is not rendered.
  Adding Sintel's previs later is a data change only.
- `MadeWithRenkuSection.astro` renders that data. It holds no copy beyond the
  section heading and stage labels.
- `[slug].astro` reads group labels from one `tutorialKindPresentation`
  record. No new slug- or kind-specific branches. The Blender Previs video
  branch is removed.
- `content.config.ts` defines two collections. `rss.xml.ts` has one escaping
  function and no feed library. Changelog sorting compares versions
  numerically.

### Forbidden

- Network calls other than the changelog's GitHub Releases request.
- New npm dependencies, client frameworks or carousel libraries.
- A second lesson template or recipe renderer.
- Placeholder or "coming soon" copy; filenames or ids as visible captions.
- Media without recorded Renku provenance or your confirmation.
- Any write to the Basilica or Sintel projects.
- Reformatting existing files.

### Stop and revise the plan if

- 0231's notes contract stops being "GitHub Releases only";
- the Scene story layout needs a client framework or a heavy script;
- `[slug].astro` starts gaining kind- or slug-specific branches;
- a page's copy needs facts nobody can verify.

## Contracts

### Routes

| Route | Source |
| --- | --- |
| `/journal/` | `src/pages/journal/index.astro` |
| `/journal/<post-id>/` | `src/pages/journal/[id].astro`; id = Markdown filename |
| `/journal/rss.xml` | `src/pages/journal/rss.xml.ts` |
| `/changelog/` | `src/pages/changelog.astro` |
| `/tutorials/previs-a-dialogue-scene/` | recipe entry |

### Journal collection

`src/content/journal/<post-id>.md`, loaded with
`glob({ pattern: '*.md', base: './src/content/journal' })`. The frontmatter has
`title`, `description` (one sentence) and `date` (`YYYY-MM-DD`). Bad
frontmatter fails the build.

### Release notes collection

An inline loader requests
`https://api.github.com/repos/GoRenku/studio/releases?per_page=100`, keeps
published releases with non-empty notes, renders each body with
`renderMarkdown`, and fails the build when the request fails. The version and
date come from the tag and the publish date.

### Tutorial model (`src/data/tutorials.ts`)

- `export type TutorialKind = 'chapter' | 'guide' | 'recipe';`, and
  `Tutorial.kind` replaces `optional?: boolean`.
- `tutorialKindPresentation: Record<TutorialKind, { sidebarTitle; eyebrow;
  checkpointLabel }>`.
- `TutorialSection.videos?: { src; title; label; captions? }[]`, rendered with
  `preload="none"`. The Blender Previs chapter's video block becomes a section
  that uses this field.
- Chapter numbers count chapters only. The sidebar lists the current group.
  Previous/next links stay within the group, and the last entry of each group
  links to `/tutorials/`.

### Navigation

- Header: Features, Quick Start, Tutorials, **Journal**. It must fit at
  1024×768 with 0232's star control.
- Footer: **Journal** and **Changelog** at the start of 0232's "Renku project"
  row (this plan creates the row if it lands first).
- `BaseLayout` head: the RSS alternate link.
- Tutorials index: a Recipes group between the course and the guides.

## Implementation Slices

1. **Article stylesheet and content foundation**: rename the stylesheet, add
   Markdown body styles, and add the journal collection.
2. **Journal**: pages, feed, header and footer links, and the draft launch
   post. Done when you approve the post.
3. **Tutorial model**: kinds, section videos, group sidebar and pagination.
   Existing pages render as before apart from the sidebar and the last-chapter
   link.
4. **Changelog**: collection, page and footer link, once 0231 has shipped a
   release with notes.
5. **Made with Renku**: media for both films, captions, data file, section,
   home placement and the Shot Planning change. Starts after the credit lines.
6. **Recipe: previs a dialogue scene.**
7. **Quick Start step 05.**
8. **Documentation**, with each slice.

## Tests And Guardrails

- `astro check` and the content schemas.
- `xmllint --noout dist/journal/rss.xml`.
- An internal link and fragment audit over `dist/`, using a scratch script.
- A provenance audit: read-only `sqlite3` queries confirm the provider and
  model for every copied file in both projects.
- Copy checked against the skills named in each recipe and in step 05.

## Documentation

- `packages/website/README.md`: content collections, film assets, captions,
  adding a journal post, how the changelog updates (redeploy after a release),
  the RSS address, and the media source table.
- `docs/product/website-learning-guides.md`: step 05, tutorial kinds, recipes,
  and journal and changelog ownership.
- `docs/operations/distribution-and-release.md`: one sentence saying to
  redeploy the website after a release.

## Final Verification

- `pnpm --filter @gorenku/website check` and `pnpm build:website:cloudflare`.
- Feed validation and the link audit.
- Production preview at 1440×900 and 1280×720: the home page and the section
  (both films) compared with the Scene story mockup, the Shot Planning section after
  the change, Quick Start, the tutorials index, the Blender Previs chapter compared with
  production, each recipe, the journal, the changelog, Terms and Privacy.
- The header fits at 1024×768.
- Every video plays to the end with captions and no console errors. No video
  bytes load on the home page before a play click.
- `git diff --stat` and the full diff: no format churn, no large or tangled
  file, and nothing outside `packages/website` apart from the two docs files.
- Published by the maintainer. Both projects were only read, copied from and viewed.

## Completion Checklist

### Review

- [x] Credit lines answered; Mara's sheet resolved by using the second take's
      Codex-made sheet.
- [x] File layout matches the Architecture Shape Gate (plus the release-notes
      loader, date helper and sitemap fix listed there).
- [x] No new dependency, framework or extra network call.

### Content foundation and journal

- [x] `article.css` rename done; legal pages look unchanged.
- [x] Journal pages and feed build; the feed is well-formed; every page has the
      RSS link.
- [x] Header and footer links added; the header fits at 1024×768.
- [x] Launch post approved and published, with the maintainer's "What didn't
      work" section.

### Changelog

- [x] Loads GitHub Releases at build time and fails clearly if GitHub is
      unreachable.
- [x] Only releases with notes, newest first, each linked to GitHub.
- [x] Footer link added.

### Made with Renku

- [x] Media copied and recorded in the README for both films.
- [x] Credit lines present, including the Sintel CC BY credit with a license
      link.
- [x] Only media with a Renku generation record shown.
- [x] Harbor take captions confirmed by playback.
- [x] Section matches the Scene story mockup; the film switch works; absent
      stages render nothing.
- [x] Shot Planning collapsed videos removed; "See the whole scene" link works.
- [x] No video preloads or autoplays.
- [ ] Sintel previs and take added (later, when they exist).

### Tutorials and Quick Start

- [x] `TutorialKind` replaces `optional`; the Blender Previs chapter uses
      section videos and looks the same.
- [x] Group sidebar and pagination are correct.
- [x] Dialogue previs recipe published, checked against the skills, showing
      both selected clips and the two-clip explanation.
- [x] Captions on the recipe's joined two-clip video confirmed by playback.
- [x] Quick Start step 05 added and "Five steps" updated.

### Documentation and final checks

- [x] README and both docs updated.
- [x] Check, build, feed and link audit pass.
- [x] Desktop screenshots reviewed; videos play with captions.
- [x] Provenance audit matches the README.
- [x] Full diff reviewed; no format churn; no tangled files.
- [x] Published by the maintainer; both projects untouched.

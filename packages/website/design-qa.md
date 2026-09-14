# Learning pages design QA

Date: 2026-09-13

## Visual evidence

- Source visual truth: https://gorenku.com/download/.
- Implementation: http://127.0.0.1:4330/download/,
  http://127.0.0.1:4330/quick-start/, and
  http://127.0.0.1:4330/tutorials/.
- Screenshot evidence is embedded in the implementation conversation's browser
  outputs. The browser tool did not supply persistent screenshot file paths.
- Matched Download comparison: 1280 × 720 CSS pixels and image pixels, density 1,
  macOS selected, page top. Source and implementation screenshots were emitted
  together for comparison. An earlier 1440 × 1000 source capture was superseded
  because its viewport did not match the implementation.
- Additional desktop evidence: course hero and chapter grid, Inspiration chapter
  prompt-copy state, Quick Start hero, provider section, and Chrome video playback.
- Focused comparisons: original versus extended Download typography and header;
  chapter body and copy control; provider wordmark contrast before and after its
  correction. The final course screenshot uses the production build without the
  Astro development toolbar.

## Findings and corrections

- Resolved: the portrait Codex screenshot made the Quick Start hero too tall.
  Limit that figure to 370px wide while preserving the whole image and its ratio.
  The final screenshot includes the setup action and installation link.
- Resolved: black source provider wordmarks were unreadable on the dark surface.
  Invert the monochrome marks, matching the site's dark presentation. The final
  production-build provider screenshot shows all six marks clearly.
- Resolved: a long sticky chapter navigation could extend below a short desktop
  viewport. Bound its height and allow independent scrolling.
- Resolved: video containers initially had no reserved frame height. Reserve a
  16:9 area so loading video metadata does not move the following content.
- Intentional: Download adds the three-destination learning navigation and a
  Quick Start handoff. Hero spacing accommodates that navigation. Installation
  commands, platform switching, and the existing visual vocabulary remain intact.

## Required fidelity surfaces

- Typography: existing Fraunces Variable display face and IBM Plex Sans body
  face; readable body leading, restrained labels, and clear chapter hierarchy.
- Spacing: existing container width and radii, generous section divisions, bounded
  reading column, aligned chapter grid, and reviewed desktop sidebar behavior.
- Colors: existing ink, paper, and amber tokens; visible focus and selected
  navigation states; corrected provider contrast.
- Images: existing product screenshots and media, with optimized image sizes.
  Tutorial article images retain their aspect ratios. Card crops are intentional
  previews, with full images available in each chapter.
- Content: all requested workflow stages covered. Distinguishes Production and
  Storyboard Lookbooks, alternative Shot List/Previs approaches, imported FDX
  source authority, separately authored production records, and take generation
  versus final film assembly.

## Functional verification

- Astro check: 22 files, zero errors, warnings, or hints.
- Production build: 12 static pages generated successfully.
- Static audit: 259 internal links and fragments resolve across 12 pages.
- Browser: hub cards, section anchors, learning navigation, chapter navigation,
  prompt copy with success feedback, Windows installer tab, keyboard return to
  macOS, install-command copy, and Download-to-Quick-Start handoff verified.
- Media: both examples played to completion in Chrome: 17-second previs and
  15.104-second generated take, with no media errors or console errors observed.
- Environment limitation: Codex's in-app browser crashed on starting previs
  playback. Chrome verified the same page and media successfully. No browser-
  specific workaround was added to the website.
- Desktop only. No paid generation, credential submission, or public deployment
  was performed as part of website verification.

## Implementation checklist

- [x] Preserve the source site's typography, palette, and existing assets.
- [x] Implement all three destinations and eight chapter routes.
- [x] Verify workflow wording against Studio controls and owning documentation.
- [x] Inspect rendered pages and resolve identified visual issues.
- [x] Verify navigation, copy controls, and video playback.
- [x] Build, type-check, inspect changes, and check internal links.
- [x] Keep a production-build preview open for review.

No remaining actionable P0/P1/P2 website findings. The in-app media playback
limitation is recorded above; playback was verified in Chrome.

final result: passed

# Previs UI prototype

Working local preview: http://127.0.0.1:4177/

This is an isolated, presentation-only exploration for the Studio Shot Plans
workflow. It uses Studio's actual theme, shadcn controls, MediaCard and VideoPlayer.
It does not read or write a project database or submit media generation requests.

## Try the experience

- The initial Revision 3 shows equal-sized visualization and generation videos.
- Prev opens revisions without generations; the second pane stays in place with
  a quiet placeholder so the workspace does not jump.
- Play, scrub or use a cue to move through both videos together. The active cue
  receives an amber outline. Keyboard arrows also operate the shared timeline.
- Colored timeline lanes show the speaking range and action markers above the
  complete vertical cue list. Each row has a segment-play button. An optional
  cue audio file plays alongside the segment; the current scene has no separate
  voice recordings, so the demo uses video audio.
- Scroll Description in place, or expand it into a larger reading dialog.
- Shot Plans returns to the video card; opening the card returns to Previs.

Assets and Audio are context-only disabled tabs in this prototype. Cue copy and
Description are illustrative fixtures, not a transcription or a new domain contract.

## Design decisions to preserve

The selected direction combines Option 1's monitor with Option 2's lower panels:

1. Two fixed equal panes at every revision, with a quiet generation placeholder
   when absent, and no Compare button. The director revised the earlier adaptive
   layout preference after trying it: Prev/Next must not resize the workspace.
2. Equal video sizes in the paired state, one shared transport, and a fullscreen
   affordance on each video using the existing player.
3. A horizontal subject legend followed by cue timeline lanes and vertical playable
   cues on the left. The scrollable, expandable Description on the right uses the
   actual ShotDescriptionViewer from the Shot List, including its colored headings
   and highlighted terms, in both sizes.
4. Charcoal layered surfaces, fine borders, warm amber controls, coral/yellow/blue/
   purple subject dots, compact uppercase section labels, monospace timecodes,
   softly inset Description text and a precise amber active-cue border.
5. Studio's existing media-card presentation for the entry point: previs video,
   authored title and covered Beats.

The image references and screenshots are retained in this folder. The combined
mock is the layout target; the working prototype preserves original footage and
its aspect ratio instead of the image model's extrapolated movie frames. Extra
Beat 5–7 badges invented in the mock were deliberately omitted.

## Scope and review attention

- No routes, schemas, CLI commands, Settings, or durable project metadata changed.
- The only existing production source edit is
  `packages/studio/src/ui/video-player.tsx`: an imperative playback handle,
  optional timing/playback callbacks, and an external-controls presentation let
  this prototype reuse the player with one shared transport. Existing callers
  keep inline controls. Fullscreen still uses the existing implementation.
- This is not the production architecture proposal. Before integration, the plan
  must explicitly resolve how the existing opaque revision playback artifact is
  projected for display, how generation associations are obtained, and what
  revision changes preserve during playback. Do not promote fixture structures
  into core contracts without that review.
- The demo begins each revision paused at eight seconds for immediate comparison.
  Its 17-second previs and 15.104-second generation share elapsed time without
  speed changes; the shorter video holds its last frame. Treat that as a visible
  prototype assumption for UX feedback.
- Fullscreen verification is incomplete after the Codex in-app browser froze.
  Read `design-qa.md` and `fullscreen-investigation.md` for evidence and limits.

## Local media

The ignored `public/media` folder contains copies from the local Urban Basilica
project: the three `harbor_clean.mp4` revision renders, the existing
`s03-p01-video-gn6p.mp4` generation, and a revision-3 poster. Original movie files
were not modified. A fresh checkout requires those local copies.

The prototype borrows installed dependencies through its ignored `node_modules`
symlink to `packages/studio/node_modules`. No dependencies were installed.

From this directory, the local server command is:

```sh
node node_modules/vite/bin/vite.js --config vite.config.mjs
```

The formal implementation plan remains deferred until the director reviews this
experience. This folder is the design evidence for that plan.

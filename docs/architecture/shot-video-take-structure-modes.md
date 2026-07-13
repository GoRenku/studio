# Shot Video Take Structure Modes

Date: 2026-07-12

Status: current

Role: architecture reference

## Domain State

A Shot Video Take groups ordered Scene Shots under one of two design modes:

- `continuous`: all member Shots share one direction for an unbroken move;
- `multi-cut`: each member Shot owns a separate direction inside one generated
  video.

The current durable state is version 3:

```ts
type SceneShotVideoTakeState = {
  version: 3;
  structure:
    | { mode: 'continuous'; sharedDirection: SceneShotVideoTakeDirection }
    | {
        mode: 'multi-cut';
        directionsByShotId: Record<string, SceneShotVideoTakeDirection>;
      };
};
```

`SceneShotVideoTakeDirection` contains only non-generation design state:

- Composition;
- Camera Motion;
- Cast participation;
- Location choice;
- dialogue inclusion.

It contains no provider/model values, prompt state, reference selections,
prepared inputs, dependency data, estimate, or run state.

## Core Ownership

The focused workspace owns:

```text
listShotVideoTakes
readShotVideoTakeWorkspace
createShotVideoTake
discardShotVideoTake
setShotVideoTakePicked
replaceShotVideoTakeShots
setShotVideoTakeStructure
setShotVideoTakeDirection
setShotVideoTakeGenerationSpec
attachShotVideoTakeOutput
```

Take commands validate Scene, active Shot List, Shot membership, structure, and
file ownership before durable writes. Invalid replacement or direction state
fails with structured diagnostics and leaves the take unchanged.

Changing from continuous to multi-cut copies the selected source direction into
each member Shot. Changing from multi-cut to continuous copies one deliberate
source Shot direction. Callers must identify the source when more than one
interpretation is possible; Core does not guess creative intent.

## Generation Separation

The active generation request is one generic `shot.video-take` spec targeted at
the Take. Exact First Frame, Last Frame, Video Prompt Sheet, general, Lookbook,
Cast, Location, and dialogue audio references live in that spec through stable
guide placements. Provider/model fields and prompt values also live in the
spec. A `GenerationRun` stores the immutable direct request, output, and
receipt.

The take workspace composes this generic session for Studio but does not write
generation values into version-3 state. Input modes and controls are projections
of Engines field semantics. Provider validation—not Shot structure—decides
whether a request can run.

Agent and CLI reads use:

```bash
renku generation context --purpose shot.video-take --target take:<take-id> --json
renku generation spec show --spec <spec-id> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
```

There is no take-authoring document, generic state patch, input inventory,
preflight graph, production plan, automatic prompt draft, or recursive estimate.

## Media And Trash

Final video is attached through the focused `shot.video-take` attachment and is
owned by the Take. Exact generated reference revisions with no other domain
owner are owned through the Take spec. Reusable Cast, Location, and Lookbook
assets retain their own domain relationships.

Discarding a Take is recoverable. Core discards the take row, membership rows,
final-video row, and exclusive take-owned files in one Trash operation. It does
not discard shared domain references. Restore reinstates the same take design,
membership, picked state when conflict-free, and exclusive media.

## Studio Compatibility

Studio preserves the existing Shot rail, Composition, Motion, Dialogs,
References, AI Production, Takes, autosave, save notification, picker, playback,
deep-link, and delete/restore behavior. React sends user intent to focused Core
commands and never reconstructs asset eligibility or provider rules locally.

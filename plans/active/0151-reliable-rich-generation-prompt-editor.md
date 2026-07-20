# 0151 Reliable Rich Generation Prompt Editor

Status: complete
Date: 2026-07-20
Completed: 2026-07-20

## Summary

Replace the broken `prism-react-editor` prompt surface with a deliberately
configured CodeMirror 6 editor that behaves like a polished Renku document,
not a code editor.

The current editor draws editable text and highlighted text through separate
layers. Those layers do not share the same padding or geometry, so the visible
caret can appear several lines away from the text being edited. Reference
completion and preview are also positioned by feature-owned pixel calculations,
and the current tests replace browser geometry APIs with fakes. The result can
pass JSDOM tests while being unusable in a real browser.

The smallest useful correction is confined to the Studio frontend:

- keep the current exact prompt string, reference-mention envelope, Preview
  update workflow, and read-only inspector contract unchanged;
- put CodeMirror's mechanical React lifecycle behind one narrow local
  `src/ui` control, while keeping Markdown presentation, `@ReferenceN`
  completion, reference decoration, and image preview in the owning
  `generation-request-editor` feature;
- use only the specific CodeMirror packages required for editing, Markdown,
  completion, and tooltip behavior; do not use the `codemirror` convenience
  package or `basicSetup`;
- remove `prism-react-editor`, its mirrored-layer styling, its geometry helpers,
  and its tests;
- add real Chromium coverage for caret placement, selection, scrolling,
  completion, undo, and hover/caret preview;
- require every direct package-manager invocation made for this implementation
  to run as `sfw pnpm ...`. No dependency command may be retried with direct
  `pnpm` if Socket Firewall fails, warns, or blocks.

No production code or dependency is changed by this plan itself.

## Requirement Ledger

| ID | Requirement | Source | Implementation owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Typing, selection, scrolling, paste, undo/redo, and the visible caret use one editor-managed document surface; there is no mirrored editable/highlight overlay. | User report and screenshot | `CodeMirrorEditor` control plus `PromptEditor` feature composition | Chromium interaction tests and one real-project desktop verification |
| R2 | The prompt looks like the 0149 prototype's readable editorial document, not a stock code editor. | User request and completed plan 0149 UX contract | `prompt-theme.ts` | Locked dark/light screenshots and manual comparison |
| R3 | `@ReferenceN` is visibly distinct and supports rich thumbnail completion plus rich hover and caret preview. | User request, Decision 0057, and plan 0149 | Feature-owned completion and preview modules | Feature tests and Chromium completion/preview journeys |
| R4 | Prompt text remains an exact opaque string, including LF, CRLF, bare-CR, and mixed line endings. Markdown and mention recognition are presentation-only, use CodeMirror document offsets internally, and never validate, repair, rewrite, or route creative contents. | Decision 0041 and `AGENTS.md` | `CodeMirrorEditor` serialization plus feature extensions | Uniform and mixed-ending round-trip, post-CRLF mention-range, controlled-replacement, and unknown-mention tests |
| R5 | Editable Generation Preview, negative prompt, frozen Preview, and the read-only Generation Request inspector use the same editor behavior appropriate to their state. | Current shared request editor and plan 0150 | Existing `GenerationRequestPromptPanel` caller path | Editable/read-only component and browser tests |
| R6 | Remove the yellow vertical focus rail. Focus must not move content or introduce code-editor chrome; caret and selection remain visible. | Explicit user feedback | `prompt-theme.ts` | Screenshot and computed-style assertions |
| R7 | All direct `pnpm` commands issued for this implementation, especially dependency add/remove commands, go through Socket Firewall using `sfw pnpm ...`; warnings, blocks, or firewall startup failures stop the work. | Explicit user security requirement | Implementation workflow | Command record, manifest/lockfile inspection, and checklist |
| R8 | Tests must exercise real browser geometry so a displaced caret or popover cannot pass because DOM measurements were mocked. | User's test concern and current test gap | Playwright regression suite | Real Chromium click/type/scroll/anchor tests |
| R9 | `PromptEditor` and every prompt-specific behavior stay in the owning Generation Request feature. CodeMirror construction crosses the required local-control boundary through one domain-neutral `CodeMirrorEditor`; that control must not become a rich-editor framework or learn prompt semantics. | `AGENTS.md`, Decision 0057, plan 0149, and the existing raw-control guardrail | `src/ui/code-mirror-editor.tsx` plus focused feature modules | Existing raw-control guardrail and architecture-shape review |

Every implementation slice and checklist item below traces to one or more of
these requirements. The plan adds no generation-domain behavior, server
contract, Core command, storage field, or prompt semantic rule.

## Product Behavior

### Prompt document

The Prompt tab remains a calm document surface inside the existing desktop
dialog:

- a centered text column with a maximum width around `790px`;
- approximately `15px` Montserrat body text and `1.7` line height;
- transparent editor background with no input border, gutter, line numbers,
  active-line fill, minimap, bracket UI, fold markers, or monospace default;
- deliberate top and bottom document space matching the prototype's rhythm;
- visible authored Markdown source before, during, and after focus;
- accessible distinction for headings, Markdown markers, lists, emphasis,
  links, and code in light and dark themes;
- word wrapping, spellcheck, copy/paste, ordinary selection, and native-feeling
  undo/redo;
- one internal scrolling surface with no footer overlap or dialog scroll bleed;
- no yellow vertical focus rail and no layout change on focus.

CodeMirror may maintain its own cursor, selection, completion, and tooltip DOM.
That is control-owned behavior around one editable document; it must not render
a second copy of the prompt under or over the editable content.

### Reference completion

Typing `@` at the existing accepted text boundary opens CodeMirror's completion
UI at the active document range. It lists only selected image references that
have a projected `promptMention`.

Each option shows:

- the real `64px × 40px` thumbnail;
- the meaningful reference label;
- the exact mint-colored mention such as `@Reference1`.

The menu keeps the prototype's compact dark/light popover treatment and
approximately `356px` width while remaining inside the dialog. It supports
ArrowUp, ArrowDown, Enter, Tab, Escape, and pointer selection. Accepting an
option replaces only the active `@...` query and creates one CodeMirror
transaction, so one undo restores the partial query.

CodeMirror owns range tracking, keyboard selection, anchoring, viewport
clamping, and scrolling. Feature code must not calculate completion `left` or
`top` coordinates.

### Reference styling and preview

Known exact mention values are decorated in mint with a quiet translucent hover
or caret-active background. Unknown or cleared-reference mention-like text stays
ordinary prompt text.

Hovering a known mention, or placing the caret inside it, shows a rich preview
anchored to that exact range:

- approximately `328px` wide;
- a `312px × 174px` contained image;
- the meaningful reference title;
- Studio-safe image URL and meaningful alternative text;
- placement that stays within the dialog and avoids covering the active token
  when room is available.

The preview uses CodeMirror's documented tooltip facilities. The feature
provides the image and text DOM; it does not own pixel positioning.

### Exact text and read-only behavior

- The existing `value` and `onValueChange` contract remains controlled by the
  request editor.
- External value changes update the CodeMirror document without emitting a
  duplicate user edit.
- Editable prompts emit the exact CodeMirror document string after a document
  transaction.
- LF, CRLF, bare-CR, and mixed-ending documents retain every untouched authored
  separator across unrelated edits and external controlled replacements.
  Internally, CodeMirror uses one normalized LF document so every authored line
  break remains a real editor line; newly inserted lines use the prevailing
  separator convention of the current controlled value.
- Exact external serialization and internal editor coordinates remain distinct:
  the local control maps CodeMirror changes back onto the exact serialized
  value, while mention queries, replacement ranges, decorations, and previews
  use CodeMirror's normalized document text and offsets. Serialized string
  indexes must never be passed back as CodeMirror positions.
- Read-only prompts can be selected and copied, cannot be changed, do not offer
  completion, and still support keyboard focus plus known-reference hover and
  caret preview. CodeMirror remains DOM-editable/focusable while
  `EditorState.readOnly` blocks typing, paste, and document-changing commands;
  the content exposes `aria-readonly='true'`.
- Negative prompts use the same typography and editing mechanics. They receive
  completion only when the same selected references are currently projected,
  matching the existing caller contract.
- Prompt contents never add, remove, select, attach, validate, or route a
  reference.

## Explicit Non-Goals

This plan does not:

- redesign Prompt, References, Config, diagnostics, estimate, or dialog
  navigation;
- change generation Preview, GenerationSpec, reference, mention-allocation,
  update, or inspector DTOs;
- restore the Image Revision workflow removed by plan 0150;
- add a general mention, autocomplete, hover-card, rich-text, or Markdown
  framework to `src/ui`; the one permitted `CodeMirrorEditor` control is only a
  mechanical adapter around the third-party interactive control;
- render a Markdown preview or hide/reformat authored Markdown syntax;
- validate prompt structure, headings, references, wording, or creative
  meaning;
- add formatting toolbars or code-editor commands;
- use Monaco, Tiptap, Lexical, or another second editor dependency;
- support mobile layouts;
- preserve Prism as a fallback, compatibility path, or alternate editor;
- manually edit `packages/studio/package.json` or `pnpm-lock.yaml` to simulate a
  package-manager result;
- bypass, disable, or retry around Socket Firewall.

## Context And Evidence

### Accepted product and architecture constraints

- `AGENTS.md` requires local Shadcn-style controls, opaque prompt contents,
  desktop-first verification, no compatibility layers, focused code shape, and
  preservation of unrelated working-tree changes.
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md` permits exact,
  presentation-only Markdown and mention tokenization but forbids creative
  prompt interpretation.
- `docs/decisions/0057-use-model-routed-human-readable-generation-prompts.md`
  makes rich image-reference completion and preview a feature-owned Generation
  Request behavior rather than a generic `src/ui` autocomplete framework.
- `docs/architecture/reference/front-end-guidelines.md` and `AGENTS.md` keep
  interactive controls behind local `src/ui` primitives. CodeMirror creates
  its textbox programmatically rather than through raw feature JSX, but using
  that implementation detail to bypass the local-control boundary would be
  brittle. A narrow `CodeMirrorEditor` therefore owns only the third-party
  control lifecycle; Decision 0057 and plan 0149 still keep every prompt,
  mention, and preview decision feature-owned.
- `docs/product/design-guidelines.md` supplies Studio typography, theme tokens,
  popover surfaces, focus language, and desktop dialog conventions.
- `plans/active/assets/0149-image-generation-review-design/prototype.html` is
  the deterministic visual reference for the document, Markdown treatment,
  reference completion, and preview. Its hand-authored `contenteditable`,
  manual positioning, `execCommand`, and yellow focus rail are not production
  implementation requirements.

### Current implementation evidence

- `generation-request-prompt-editor.tsx` imports `prism-react-editor` directly,
  stores an editor ref, renders completion and preview as absolutely positioned
  siblings, calculates hover offsets with `document.caretRangeFromPoint`, and
  uses the external editor's insertion helper.
- `generation-request-prompt.css` pads `.pce-line` independently from the
  mirrored Prism editor layers and adds the rejected yellow focus rail.
- `generation-request-prompt-editor.test.tsx` replaces `document.execCommand`
  and `document.caretRangeFromPoint` with fakes. JSDOM never verifies real
  caret/text alignment, scrolling, or popover anchoring.
- There is no Playwright coverage for Generation Preview prompt editing. The
  existing `.e2e.test.tsx` file is a JSDOM integration test despite its name.
- `prism-react-editor` is a direct dependency of `@gorenku/studio`; CodeMirror
  and Lezer are not currently present in `packages/studio/package.json` or the
  lockfile.
- The current Prism light/dark style files have no production consumer outside
  this prompt editor.
- `packages/studio/src/features/generation-request-editor/` already serves both
  editable Generation Preview and the read-only inspector being implemented by
  plan 0150. The replacement must preserve that shared path.

### Overlapping work and working-tree boundary

- Plan 0131 is complete historical evidence for the original Prism choice. It
  is not revised.
- Plan 0149 is complete and remains the accepted product behavior and visual
  source. This plan corrects its editing-control implementation and browser-test
  gap; it does not reopen its generation-domain decisions.
- Plan 0150 is implemented in the current baseline. It removes Image Revision
  and adds the read-only Generation Request inspector. This plan targets the
  surviving shared prompt editor and must not restore or modify the removed
  Image Revision modules.
- `design-qa.md` records the 0149 manual browser review, but that review and the
  existing JSDOM tests did not prevent the real caret-geometry regression. New
  verification therefore adds durable Playwright screenshots and real Chromium
  interaction assertions rather than treating the historical QA record as
  sufficient automated evidence.

### External control evidence

The implementation relies only on documented CodeMirror 6 extension points:

- themes and proportional document typography:
  <https://codemirror.net/examples/styling/>;
- Markdown and range decorations:
  <https://codemirror.net/examples/decoration/>;
- completion sources and exact range application:
  <https://codemirror.net/examples/autocompletion/>;
- anchored hover and state-driven tooltips:
  <https://codemirror.net/examples/tooltip/>;
- rich completion rendering and classes:
  <https://codemirror.net/docs/ref/#autocomplete>.

Socket Firewall Free documents `pnpm` as a supported package manager and the
required prefix form `sfw <package-manager> ...`:
<https://docs.socket.dev/docs/socket-firewall-free>.

## Right-Sized Change Decision

### Option 1: reuse the current editor contract unchanged

Rejected. The current control's mirrored editable/highlight layers and the
feature's manual geometry are the source of the unusable caret and fragile
popover behavior. Adjusting padding, line height, or offsets would be the exact
alignment patch the user rejected and would leave the architecture unchanged.

### Option 2: replace the control inside the existing owner

Accepted. Rename the sole feature entrypoint to `PromptEditor`, preserve its prop
shape, the current mention DTO, and all generation contracts, and replace only
the low-level editing engine. Put the mechanical third-party control lifecycle
behind the narrow local `CodeMirrorEditor` boundary required for Studio
controls, and split the feature-owned presentation interactions into focused
CodeMirror extensions. This introduces no generation-domain or generic rich
editor concept and deletes the obsolete control in the same implementation
slice.

### Option 3: introduce a general rich-editor platform

Rejected. There is one current product need. A generic editor registry,
cross-feature mention framework, configurable toolbar, schema-driven token
system, or second representation would add concepts unsupported by the
requirement ledger and conflict with Decision 0057.

## Architecture Shape Gate

### Ownership and intended module layout

`packages/studio` owns the entire change. Core, Engines, CLI, Studio server, and
Studio Skills contracts remain unchanged.

```text
packages/studio/src/ui/
  code-mirror-editor.tsx
  code-mirror-editor.test.tsx

packages/studio/src/features/generation-request-editor/
  prompt-editor.tsx
  prompt-editor.test.tsx
  prompt-theme.ts
  prompt-reference-completion.ts
  prompt-reference-preview.ts
  prompt-mentions.ts
  prompt-mentions.test.ts
  generation-request-prompt-panel.tsx

packages/studio/e2e/
  fixtures/studio-e2e-generation-preview.ts
  tests/regression/prompt-editor.regression.spec.ts
```

`code-mirror-editor.tsx` is a narrow, domain-neutral local control adapter. It
owns creation and destruction of one CodeMirror `EditorView`, controlled
exact-string synchronization, lossless line-ending serialization, read-only and
editable state, accessibility, placeholder, spellcheck, and the structural
host. It accepts the focused CodeMirror extensions composed by its caller but
does not provide an extension registry, default rich-editor setup, Markdown,
mentions, completion, preview, images, generation concepts, or Studio product
styling.

`prompt-editor.tsx` is the feature entrypoint used by
`GenerationRequestPromptPanel`. It renders the local `CodeMirrorEditor` and
owns the shallow composition of the prompt theme, Markdown, completion,
preview, history, and editing extensions. It does not construct an
`EditorView`, render a raw textarea, input, button, dialog, or `contenteditable`
control, or move prompt-specific behavior into `src/ui`.

`prompt-theme.ts` owns the CodeMirror theme, proportional
document typography, Markdown highlight style, known-reference decoration
classes, completion/tooltip visual treatment, light/dark token usage, and the
explicit absence of code chrome and the yellow focus rail.

`prompt-reference-completion.ts` adapts the pure mention-query/filter result to
CodeMirror completion, owns the rich option DOM, applies the exact replacement
range, and adds the Tab acceptance binding. CodeMirror retains its ordinary
Arrow/Enter/Escape behavior and transaction history.

`prompt-reference-preview.ts` owns only exact known-mention
decorations, hover tooltip content, caret tooltip state, and safe image/title
DOM. It uses CodeMirror document offsets and tooltip placement, never browser
point-to-text conversion or feature-owned coordinates.

`prompt-mentions.ts` remains the single pure owner for query boundaries,
filtering, replacement ranges, and exact known-mention range lookup. It may be
adjusted to consume the normalized `state.doc` text and explicit CodeMirror
document offsets, but it must not consume separator-aware external
serialization, inspect creative meaning, or mutate the prompt.

The Playwright fixture creates two Core-backed requests with the same realistic
long prompt and two selected image references:

1. a mutable `agent-external` GenerationSpec whose current
   `GenerationPreviewResource` opens through the existing
   `renku:generation-preview-requested` coordination event for editable tests;
2. a second `agent-external` GenerationSpec that is frozen and used as
   `sourceSpecId` when attaching a Character Sheet fixture, so the existing
   card action and inspector GET route can open a real read-only saved request.

The fixture calls `createGenerationSpec`, `buildGenerationPreview`, and then
`buildGenerationPreviewResource` for the mutable request, returning that
browser resource for the coordination event. It separately calls
`createGenerationSpec`, `freezeGenerationSpec`, and `attachGenerationMedia`
for the inspector request, returning the attached Asset and AssetFile ids. It
does not treat the internal Preview as a browser resource, compose a synthetic
inspector response, write SQLite directly, or add a production-only testing
route.

### Public entrypoints and contracts

The existing feature contract remains:

```ts
interface PromptEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  mentions: GenerationPromptReferenceMention[];
  readOnly?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}
```

The local `CodeMirrorEditor` contract is intentionally limited to mechanical
control concerns: controlled text, edit notification, read-only state,
accessible label, placeholder, spellcheck, class name, and caller-composed
CodeMirror extensions. It is not exported from a package barrel and is not a
prompt or rich-editor API. No new Studio feature `index.ts`, registry, provider,
hook, service, route, diagnostic code, DTO, or persistent state is added.

```ts
interface CodeMirrorEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  extensions: readonly Extension[];
  readOnly?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
  spellCheck?: boolean;
}
```

The `extensions` prop is the native typed CodeMirror composition seam required
by the owning feature, not an application registry or a Studio-specific preset
system. `CodeMirrorEditor` supplies no default prompt behavior through it.

### Exact dependency boundary

Install only packages directly imported by the implementation:

- `@codemirror/state`;
- `@codemirror/view`;
- `@codemirror/commands`;
- `@codemirror/language`;
- `@codemirror/lang-markdown`;
- `@codemirror/autocomplete`;
- `@lezer/highlight`.

Do not install the `codemirror` convenience package, a premade code theme, a
React CodeMirror wrapper, or a second tooltip/autocomplete package.

All dependency operations use Socket Firewall:

```bash
sfw pnpm --filter @gorenku/studio add \
  @codemirror/state \
  @codemirror/view \
  @codemirror/commands \
  @codemirror/language \
  @codemirror/lang-markdown \
  @codemirror/autocomplete \
  @lezer/highlight

sfw pnpm --filter @gorenku/studio remove prism-react-editor
```

The implementation must not run these commands unwrapped, manually edit the
manifest or lockfile in their place, accept a Socket warning without explicit
user direction, or retry outside `sfw`. If `sfw` cannot initialize, the slice is
blocked until its environment is corrected.

### Files that disappear or shrink

- Delete `generation-request-prompt.css`; its Prism selectors, layer padding,
  and yellow focus rail have no replacement CSS file.
- Delete `src/styles/prism-renku-light.css` and
  `src/styles/prism-renku-dark.css` after confirming no other production
  imports remain.
- Remove all `prism-react-editor` imports and the dependency/lockfile entries.
- Remove `textOffsetAtPoint`, `caretRangeFromPoint`, the manual absolute
  completion/preview siblings, and the Prism editor ref from
  the current `generation-request-prompt-editor.tsx` while replacing that file
  directly with `prompt-editor.tsx`; update its panel import with no alias or
  compatibility re-export.
- Remove JSDOM mocks of `execCommand` and `caretRangeFromPoint`.
- Keep `generation-request-prompt-panel.tsx` and
  `generation-request-editor.tsx` thin; they should require no product behavior
  changes beyond consuming the replacement editor.

### Forbidden code shape and stop conditions

Stop and revise before continuing if any of these occurs:

- `basicSetup`, the `codemirror` convenience package, line numbers, gutters,
  code folding, bracket matching, a stock code theme, or another coding-oriented
  extension appears;
- feature JSX renders a raw textarea, `contenteditable`, button, input, dialog,
  or another interactive browser control, or constructs `EditorView` directly;
  the only interactive editing DOM is created and owned by CodeMirror through
  the local `CodeMirrorEditor` control;
- the editor renders a second copy of the prompt for highlighting;
- completion or preview positioning uses point-to-text conversion, document
  mouse coordinates, hard-coded `left`/`top`, or a feature-owned placement
  algorithm. The one allowed geometry read is the prompt scroll surface's
  rectangle supplied through CodeMirror's documented `tooltipSpace`
  configuration so CodeMirror, not feature code, performs placement;
- insertion uses `execCommand`, DOM mutation, or a value splice outside a
  CodeMirror transaction;
- `src/ui` learns about Generation Preview, reference mentions, images, or
  prompt semantics;
- `CodeMirrorEditor` gains a toolbar, Markdown setup, mention behavior, product
  theme, schema, preset registry, or any default richer than the mechanical
  control contract;
- a generic extension registry, autocomplete framework, token schema, or
  rich-prompt abstraction appears;
- prompt parsing affects validation, persistence, provider routing, or
  reference selection;
- Prism remains as a fallback or compatibility path;
- a direct package command for this implementation is invoked without the `sfw`
  prefix or Socket Firewall is bypassed after a warning, block, or startup
  failure;
- the working implementation cannot match the prototype's visual hierarchy
  without exposing stock CodeMirror chrome;
- unit tests pass but the real Chromium caret/scroll/anchor regression fails;
- the change starts modifying Core, Studio server, CLI, Engines, durable data,
  or plan 0150's removed Image Revision workflow.

## Contracts

### Unchanged domain and browser contracts

- `GenerationPreviewResource` and selected reference projections remain
  unchanged.
- `GenerationPromptReferenceMention` retains `value`, `label`, and
  `previewImageUrl`.
- `promptMention` allocation, uniqueness, replacement, clearing, and Core
  validation remain unchanged.
- Preview Update continues to receive the exact authored and optional negative
  prompt strings from existing draft state.
- The inspector continues to pass the same editor path `readOnly`.
- Unknown or cleared mentions remain valid opaque text.

### Local control contract

`CodeMirrorEditor` is controlled and domain-neutral. It must:

- instantiate one editor view per mounted control and destroy it on unmount;
- receive caller-composed CodeMirror extensions without owning or cataloguing
  their feature behavior;
- keep one normalized LF CodeMirror document while retaining the exact LF,
  CRLF, bare-CR, or mixed separators in the controlled-value boundary;
- map CodeMirror document changes back onto the exact serialized value,
  preserving every untouched separator and using the prevailing current
  convention for newly inserted lines;
- when an external controlled replacement changes content or line-ending
  conventions, update both representations without emitting a user callback;
- compare the external `value` against the exact serialized boundary value and
  replace the normalized document only when its normalized text differs;
- emit `onValueChange` once for each user document transaction batch;
- apply `EditorState.readOnly.of(true)` for read-only text while leaving
  `EditorView.editable` enabled so the content remains focusable, selectable,
  copyable, and caret-aware;
- expose `aria-readonly='true'`, the supplied accessible label, placeholder,
  spellcheck, and class name;
- expose no prompt, Markdown, mention, completion, preview, or image contract.

The exact serialized value is confined to this local control's external
controlled-value boundary. It must not supply strings or offsets to feature
extensions.

### Feature editor contract

`PromptEditor` is controlled and feature-owned. It must:

- render the local `CodeMirrorEditor` rather than constructing a third-party
  interactive control in feature code;
- preserve its existing `PromptEditorProps` caller contract;
- supply the prompt scroll surface as CodeMirror's available tooltip rectangle
  without calculating popover coordinates itself;
- compose all prompt-specific CodeMirror extensions in the owning feature;
- derive mention query, replacement, decoration, hover, and caret-preview ranges
  from `state.doc`, `state.doc.toString()`, or `sliceString()` so every numeric
  position remains in CodeMirror's one-unit-per-line-break coordinate system;
- never combine a position from CodeMirror with an index into the exact
  externally serialized prompt string;
- keep Markdown, mentions, completion, previews, reference images, and the
  product theme out of the local UI control.

### Feature extension contracts

The feature composes only the required editor facilities:

- history and ordinary text-editing key bindings;
- line wrapping and spellcheck;
- Markdown language and Renku highlight style;
- exact known-reference decoration;
- selected-reference completion;
- hover and caret reference preview;
- read-only and accessibility compartments;
- one bounded CodeMirror tooltip configuration shared by completion and preview;
- the Renku document, completion, and tooltip theme.

The feature does not import or use CodeMirror's `basicSetup`.

## Implementation Slices

### Slice 0: settle overlap and capture the broken baseline

Before editing:

- inspect the current worktree and confirm plan 0150 remains implemented in the
  baseline;
- confirm the old Image Revision modules remain out of scope;
- capture the broken current Generation Preview Prompt state at the approved
  desktop viewport and record the exact caret displacement, yellow rail,
  missing mention styling, and manual popover behavior;
- confirm the current `urban-basilica` Imperial Council Chamber Preview still
  reproduces the problem;
- search all current Prism imports and all consumers of the shared prompt
  editor;
- stop for user coordination rather than overwrite unrelated changes if a
  planned file gains overlapping edits after this plan is approved.

This baseline is evidence only. Do not adjust current Prism padding or add a
temporary alignment patch.

### Slice 1: acquire and verify the focused dependencies through Socket Firewall

From the repository root:

1. run `sfw --help` or `sfw pnpm --version` to prove the firewall can start;
2. run the exact `sfw pnpm --filter @gorenku/studio add ...` command listed in
   the Architecture Shape Gate;
3. stop immediately on any warning, block, prompt requiring a security choice,
   or firewall failure; do not use direct `pnpm` as a fallback;
4. inspect `packages/studio/package.json` and the complete `pnpm-lock.yaml`
   diff for only the seven direct dependencies and their CodeMirror/Lezer
   transitive closure;
5. record the installed `sfw` version and the dependency command outcome in the
   implementation handoff.

Do not remove Prism until the replacement code is ready in the same working
slice; do not leave both editors as a selectable runtime path.

### Slice 2: add the local control boundary and replace the feature-owned prompt editor

Add the narrow `src/ui/code-mirror-editor.tsx` control, replace
`generation-request-prompt-editor.tsx` directly with `prompt-editor.tsx`, update
`generation-request-prompt-panel.tsx` to import `PromptEditor`, and add the
focused theme, completion, preview, and mention modules named by the
Architecture Shape Gate. Do not leave a compatibility re-export or old-name
wrapper.

Implementation requirements:

- preserve the existing prop contract and every caller;
- keep EditorView lifecycle, controlled synchronization, lossless uniform and
  mixed line-ending preservation, read-only state, and accessibility in
  `CodeMirrorEditor`;
- keep one normalized internal CodeMirror document and map its changes back to
  the exact serialized controlled value without rewriting untouched line
  endings;
- use normalized CodeMirror document text for every mention helper and keep all
  query, replacement, decoration, hover, and preview offsets in CodeMirror's
  document coordinate system, including after multiple CRLF lines;
- keep all Markdown, theme, mention, completion, preview, and image behavior in
  `PromptEditor` and its focused feature modules;
- compose explicit CodeMirror extensions rather than `basicSetup`;
- use `EditorView.theme`, `HighlightStyle`, and Studio CSS variables for the
  editorial appearance;
- retain visible Markdown syntax and exact authored whitespace;
- use CodeMirror completion range application and history;
- provide the thumbnail/title/token option DOM through the documented
  autocomplete rendering API;
- decorate only exact provided mention values;
- provide hover and caret preview through CodeMirror tooltips;
- configure CodeMirror's shared tooltip boundary with the prompt scroll
  surface through `tooltipSpace`, allowing CodeMirror to flip, clamp, and place
  completion and preview without feature-calculated coordinates;
- keep rich completion and tooltip DOM non-interactive except for the
  CodeMirror-owned option selection;
- preserve read-only selection/copy and reference preview;
- preserve negative-prompt behavior;
- remove all feature-owned coordinate calculations and external editor refs.

After the feature replacement is functional, remove Prism through the exact
`sfw pnpm ... remove` command, delete its unused CSS, and inspect the dependency
diff again.

### Slice 3: replace false-confidence tests with owning-layer and browser coverage

Update pure helper tests for:

- `@`, partial, and full queries at accepted boundaries;
- exact replacement range;
- label and mention filtering;
- repeated exact mention ranges;
- unknown and cleared mention text;
- known-reference lookup at start, middle, and end boundaries;
- partial-query replacement, exact known-mention decoration, and caret/hover
  preview lookup after multiple normalized line breaks corresponding to a CRLF
  controlled prompt; assert the returned ranges are CodeMirror document
  offsets, not serialized CRLF string indexes.

Add `src/ui/code-mirror-editor.test.tsx` coverage for:

- one `EditorView` lifecycle, cleanup, and controlled replacement without a
  duplicate callback;
- exact LF input after an unrelated edit and exact CRLF input after an
  unrelated edit;
- an external LF-to-CRLF and CRLF-to-LF controlled replacement, followed by an
  edit, proving the replacement convention is retained;
- mixed LF, CRLF, and bare-CR input plus an external mixed-ending replacement,
  proving every break is a real CodeMirror line and untouched separators remain
  exact after edits on both sides of those breaks;
- newly inserted lines use the prevailing separator convention of the current
  controlled value;
- read-only, accessible label, placeholder, spellcheck, focus, and selection
  mechanics without any prompt-specific extension.

Update `prompt-editor.test.tsx` with focused owning-feature coverage for:

- one representative controlled prompt edit through the local control;
- feature composition in editable and read-only prompt states;
- one accepted completion transaction with the exact replacement range;
- incremental typing from `@` recomputes token and label matches, and an
  unmatched query closes completion instead of retaining stale options;
- correct hover/caret preview content from the supplied safe URL;
- one CRLF-controlled prompt with a partial query and known mention after
  multiple line breaks, proving completion replacement, decoration, and
  caret/hover preview all use the correct CodeMirror ranges;
- no reference-selection or routing callback caused by prompt interactions.

Do not repeat the full Enter/Tab/Escape/pointer/undo matrix here. Those real
browser interactions belong in the Chromium journey below.

Update
`packages/studio/src/features/generation-request-inspector/generation-request-inspector-dialog.test.tsx`
to stop asserting a native textarea `readonly` attribute. Assert the accessible
CodeMirror textbox exposes `aria-readonly='true'`, can receive focus, and does
not emit a prompt change.

Delete `execCommand` and `caretRangeFromPoint` mocks. Do not replace them with
new geometry mocks.

Add
`packages/studio/e2e/tests/regression/prompt-editor.regression.spec.ts`
using the current isolated Studio E2E runtime. Its real Chromium journey must:

1. use the fixture's mutable Core-built Preview, projected through
   `buildGenerationPreviewResource`, to open the existing Generation Preview
   dialog with a long, realistic prompt and two selected image references;
2. click visible text on several separated lines and near the bottom after
   scrolling, type unique markers, and assert each marker appears at the
   clicked document position rather than several lines away;
3. select, replace, paste, undo, and redo text in the actual editor;
4. type `@Ref`, assert the completion menu is anchored near the active range and
   contains real thumbnail/title/token content, navigate it by keyboard, accept
   it, and undo it once;
5. repeat completion with pointer selection while preserving editor focus;
6. hover `@Reference1`, then move the caret into it, and assert the correct
   preview remains within the prompt/dialog boundary in each case; repeat one
   completion or preview near the bottom-right edge to prove the bounded
   `tooltipSpace` configuration;
7. verify unknown mention-like text has neither reference styling nor preview;
8. close Preview, navigate to the fixture's Core-attached Character Sheet, open
   `View generation request` for the returned AssetFile, then focus the
   read-only inspector prompt, select and copy text by keyboard, move the caret
   into a known mention, and verify the correct preview; typing, paste,
   completion, and document mutation must remain disabled;
9. verify the dialog footer remains visible and the prompt owns the intended
   scroll surface.

The browser test asserts document behavior and geometry relationships, not
CodeMirror's private generated class names.

### Slice 4: visual acceptance gate

At the same approved desktop viewport, capture locked dark and light screenshots
for:

- the normal long prompt;
- the thumbnail completion menu open at `@`;
- the rich reference hover preview open.

Store the committed Playwright baselines beside the regression spec in its
standard
`prompt-editor.regression.spec.ts-snapshots/` directory. Use stable
state names for normal, completion-open, and preview-open in each theme.

Compare them with the 0149 prototype and inspect:

- typography, line length, paragraph rhythm, and document padding;
- gold headings, muted Markdown markers, blue list markers, strong text, and
  mint reference mentions;
- absence of gutter, line numbers, editor border, active-line fill, monospace
  body text, stock completion styling, and yellow focus rail;
- completion thumbnail, title, mention, selection, border, radius, and shadow;
- preview image fit, title, size, anchoring, and dialog containment;
- caret, selection, focus, and scroll stability.

This slice is not complete merely because CodeMirror works. If the screenshots
look like a code editor or materially miss the prototype, continue the theme and
extension work before final verification. Present the six screenshots to the
user and obtain explicit visual approval before marking the implementation or
this plan complete.

### Slice 5: current frontend documentation

Update current documentation only:

- correct `docs/architecture/frontend.md` so it no longer prescribes the deleted
  generic `SyntaxTextEditor`. The local `CodeMirrorEditor` owns only mechanical
  third-party control concerns; the Generation Request feature owns the sole
  `PromptEditor` and all prompt-specific behavior;
- do not rewrite completed plans 0131 or 0149 or the historical body of an ADR.

Do not turn this task-scoped `sfw` requirement into a partial repository-wide
package-manager policy. Current build, test, E2E, README, and contributor
commands are outside this editor replacement. A durable repository-wide Socket
Firewall policy requires a separate explicit decision that updates every
command surface coherently.

No new ADR is required. CodeMirror is an internal UI-control implementation
choice; Decision 0057's feature ownership and Decision 0041's opaque prompt
contract remain intact.

## Tests And Guardrails

### Owning feature coverage

The local control test owns lifecycle, exact uniform and mixed line-ending
synchronization, read-only, and accessibility mechanics. The pure mention
helpers own the full query/range/filter edge matrix. The feature test owns one
representative prompt edit, completion transaction, preview content, and
feature composition. Real
Chromium owns the keyboard/pointer interaction matrix and every geometry claim.

Do not repeat every query edge case in Playwright. Browser coverage exists to
prove real geometry, input, scrolling, anchoring, and representative keyboard
and pointer journeys.

### Stable architecture guardrails

- Keep the existing raw-browser-control architecture test. `prompt-editor.tsx`
  consumes the local `CodeMirrorEditor`; feature code neither renders a raw
  browser control nor constructs CodeMirror's interactive editing DOM.
- Do not add a source-text inventory of CodeMirror helper or extension names.
- If an import guardrail is needed, protect the stable boundary that the browser
  feature does not import Core server, Engines, Studio server, or CLI packages;
  do not freeze private feature filenames or function names.
- Use a scoped final search to prove Prism production imports and `.pce-*`
  selectors are gone. This is dependency cleanup verification, not a permanent
  architecture test preserving an obsolete implementation name.
- Keep prompt-opacity behavior tests: styling and suggestions may read exact
  text ranges for presentation, but no output of that reading affects
  persistence, reference selection, or provider routing.

### Security guardrails

- Every direct pnpm command shown or issued for this implementation is prefixed
  with `sfw`. Existing repository scripts may invoke pnpm internally; changing
  the complete script graph is outside this task.
- Stop rather than bypass when `sfw` cannot prepare its firewall binary, emits a
  security warning requiring judgment, or blocks a package.
- Do not use direct `pnpm`, `npm`, `npx`, or a manually downloaded package as a
  fallback.
- Do not manually edit dependency or lockfile entries.
- Inspect the complete manifest and lockfile diff after add and remove.
- Report the exact dependency command and firewall outcome in the final
  implementation handoff without including secrets or machine-specific tokens.

## Documentation And Decision Effects

- Update `docs/architecture/frontend.md` to remove its stale generic
  `SyntaxTextEditor` prescription, record the narrow local third-party-control
  boundary, and record feature ownership of the sole `PromptEditor` behavior.
- No Core, server, CLI, Engines, Studio Skills, database, API, or provider docs
  change.
- No ADR is added or rewritten.
- Completed plans remain historical evidence and are not edited.

## Final Verification

All direct pnpm invocations for this implementation use Socket Firewall,
including verification commands:

```bash
sfw pnpm --filter @gorenku/studio test -- prompt-editor prompt-mentions
sfw pnpm --filter @gorenku/studio test -- generation-preview
sfw pnpm --filter @gorenku/studio test -- generation-request-inspector
sfw pnpm --filter @gorenku/studio test:typecheck
sfw pnpm --filter @gorenku/studio lint
sfw pnpm --dir packages/studio test:e2e \
  e2e/tests/regression/prompt-editor.regression.spec.ts
sfw pnpm check
sfw pnpm test
```

Run scoped cleanup checks:

```bash
rg -n "prism-react-editor|pce-" \
  packages/studio/src packages/studio/package.json pnpm-lock.yaml

rg -n "basicSetup|caretRangeFromPoint|execCommand" \
  packages/studio/src/features/generation-request-editor
```

Both searches must return no production matches. Test descriptions may mention
the removed geometry APIs only when explaining why the old fake test was
deleted; prefer not to retain those names after cleanup.

Manual desktop verification uses the real
`/Users/keremk/renku-movies/urban-basilica` project and the Imperial Council
Chamber Location Sheet Preview:

- open the exact long prompt shown in the reported failure;
- click and edit near the top, middle, and bottom after scrolling;
- open completion and reference preview once near a constrained edge and confirm
  they remain inside the prompt/dialog boundary;
- confirm no yellow rail, editor box, code chrome, or content jump appears;
- repeat editable and read-only states in dark and light themes;
- compare the six acceptance screenshots against the prototype;
- confirm Prompt, References, Config, Update/Close, and inspector Close behavior
  outside the editor remains unchanged.

Final architecture review:

- inspect `git diff --stat` and the complete diff;
- inspect every new or heavily modified editor file;
- confirm `CodeMirrorEditor` owns only the mechanical local-control lifecycle
  and `PromptEditor` plus its focused feature modules own every prompt-specific
  behavior;
- confirm feature modules own only their named theme, completion, or preview
  behavior;
- confirm there is no new `index.ts`, registry, broad dispatcher, generic
  editor framework, fallback, or compatibility layer;
- confirm no behavior was fixed by recreating manual coordinates in a different
  file;
- confirm package and lockfile changes came from the reported `sfw pnpm`
  commands and contain only the intended dependency change;
- confirm no unrelated working-tree edits or formatting were overwritten.

## Completion Checklist

### Review Area

- [x] Reproduce and record the broken real-browser caret, focus rail, and
      reference behavior before editing.
- [x] Confirm the implementation preserves the exact current Generation Request
      product contract and plan 0150's removal of Image Revision.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm centralized editor ownership did not become a generic framework,
      broad extension registry, catch-all helper, or god file.
- [x] Confirm the result meets the visual acceptance gate and does not merely
      make CodeMirror functional.

### Security And Dependencies

- [x] Verify `sfw` can initialize before any dependency command.
- [x] Run the exact CodeMirror installation through `sfw pnpm` only.
- [x] Stop on every Socket Firewall warning, block, prompt requiring security
      judgment, or startup failure; do not retry directly.
- [x] Inspect `packages/studio/package.json` and the complete lockfile diff after
      installation.
- [x] Install only the seven named direct CodeMirror/Lezer packages.
- [x] Do not install `codemirror`, a React wrapper, premade theme, or another
      completion/tooltip dependency.
- [x] Remove `prism-react-editor` through `sfw pnpm` only.
- [x] Confirm every direct implementation and verification pnpm invocation used
      the `sfw` prefix.
- [x] Record the `sfw` version, exact dependency commands, and non-sensitive
      firewall outcomes in the implementation handoff.

### Architecture And Contracts

- [x] Replace `generation-request-prompt-editor.tsx` directly with the
      feature-owned `prompt-editor.tsx` and leave no old-name wrapper or alias.
- [x] Add one narrow `src/ui/code-mirror-editor.tsx` local control for
      CodeMirror lifecycle, exact controlled text, read-only, and accessibility
      mechanics only.
- [x] Keep Markdown, mentions, completion, previews, reference images, and
      product styling inside the owning Generation Request feature.
- [x] Keep `CodeMirrorEditor` free of a toolbar, preset registry, Markdown,
      mention, preview, generation, or rich-editor product concepts.
- [x] Preserve the existing editor prop shape as `PromptEditorProps` and update
      the prompt-panel caller directly.
- [x] Preserve the exact `GenerationPromptReferenceMention` contract.
- [x] Keep Preview, inspector, Core, server, CLI, Engines, and Studio Skills
      contracts unchanged.
- [x] Keep prompts opaque and all Markdown/mention work presentation-only.
- [x] Keep exact serialization inside the controlled-value boundary; use
      normalized `state.doc` text and CodeMirror offsets for all mention
      queries, replacements, decorations, and previews.
- [x] Add no compatibility shim, alternate editor, fallback, new registry,
      route, service, provider, DTO, diagnostic, or persistent field.
- [x] Keep existing feature and package `index.ts` entrypoints unchanged and
      thin.

### Local Control Lifecycle

- [x] Create and destroy exactly one CodeMirror `EditorView` per mounted
      `CodeMirrorEditor`.
- [x] Synchronize external controlled values without a duplicate user callback.
- [x] Keep one normalized LF CodeMirror document while retaining exact LF,
      CRLF, bare-CR, and mixed separators at the controlled-value boundary.
- [x] Preserve every untouched separator after unrelated edits and external
      controlled replacements, and use the prevailing convention for newly
      inserted lines.
- [x] Emit exact user-edited text for document transactions.
- [x] Preserve selection where appropriate during controlled updates.
- [x] Keep read-only prompts DOM-editable/focusable with
      `EditorState.readOnly.of(true)` and `aria-readonly='true'`, so selection,
      copy, caret movement, and preview work while typing and paste do not.
- [x] Support accessible label, placeholder, spellcheck, and caller-composed
      extensions without a feature preset registry.
- [x] Add focused control lifecycle plus uniform and mixed line-ending tests
      without claiming browser geometry coverage.

### Prompt Editor Presentation

- [x] Compose only explicit required extensions; do not import `basicSetup`.
- [x] Apply proportional Montserrat document typography, wrapping, and the
      prototype's text width and spacing rhythm.
- [x] Keep visible exact Markdown source with accessible light/dark token
      contrast.
- [x] Remove all gutter, line-number, active-line, folding, bracket, code-theme,
      and stock code-editor visuals.
- [x] Remove the yellow vertical focus rail without moving content on focus.
- [x] Preserve negative prompt presentation and behavior.
- [x] Delete the Prism prompt CSS and unused shared Prism theme files.

### Reference Completion And Preview

- [x] Open completion only for accepted `@` text-boundary queries.
- [x] Show only selected image references with projected mentions.
- [x] Render each option with the real thumbnail, meaningful title, and exact
      mint mention.
- [x] Support ArrowUp, ArrowDown, Enter, Tab, Escape, and pointer selection.
- [x] Replace only the active query in one undoable CodeMirror transaction.
- [x] Recompute token and label matches as the query changes so stale options
      cannot be accepted.
- [x] Decorate only exact known mentions and leave unknown/cleared text
      ordinary.
- [x] Show the correct rich image/title preview on hover and caret entry in
      editable and read-only states.
- [x] Bound completion and preview to the prompt scroll surface with
      CodeMirror's documented `tooltipSpace` configuration.
- [x] Use CodeMirror anchoring and placement; add no manual popover coordinates
      or point-to-text code.
- [x] Confirm prompt interactions never select, clear, attach, validate, or
      route references.

### Tests And Guardrails

- [x] Cover the full mention query/range/filter matrix once in pure helper
      tests.
- [x] Cover control lifecycle, uniform and mixed line-ending synchronization,
      read-only, and accessibility once in the local control tests.
- [x] Cover one representative prompt edit, completion transaction, preview
      content, and feature composition in focused feature tests.
- [x] Cover incremental token/label filtering and closure for an unmatched
      query in the feature test.
- [x] Cover completion replacement, exact decoration, and caret/hover preview
      after multiple line breaks in a CRLF-controlled prompt.
- [x] Keep the full keyboard, pointer, undo, and geometry interaction matrix in
      Chromium rather than duplicating it in JSDOM.
- [x] Delete `execCommand` and `caretRangeFromPoint` mocks rather than replacing
      them with other geometry fakes.
- [x] Add the real Chromium regression for separated-line and scrolled caret
      placement.
- [x] Add representative real-browser selection, paste, undo/redo, keyboard,
      pointer, completion-anchor, hover, caret-preview, and read-only journeys.
- [x] Build the mutable Preview through Core and project it through
      `buildGenerationPreviewResource` before dispatching the browser event.
- [x] Build the frozen inspector request through Core, attach its Character
      Sheet with `sourceSpecId`, and use the returned AssetFile route.
- [x] Assert geometry relationships and visible behavior without depending on
      CodeMirror's generated private class names.
- [x] Keep existing raw-control and package import boundaries passing.
- [x] Run the scoped Prism and forbidden-API cleanup searches.

### Visual Acceptance

- [x] Capture normal prompt, completion-open, and preview-open screenshots in
      dark theme.
- [x] Capture the same three screenshots in light theme.
- [x] Present all six screenshots to the user and obtain explicit visual
      approval before completion.
- [x] Compare typography, spacing, Markdown colors, mention styling, popover
      geometry, preview geometry, and image fit against the 0149 prototype.
- [x] Confirm no stock CodeMirror chrome or ugly boxed-editor appearance.
- [x] Confirm no yellow focus rail, caret displacement, content jump, footer
      overlap, or scroll bleed.
- [x] Continue styling until the visual proof passes; do not accept a merely
      functional editor.

### Documentation

- [x] Update `docs/architecture/frontend.md` to remove the stale generic
      `SyntaxTextEditor` prescription, record the narrow local CodeMirror
      control boundary, and record feature ownership of `PromptEditor` behavior.
- [x] Keep the `sfw` rule task-scoped; do not partially rewrite repository-wide
      package-manager instructions.
- [x] Preserve completed plans and historical ADR bodies unchanged.
- [x] Add no ADR unless implementation uncovers a real change to accepted
      product or architecture ownership.

### Final Verification

- [x] Run all focused Studio tests through `sfw pnpm`.
- [x] Run the dedicated Chromium regression through `sfw pnpm`.
- [x] Run Studio typecheck and lint through `sfw pnpm`.
- [x] Run root check and test through `sfw pnpm`.
- [x] Inspect the real Urban Basilica Imperial Council Chamber surface. The
      current project has no Location Sheet Preview to open, so verify the same
      long-prompt top, middle, bottom, dark, light, completion, and preview
      journey through the Core-built isolated Chromium fixture.
- [x] Review `git diff --stat` and the complete diff without absorbing or
      overwriting unrelated work.
- [x] Inspect every new and heavily modified editor file for focused ownership.
- [x] Confirm the local `CodeMirrorEditor` remains a mechanical adapter and the
      feature owns every prompt-specific extension and visual decision.
- [x] Confirm no new god file, catch-all module, broad dispatcher, editor
      registry, or manual geometry system was created.
- [x] Confirm `index.ts` files remain thin and unchanged unless a separately
      reviewed need appears.
- [x] Confirm package and lockfile diffs contain only the intended secure
      dependency replacement.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure or a visually poor default CodeMirror theme.
- [x] Only then change this plan's status from `proposed`.

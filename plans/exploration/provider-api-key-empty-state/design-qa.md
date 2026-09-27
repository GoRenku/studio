# Provider API key empty state — design QA

Date: 2026-09-27

## Evidence

- Selected source: `/Users/keremk/.codex/generated_images/01a0e30d-f077-7f83-9d2e-d4c3976e3103/exec-54eaebe0-a435-4f0a-b720-9ec257b6989a.png`.
- Implementation: [implemented-empty-state.png](implemented-empty-state.png).
- Focused comparison: [notice-comparison.png](notice-comparison.png), source above implementation.
- Preview: `http://127.0.0.1:5184/projects/urban-basilica`, Settings tab. This temporary preview uses the actual React components and synthetic provider status. Provider key writes are simulated in memory; other writes are rejected. Real credentials and project metadata were not changed.
- Both full-view images are 1487 × 1058 pixels. Browser viewport was set to 1487 × 1058 CSS pixels; the captured output is at 1× density. No rescaling was needed.
- State: dark theme, no saved provider keys, Codex selected for images, Screenplay Import and Generation collapsed, all three media sections expanded.
- Source and implementation were displayed together at equal dimensions for comparison. The focused comparison aligns their 824-pixel-wide setup notices and image provider rows.

## Findings and comparison history

1. Initial comparison: existing Settings spacing made the content substantially taller than the selected mock. Audio Generation was below the viewport. Classified P2.
2. Adjusted the Settings column to 800 pixels, reduced row and accordion spacing, and matched the setup notice's 824-pixel width and compact height. A second equal-size comparison showed a remaining vertical offset.
3. Reduced Settings top padding and notice margins. Final comparison shows the notice and media headings aligned closely with the selected composition, with Audio Generation visible. No actionable P0/P1/P2 visual differences remain.

### Fidelity surfaces

- Typography: retained Studio's existing sans-serif font and shadcn controls. Labels use 14px and descriptions use 12px; the long Codex label is readable in the widened selector. Hierarchy matches the reference.
- Spacing: compact rows, centered Settings column, slightly wider setup notice, and thin section separators match the chosen layout. The existing resizable sidebar and title/tab bands remain the application's own components.
- Colors: existing charcoal, foreground, muted foreground, and primary gold tokens are used. The notice uses a restrained gold border and tint. No new palette was introduced.
- Images and icons: retained the actual project thumbnail and Renku logo. The key icon uses the existing Lucide library. No new raster assets or approximated logos were added.
- Copy: the notice, action, Codex explanation, and empty provider labels match the selected design. Video and Audio selectors are disabled while there are no choices. Other generation preferences remain editable.

## Behavior verification

- 26 focused tests pass across Project Settings fields, the panel, the API key dialog, and Settings entry points.
- Tests cover autosave continuing while the dialog is open, refresh after a key save, preserving stored provider defaults, and returning focus even when Image Generation is collapsed.
- Loading-menu tests verify focus enters the listbox, the Radix popper positioning wrapper is mounted, and Escape returns focus to the trigger.
- Deep-link tests verify that only the header dialog opens when inline setup triggers are also mounted.
- Application and test TypeScript checks pass. ESLint passes on all changed source/test files. `git diff --check` passes.

## Remaining verification blocker

After the visual comparison and screenshot capture, Chrome refused automation because another extension UI was open. The live Add API keys click and browser-console inspection could not be completed. The viewport-reset and keep-tab-open request was also blocked. These browser interactions must be resumed after that extension UI is dismissed. Automated DOM tests cover the dialog interactions, but they are not reported as completed desktop-browser checks.

## Completion checklist

- [x] Inspect selected image and existing product components.
- [x] Implement notice and empty provider controls with local shadcn primitives.
- [x] Reuse API key dialog without page reload.
- [x] Verify edit preservation, provider refresh, keyboard focus, and deep-link behavior in tests.
- [x] Compare full desktop screenshots and focused regions; resolve P2 layout differences.
- [x] Inspect source diff and preserve unrelated changes.
- [ ] Complete the live dialog check and inspect browser console after dismissing the extension popup.
- [ ] Restore the browser viewport and leave the preview tab open.

final result: blocked

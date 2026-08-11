# Installation Page Design QA

## Evidence

- Source visual truth: `/Users/keremk/.codex/visualizations/2026/08/11/019ff130-1375-7133-bbee-9c743cf86371/reference-downloads.png`
- Browser-rendered implementation: `/Users/keremk/.codex/visualizations/2026/08/11/019ff130-1375-7133-bbee-9c743cf86371/implementation-download.png`
- Focused implementation region: `/Users/keremk/.codex/visualizations/2026/08/11/019ff130-1375-7133-bbee-9c743cf86371/implementation-install-panel.png`
- Side-by-side comparison: `/Users/keremk/.codex/visualizations/2026/08/11/019ff130-1375-7133-bbee-9c743cf86371/renku-install-comparison.png`
- Source pixels: 1388 × 1427 at the reference site's 1708 × 1307 desktop viewport, `deviceScaleFactor: 1`.
- Implementation pixels: 1708 × 2247 full page and 1024 × 1133 focused installation panel at a 1708 × 1251 desktop viewport, `deviceScaleFactor: 1`.
- Normalization: the focused source and implementation regions were normalized to the same 1133-pixel height and placed together in one comparison image. The source is an inspiration target rather than a strict clone; the comparison checks hierarchy and layout strategy while preserving Renku's accepted design system.
- State: Windows selected, all three installation steps visible, launch command focused after copy verification.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation deliberately retains Renku's Fraunces display face and Inter body face. The serif headline and restrained monospace commands preserve the site's cinematic hierarchy while matching the reference's readable command treatment.
- Spacing and layout rhythm: the hero, platform choice, three-step installation sequence, and supporting details form a clear top-to-bottom path. Dividers and whitespace separate related actions without introducing nested cards.
- Colors and visual tokens: the page uses the existing ink, paper, amber, and teal tokens. Amber identifies installation and selection; teal distinguishes the final launch action without adding a new color system.
- Image quality and asset fidelity: the page introduces no new illustration requirement. Existing Renku logo and GitHub assets remain crisp through Astro's asset pipeline. The focused browser capture contains a temporary browser-control overlay; it is not rendered by the website and was excluded from product findings.
- Copy and content: commands match the accepted macOS, native Windows, independent runtime, and Codex marketplace contracts. Supporting copy explains the self-contained runtime, checksum verification, local Studio model, and separate plugin installation without suggesting unsupported Electron, WSL, or bundled-plugin behavior.
- Interaction and accessibility: platform click switching, Mac and Windows panel visibility, command copy feedback, the landing-page download navigation, focus styles, and semantic tab/panel relationships were checked. The browser console had no errors or warnings.

## Full-view Comparison

The implementation translates the reference's most useful pattern—a prominent install command followed by clearly separated next steps—into a product-specific page. Renku adds an explicit platform decision before the first command and keeps the runtime, plugin, and launch steps in one continuous surface. The resulting density, contrast, and hierarchy are consistent with the existing marketing site.

## Focused-region Comparison

The normalized side-by-side comparison confirms that command blocks are readable, copy actions are consistently placed, muted explanatory text stays subordinate, and the three-step path remains visible without relying on decorative content. Renku's selected platform treatment provides stronger orientation than the reference requires because the product has genuinely different platform commands.

## Comparison History

- Initial comparison: no P0/P1/P2 visual mismatch was found. No visual correction loop was required.
- Interaction hardening completed before the final comparison: platform controls received visible focus treatment, copy actions received success and failure feedback, and the tab contract received keyboard navigation handling.

## Implementation Checklist

- [x] Dedicated `/download` route renders at the desktop breakpoint.
- [x] Header, hero, and closing calls-to-action navigate to `/download`.
- [x] macOS and Windows install commands match the accepted release contract.
- [x] Codex marketplace and plugin installation remain a distinct second step.
- [x] Studio launch command is a distinct final action.
- [x] Platform switching and command copying work in the browser.
- [x] Astro check and production build pass.
- [x] Browser console has no errors or warnings.

## Follow-up Polish

No blocking follow-up polish remains.

final result: passed

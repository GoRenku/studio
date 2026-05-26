# 0023 Use Domain-Neutral UI Primitives For Shared Frontend Patterns

Date: 2026-05-26

Status: accepted

## Context

The Cast visual cleanup exposed a frontend ownership problem. The app already
had polished image-card behavior in Visual Language surfaces, and Cast needed
the same image framing, overlay, delete affordance, preview dialog behavior,
and pick control behavior. Reusing a Visual Language-named component from Cast
made ownership unclear, while adding Cast-specific copies caused visual drift:
pick controls appeared in different corners, tooltips differed, labels became
noisy, and aspect ratios were handled inconsistently.

The same exercise also exposed a contract bug in reusable image cards:
`aspect-square` styling was not enough when the component also applied an
inline measured aspect ratio. Callers need an explicit aspect-ratio contract,
not a loose mix of class names and defaults.

## Decision

When a visual or interaction pattern is reused across multiple product
surfaces, the owning implementation belongs in `packages/studio/src/ui` under a
domain-neutral name.

Feature folders must not import another feature's private card or control just
because it looks right. For example, Cast must not import a
`visual-language/*` card to get the Lookbook image treatment. Instead, move the
shared implementation into `src/ui`, update all callers directly, and delete the
old feature-owned implementation.

Do not solve this with re-export files, compatibility aliases, pass-through
wrappers, or renamed local wrapper controls. A feature component may compose a
`src/ui` primitive with product-specific data and behavior, but it must add real
product meaning. It must not exist only to rename or preserve another component
API.

Reusable image-card primitives must make these behaviors explicit:

- the display aspect ratio;
- image fitting and cropping behavior;
- optional overlay copy;
- selected state;
- top-right actions, such as delete;
- bottom-right controls, such as pick or active-state toggles;
- image preview opening behavior.

Image cards that need runtime image measurement must use the shared aspect-ratio
utility instead of each surface hand-rolling `onLoad` image sizing logic.

Shared image selection controls must use one app-wide placement and behavior.
The selection control appears in the lower-right overlay, has a tooltip, exposes
pressed state, and toggles both ways: selecting an unselected item marks it as
the pick; selecting the current pick clears it.

Visible card copy must be intentional. Do not display raw filenames, asset ids,
kebab-case producer names, generated role names, or generic pick labels just to
fill space. If the image itself and surrounding section title carry the meaning,
leave the card surface quiet.

## Consequences

- Cast, Lookbooks, Inspiration, and future media-heavy surfaces share one visual
  interaction language.
- Reusable card APIs make aspect-ratio differences explicit, so square profile
  images and 4:3 character sheets can use the same component without cropping
  bugs.
- Pick, active, and delete affordances stay visually consistent across product
  areas.
- Feature folders stay responsible for product composition, not design-system
  ownership.
- Refactors require direct caller updates and deletion of obsolete components,
  which matches Studio's no-compatibility rule.

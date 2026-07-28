# Plan 0157 Shot Plans Collection And Detail Reference

This directory is the accepted, normative visual reference for the Shot Plan
collection and in-page detail portions covered by Plan 0157. It contains the complete reviewed
prototype, its local image/video assets, and its accepted visual states. The
prototype loads the pinned Lucide browser script used by the original mockup
from `unpkg.com`; production Studio does not depend on that script.

Run it from the repository root:

```bash
python3 -m http.server 8765 --directory plans/active/assets/0157-shot-plans-studio-ui
```

Then open `http://127.0.0.1:8765/`.

`index.html` is the source of truth for layout, spacing, visual hierarchy, and
the interactions represented in the prototype. It opens on the Scene’s Shot
Plans collection; activate either plan card to enter the in-page Shot Plan
detail, and use Back to return to the tab surface. The files under
`screenshots/` are stable review references for the named states.
`design-qa.md` records the prototype checks completed before this artifact was
accepted.

This artifact is not production code. Production implementation must compose
the existing Studio architecture, local shadcn-style controls, feature hooks,
and shared media primitives while matching this reference.

# 0067: Use Structured Shot Depth And Presentational Mentions

Date: 2026-07-28

Status: accepted

## Context

Shot descriptions are exact opaque Markdown, but dense paragraph-only
authoring makes camera intent difficult to scan. Canonical screenplay
`@handle` references are meaningful source context, yet long handles are less
readable than Cast Member and Location labels. The existing Shot brief also
accepted arbitrary depth-of-field strings and presented focal length, depth,
and focus target with incomplete labels.

The runtime must not interpret creative prose, require a document template,
derive brief values, or create durable mention state. Generation Preview uses
mint `@` syntax for request-scoped media references, but those references have
different identity, color, and interaction rules from screenplay entities.

Authoritative cinematography references distinguish focal length, depth of
field, focus distance/target, and focus transitions:

- [Kodak motion-picture glossary](https://www.kodak.com/en/motion/page/glossary-of-motion-picture-terms/)
- [Kodak Cinema Tools](https://www.kodak.com/en/motion/page/kodak-cinema-tools/)
- [Sony depth-of-field guidance](https://www.sony.com/electronics/support/articles/00031291)
- [Sony focal-length and angle-of-view guidance](https://www.sony.com/electronics/support/articles/00268239)
- [ARRI lens-data documentation](https://www.arri.com/resource/blob/147960/0a0185ebcbe1c872f87a7f7200f44e12/alexa-xt-sup-11-1-1-user-manual-data.pdf)
- [Sony rack-focus example](https://www.sony.com/ng/electronics/interchangeable-lens-cameras/ilme-fx3a)

## Decision

`Shot.description` remains one exact opaque Markdown string. The
`shot-planner` agent may author relevant `##` sections, canonical screenplay
`@handle` source tokens, and strong Markdown around material known
cinematography choices. Those are authoring conventions, not runtime schema or
validation requirements.

Studio may resolve exact known Cast Member and Location handles from the
already-loaded Scene narrative maps for presentation only:

- Shot descriptions display `@` plus the meaningful entity label in the same
  amber family used by screenplay narrative links;
- hovering a known description mention previews the selected Cast profile or
  Location hero image already projected by the Scene narrative resource;
- Narrative dialogue names and Shot description mentions render the same
  image-only `ScreenplayEntityImagePreview`: square for Cast profiles, 16:9 for
  Location heroes, with the component's visually tuned two-pixel muted-gray
  frame and no caption. That frame is a specific visual choice for this preview,
  not a general border rule;
- Optics and Lighting card prose displays known entity labels in bold amber,
  without the source `@` prefix and without hover behavior;
- Shot Markdown headings use a terracotta accent so structure remains visibly
  distinct from entity and cinematography semantics;
- strong cinematography terms use a distinct muted sage tone so they remain
  scannable without competing with entity mentions;
- unknown mention-like text remains exact ordinary text;
- the underlying description and brief strings remain unchanged and copy as
  authored.

Shot entity mentions and Generation Preview media-reference mentions retain
separate visual tokens, identity data, resolvers, CodeMirror behavior, and
interactions.

Core defines:

```ts
type ShotDepthOfField = 'shallow' | 'deep';
```

The single display map presents these values as `Shallow Focus` and
`Deep Focus`. `focalLengthMm` remains a positive unitless number in JSON and is
presented as `{n}mm lens`. Focus target remains exact opaque text and is
presented with `Focus on …`. The agent uses `focusTarget` for one primary
optical subject, plane, or distance; shared deep-focus legibility belongs in
`optics.intent`. Core continues to treat both fields as opaque strings.
`rack-focus` remains a Motion transition and is not a depth-of-field value.

No fallback accepts or maps prior freeform depth values.

## Consequences

- Directors can scan agent-authored Shot descriptions without a second
  document representation.
- Copy, persistence, validation, and downstream prompt context retain exact
  authored Markdown and canonical handles.
- Core owns one closed depth vocabulary while creative Optics and Lighting
  intent remain opaque.
- The existing Scene narrative resource projects selected Cast profile and
  Location hero images; Studio adds no Shot-specific fetch, durable
  relationship, semantic prose parser, or mention framework.
- Focal length does not imply wide/normal/telephoto classification because
  angle of view also depends on capture format.

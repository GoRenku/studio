# FDX Screenplay E2E Data

These real-world Final Draft XML inputs are third-party interoperability and
stress inputs published by Fountain. They are not official Final Draft fixtures
or a conformance suite. Renku Studio records their source URLs, byte lengths,
and SHA-256 identities in
`e2e/fixtures/studio-e2e-screenplay-fdx-sources.ts`; it does not redistribute
the screenplay files in this repository.

- `big-fish.fdx` is the full-length stress fixture.
- `brick-and-steel.fdx` contains paragraph-wrapped Dual Dialogue, split styled
  text runs, multiline Action, cue extensions, and ordered Parentheticals.
- `the-last-birthday-card.fdx` contains displayed card text authored as orphan
  Dialogue paragraphs plus a longer mix of screenplay elements.

The fixtures deliberately retain their original Final Draft formatting,
TitlePage, PageLayout, SmartType, ElementSettings, and other editor-owned XML.
E2E assertions prove those parts remain in the retained source but do not enter
the canonical Screenplay or import report.

On first use, the E2E fixture downloads the requested source from
`https://fountain.io` into the repository-ignored
`tmp/studio-e2e/screenplay-fdx/` cache. Later runs reuse only a cache entry that
matches the pinned byte length and SHA-256. A missing offline source or changed
cache/upstream file fails fast instead of skipping coverage or accepting new
bytes silently.

The `.fdx` extension is intentional: the production importer accepts Final
Draft sources through the same source-envelope validation used outside tests.

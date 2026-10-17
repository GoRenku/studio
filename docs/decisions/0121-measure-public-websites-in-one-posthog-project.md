# 0121 Measure The Public Websites In One PostHog Project

Date: 2026-10-17

Status: accepted

## Context

gorenku.com sent page views and four events to PostHog only for visitors who
clicked Yes on its analytics banner. Visitors who clicked No were not counted
at all, nothing recorded which post or README sent a visitor, and Latent
Matinee had no analytics. Renku is a small open-source project with few
visitors, and the maintainer wants to know that every visit happened, while
recording nothing more for visitors who decline.

## Decision

- gorenku.com and latentmatinee.com send to one PostHog project, "Renku
  Website", in the EU region. Every event carries `surface` (`website`,
  `matinee`) so the sites can be told apart.
- PostHog is never loaded before a visitor answers the banner.
- Visitors who choose No are counted with PostHog's `cookieless_mode:
  'on_reject'`: page views and page-leave times only, with nothing stored in
  their browser except the choice, and a server-side code that changes daily.
  The banner and privacy notices say so. The legal basis named is legitimate
  interest. Whether this counting needs consent under the ePrivacy rules is
  not settled (EDPB Guidelines 2/2023 list "tracking based on IP only" among
  cases that may); the maintainer accepted that uncertainty.
- Clicks, copies, video plays, surveys and other events are sent only for
  visitors who choose Yes.
- Events are explicit and declared through `data-analytics-*` page
  attributes. Autocapture and session recording stay off.
- The event list, page attributes, link-tag (UTM) convention and PostHog
  settings live in
  [`docs/operations/web-analytics-and-attribution.md`](../operations/web-analytics-and-attribution.md).

## Consequences

Events from visitors who chose No stay in PostHog for its retention period
(one year on the free plan); turning the mode off later stops new counting but
does not remove past events. The PostHog project setting "Cookieless server
hash mode" must be on, or those events are discarded. Charts that include No
visitors use sessions, because those visitors count as new each day.

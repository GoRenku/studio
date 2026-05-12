# Documentation Taxonomy

Date: 2026-05-12

Status: current

Role: governance

Renku Studio keeps documentation readable by separating document roles. The
same topic can appear in more than one place, but each place must answer a
different question.

## Decisions

`docs/decisions/` contains ADRs.

ADRs answer:

> What did we decide, when, and why?

ADRs may include context, the accepted decision, rejected alternatives, and
consequences. They should link to the current architecture or reference page
instead of becoming long implementation manuals.

Allowed ADR statuses:

- `proposed`
- `accepted`
- `superseded by ADR-XXXX`
- `rejected`

## Architecture Overviews

`docs/architecture/` contains current architecture topic overviews.

Architecture overviews answer:

> How does this area fit together now?

They should be short maps of the current system. They can link to ADRs,
reference docs, active plans, and explorations, but they should not contain long
contract listings, draft proposals, or implementation sequencing.

Use this metadata:

```text
Status: current

Role: topic overview
```

## Architecture References

`docs/architecture/reference/` contains current architecture references.

Reference docs answer:

> What are the exact current rules?

They can contain schemas, path contracts, route structures, diagnostic payloads,
folder conventions, naming rules, and workflow steps. They should describe the
current implementation contract, not preserve obsolete formats.

Use this metadata:

```text
Status: current

Role: reference
```

## Plans

`plans/active/` contains current implementation plans and sequencing.

Plans answer:

> What are we building or changing next?

Plans may include implementation order, acceptance criteria, open questions, and
temporary sequencing details.

## Exploration

`plans/exploration/` contains unsettled or future design work.

Explorations answer:

> What are we considering, but have not accepted or implemented yet?

If an exploration becomes accepted direction, promote the durable decision into
an ADR and keep the current shape in an architecture overview or reference.

## Governance

`docs/governance/` contains documentation process, taxonomy, and audit records.

Governance docs answer:

> How do we maintain the documentation system itself?

Audit files belong here, not in `docs/architecture/`, because they describe a
cleanup event rather than the current product architecture.

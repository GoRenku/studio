# @gorenku/studio-cli

Renku Studio command surface.

This package is intentionally separate from the existing `@gorenku/cli`
package. It is a thin command adapter over `@gorenku/studio-core`.

Project workflow settings are inspected and fully replaced with:

```bash
renku settings show --project <project-name> --json
renku settings set --project <project-name> --file <project-settings.json> --json
```

`--project` follows the normal explicit/current Project resolution rules.
`show` prints the complete current document. `set` accepts one complete current
document, delegates validation and replacement to Core, prints the committed
mutation report, and forwards Core's `project-settings` resource notification
once. The CLI does not calculate defaults, merge partial settings, or validate
individual fields.

# Product Vocabulary

Renku Studio should use the same domain word for the same concept across docs,
code, schema, CLI commands, UI copy, and prompts.

## Product Terms

| Term | Meaning |
| --- | --- |
| Renku Studio | The long-form professional creative workspace under the Renku umbrella. |
| Project | A local Studio workspace containing durable metadata and generated media. |
| Standalone movie | A project shape for one movie-like production. |
| Series | A future project shape with multiple episodes sharing cast, visual language, and reusable assets. |
| Episode | A movie-like production unit inside a series. |
| Sequence | A meaningful group of scenes that forms a larger dramatic or production beat. |
| Scene | A story unit inside a sequence. |
| Clip | The v1 production unit used for visual design, generation, takes, and review. |
| Visual Language | The top-level creative direction system for generation. |
| Generation Recipe | The editable generation setup users and agents work with. |
| Catalog Recipe Template | A reusable system-provided starting point for a generation recipe. |
| Engine | A future registered AI generation backend, such as an image, video, voice, music, or prompt engine. |

## Naming Guidance

- Use `Renku Studio` for the product.
- Use package names under the `@gorenku/studio-*` family.
- Use `engine` for AI generation backends, not `provider`, once the new package
  is introduced.
- Use `adapter` for provider-specific SDK implementations inside the future
  engines package.

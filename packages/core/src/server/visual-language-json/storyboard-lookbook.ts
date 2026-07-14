import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  StoryboardLookbookDefinition,
  StoryboardLookbookSection,
} from '../../client/index.js';

export const storyboardLookbookSections = [
  'styleBrief',
  'lineAndFinish',
  'valueAndAccent',
  'guardrails',
] as const satisfies readonly StoryboardLookbookSection[];

export function validateStoryboardLookbookDefinition(
  definition: StoryboardLookbookDefinition,
  validateSchema: (value: unknown) => DiagnosticIssue[]
): DiagnosticIssue[] {
  return validateSchema(definition);
}

export function serializeStoryboardLookbookDocument(document: {
  storyboardLookbook: StoryboardLookbookDefinition & { name: string };
  sourceInspirationFolderIds?: string[];
}): {
  kind: 'storyboard';
  name: string;
  definitionJson: string;
  sourceInspirationFolderIds?: string[];
} {
  const { name, ...definition } = document.storyboardLookbook;
  return {
    kind: 'storyboard',
    name,
    definitionJson: JSON.stringify(definition),
    sourceInspirationFolderIds: document.sourceInspirationFolderIds,
  };
}

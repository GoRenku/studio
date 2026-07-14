import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  ProductionLookbookDefinition,
  ProductionLookbookSection,
} from '../../client/index.js';

type ProductionSection = Exclude<ProductionLookbookSection, 'inspiredBy'>;

export const productionLookbookSections = [
  'thesis',
  'palette',
  'toneMood',
  'composition',
  'lighting',
  'texture',
  'camera',
] as const satisfies readonly ProductionLookbookSection[];

export function validateProductionLookbookDefinition(
  definition: ProductionLookbookDefinition,
  validateSection: (
    value: unknown,
    section: ProductionSection,
    path: string[]
  ) => DiagnosticIssue[]
): DiagnosticIssue[] {
  return productionLookbookSections.flatMap((section) =>
    validateSection(definition[section], section, [section])
  );
}

export function serializeProductionLookbookDocument(document: {
  productionLookbook: ProductionLookbookDefinition & { name: string };
  sourceInspirationFolderIds?: string[];
}): {
  kind: 'production';
  name: string;
  definitionJson: string;
  sourceInspirationFolderIds?: string[];
} {
  const { name, ...definition } = document.productionLookbook;
  return {
    kind: 'production',
    name,
    definitionJson: JSON.stringify(definition),
    sourceInspirationFolderIds: document.sourceInspirationFolderIds,
  };
}

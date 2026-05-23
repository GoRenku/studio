import type { InspirationFolderResource } from '@gorenku/studio-core/client';
import { EmptyState } from './empty-state';
import { VisualLanguageReport } from './visual-language-report';

interface InspirationAnalysisTabProps {
  projectName: string;
  resource: InspirationFolderResource;
}

export function InspirationAnalysisTab({
  projectName,
  resource,
}: InspirationAnalysisTabProps) {
  if (!resource.analysis) {
    return <EmptyState title='Use the Renku skill to analyze this folder.' />;
  }
  return (
    <VisualLanguageReport
      projectName={projectName}
      source={{ kind: 'inspiration', folderId: resource.folder.id }}
      sections={{
        thesis: resource.analysis.thesis,
        palette: resource.analysis.palette,
        toneMood: resource.analysis.toneMood,
        composition: resource.analysis.composition,
        lighting: resource.analysis.lighting,
        texture: resource.analysis.texture,
        inspiredBy: resource.analysis.inspiredBy,
      }}
    />
  );
}

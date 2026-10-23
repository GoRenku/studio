import type { InspirationFolderResource } from '@gorenku/studio-core/client';
import { ScanSearch } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { inspirationAnalysisRequest } from '../agent-request-copy';
import { VisualLanguageReport } from './visual-language-report';

interface InspirationAnalysisTabProps {
  projectName: string;
  resource: InspirationFolderResource;
}

export function InspirationAnalysisTab({
  projectName,
  resource,
}: InspirationAnalysisTabProps) {
  if (!resource.analysis && resource.images.length === 0) {
    return (
      <PanelEmptyState
        icon={ScanSearch}
        title='Not analyzed yet'
        description='Add reference images under Grabs first. Your agent can then describe their palette, light and composition.'
      />
    );
  }
  if (!resource.analysis) {
    return (
      <PanelEmptyState
        icon={ScanSearch}
        title='Not analyzed yet'
        description='Your agent can study these images and describe their palette, light, composition and mood.'
        request={inspirationAnalysisRequest(resource.folder.name)}
      />
    );
  }
  return (
    <VisualLanguageReport
      projectName={projectName}
      source={{ kind: 'inspiration', folder: resource.folder, images: resource.images }}
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

import type { StudioSelection } from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { InspirationPanel } from './inspiration-panel';
import { LookbookPanel } from './lookbook-panel';

interface VisualLanguagePanelProps {
  project: ProjectShellWithHttp;
  selection: Extract<
    StudioSelection,
    { type: 'inspiration' } | { type: 'lookbook' }
  >;
  onSelect: (selection: StudioSelection) => void;
  onInspirationFoldersChange: () => void;
  inspirationFoldersRevision: number;
}

export function VisualLanguagePanel({
  project,
  selection,
  onSelect,
  onInspirationFoldersChange,
  inspirationFoldersRevision,
}: VisualLanguagePanelProps) {
  const projectName = project.project.projectName;

  if (selection.type === 'lookbook') {
    return (
      <LookbookPanel
        projectName={projectName}
        kind={selection.kind}
      />
    );
  }

  return (
    <InspirationPanel
      projectName={projectName}
      folderId={selection.folderId}
      foldersRevision={inspirationFoldersRevision}
      onOpenFolder={(folderId) => onSelect({ type: 'inspiration', folderId })}
      onInspirationFoldersChange={onInspirationFoldersChange}
    />
  );
}

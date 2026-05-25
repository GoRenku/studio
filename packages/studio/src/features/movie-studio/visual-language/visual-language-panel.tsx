import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type { StudioSelection } from '../movie-studio-selection';
import { InspirationPanel } from './inspiration-panel';
import { LookbookPanel } from './lookbook-panel';
import { LookbooksPanel } from './lookbooks-panel';

interface VisualLanguagePanelProps {
  project: ProjectShellWithHttp;
  selection: Extract<
    StudioSelection,
    { type: 'inspiration' } | { type: 'lookbooks' } | { type: 'lookbook' }
  >;
  onSelect: (selection: StudioSelection) => void;
  onLookbooksChange: () => void;
  onInspirationFoldersChange: () => void;
  inspirationFoldersRevision: number;
}

export function VisualLanguagePanel({
  project,
  selection,
  onSelect,
  onLookbooksChange,
  onInspirationFoldersChange,
  inspirationFoldersRevision,
}: VisualLanguagePanelProps) {
  const projectName = project.identity.name;

  if (selection.type === 'lookbooks') {
    return (
      <LookbooksPanel
        projectName={projectName}
        onOpenLookbook={(lookbookId) => onSelect({ type: 'lookbook', lookbookId })}
        onLookbooksChange={onLookbooksChange}
      />
    );
  }

  if (selection.type === 'lookbook') {
    return (
      <LookbookPanel
        projectName={projectName}
        lookbookId={selection.lookbookId}
        onLookbooksChange={onLookbooksChange}
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

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Images,
  Layers3,
  MapPin,
  Palette,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import renkuLogo from '@/assets/renku-logo.svg';
import type {
  ActNavigationRow,
  InspirationResource,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { cn } from '@/lib/utils';
import {
  deleteInspirationFolder,
  readInspirationResource,
} from '@/services/studio-visual-language-api';
import {
  matchesVisualLanguageInspirationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import type { StudioSelection } from '../movie-studio-selection';
import type { ScreenplayNavigationState } from '../use-screenplay-navigation';
import { StudioSidebarActions } from './studio-sidebar-actions';
import { StudioSidebarButton } from './studio-sidebar-button';
import { StudioSidebarHoverActionRow } from './studio-sidebar-hover-action-row';
import { StudioSidebarSection } from './studio-sidebar-section';

interface StudioSidebarProps {
  project: ProjectShellWithHttp;
  screenplayNavigation: ScreenplayNavigationState;
  selection: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
  onHome: () => void;
  inspirationFoldersRevision: number;
  onInspirationFoldersChange: () => void;
}

export function StudioSidebar({
  project,
  screenplayNavigation,
  selection,
  onSelect,
  onHome,
  inspirationFoldersRevision,
  onInspirationFoldersChange,
}: StudioSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedAutoSections, setCollapsedAutoSections] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedActs, setExpandedActs] = useState<Set<string>>(() => new Set());
  const [collapsedAutoActs, setCollapsedAutoActs] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedAutoSequences, setCollapsedAutoSequences] = useState<Set<string>>(
    () => new Set()
  );
  const [inspirationResource, setInspirationResource] =
    useState<InspirationResource | null>(null);
  const [inspirationResourceRevision, setInspirationResourceRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readInspirationResource(project.identity.name)
      .then((resource) => {
        if (!cancelled) setInspirationResource(resource);
      })
      .catch(() => {
        if (!cancelled) setInspirationResource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    project.identity.name,
    inspirationFoldersRevision,
    inspirationResourceRevision,
  ]);

  useStudioResourceRefresh({
    projectName: project.identity.name,
    matches: (resourceKeys) =>
      matchesVisualLanguageInspirationResource(resourceKeys),
    onRefresh: () => setInspirationResourceRevision((current) => current + 1),
  });

  const inspirationFolders =
    inspirationResource?.folders.items.map((item) => item.folder) ?? [];
  const selectedInspirationFolderId =
    selection.type === 'inspiration' ? selection.folderId ?? null : null;

  const autoExpand = useMemo(() => {
    const context = screenplayNavigation.selectionContext;
    const sections: string[] = [];
    const acts: string[] = [];
    const sequences: string[] = [];
    if (selection.type === 'castMember') sections.push('cast');
    if (selection.type === 'location') sections.push('locations');
    if (selection.type === 'inspiration') {
      sections.push('visualLanguage', 'inspiration');
    }
    if (selection.type === 'lookbook') {
      sections.push('visualLanguage', 'lookbooks');
    }
    if (
      selection.type === 'storyArc' ||
      selection.type === 'act' ||
      selection.type === 'sequence' ||
      selection.type === 'scene'
    ) {
      sections.push('acts');
    }
    if (selection.type === 'sequence') {
      sequences.push(selection.id);
      const actId = actIdForSequence(
        screenplayNavigation.sequencesByActId,
        selection.id
      );
      if (actId) {
        acts.push(actId);
      }
    }
    if (context) {
      if ('act' in context) acts.push(context.act.id);
      if ('sequence' in context) sequences.push(context.sequence.id);
    }
    return { sections, acts, sequences };
  }, [
    screenplayNavigation.selectionContext,
    screenplayNavigation.sequencesByActId,
    selection,
  ]);
  const forceSelectedScreenplayPathOpen =
    selection.type === 'sequence' || selection.type === 'scene';

  const visibleExpandedSections = useMemo(() => {
    const visible = subtractValues(
      addValues(expandedSections, autoExpand.sections),
      collapsedAutoSections
    );
    return forceSelectedScreenplayPathOpen
      ? addValues(visible, ['acts'])
      : visible;
  }, [
    autoExpand.sections,
    collapsedAutoSections,
    expandedSections,
    forceSelectedScreenplayPathOpen,
  ]);
  const visibleExpandedActs = useMemo(() => {
    const visible = subtractValues(
      addValues(expandedActs, autoExpand.acts),
      collapsedAutoActs
    );
    return forceSelectedScreenplayPathOpen
      ? addValues(visible, autoExpand.acts)
      : visible;
  }, [
    autoExpand.acts,
    collapsedAutoActs,
    expandedActs,
    forceSelectedScreenplayPathOpen,
  ]);
  const visibleExpandedSequences = useMemo(() => {
    const visible = subtractValues(
      addValues(expandedSequences, autoExpand.sequences),
      collapsedAutoSequences
    );
    return forceSelectedScreenplayPathOpen
      ? addValues(visible, autoExpand.sequences)
      : visible;
  }, [
    autoExpand.sequences,
    collapsedAutoSequences,
    expandedSequences,
    forceSelectedScreenplayPathOpen,
  ]);

  const toggleSection = (section: string) => {
    const expanded = visibleExpandedSections.has(section);
    setExpandedSections((current) =>
      expanded ? removeValue(current, section) : addValues(current, [section])
    );
    setCollapsedAutoSections((current) =>
      expanded ? addValues(current, [section]) : removeValue(current, section)
    );
    if (section === 'acts') {
      void screenplayNavigation.loadActs();
    }
  };

  const removeInspirationFolder = async (folderId: string) => {
    await deleteInspirationFolder(project.identity.name, folderId);
    setInspirationResource((current) =>
      current
        ? {
            ...current,
            folders: {
              ...current.folders,
              items: current.folders.items.filter(
                (item) => item.folder.id !== folderId
              ),
            },
          }
        : current
    );
    onInspirationFoldersChange();
    if (selectedInspirationFolderId === folderId) {
      onSelect({ type: 'inspiration' });
    }
  };

  const toggleAct = (actId: string) => {
    const expanded = visibleExpandedActs.has(actId);
    setExpandedActs((current) =>
      expanded ? removeValue(current, actId) : addValues(current, [actId])
    );
    setCollapsedAutoActs((current) =>
      expanded ? addValues(current, [actId]) : removeValue(current, actId)
    );
    void screenplayNavigation.loadActSequences(actId);
  };

  const toggleSequence = (sequenceId: string) => {
    const expanded = visibleExpandedSequences.has(sequenceId);
    setExpandedSequences((current) =>
      expanded ? removeValue(current, sequenceId) : addValues(current, [sequenceId])
    );
    setCollapsedAutoSequences((current) =>
      expanded ? addValues(current, [sequenceId]) : removeValue(current, sequenceId)
    );
    void screenplayNavigation.loadSequenceScenes(sequenceId);
  };

  return (
    <aside className='h-full min-h-0 rounded-(--radius-panel) border border-sidebar-border bg-sidebar-bg overflow-hidden flex flex-col'>
      <div className='h-14 px-3 border-b border-border/40 bg-sidebar-header-bg flex items-center justify-between gap-3 shrink-0'>
        <Button
          type='button'
          variant='ghost'
          onClick={onHome}
          className='h-auto min-w-0 justify-start gap-2 rounded-md px-1.5 py-1 hover:bg-item-hover-bg/70'
          aria-label='Go to Renku Studio home'
        >
          <img
            src={renkuLogo}
            alt='Renku'
            className='h-9 w-9 shrink-0 rounded-md object-contain'
          />
          <span className='min-w-0 text-left'>
            <span className='block truncate text-sm font-semibold leading-4'>
              Renku Studio
            </span>
          </span>
        </Button>
        <StudioSidebarActions />
      </div>

      <div className='border-b border-border/40 p-3'>
        <ProjectCard project={project} selection={selection} onSelect={onSelect} />
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto p-2 space-y-4'>
        <StudioSidebarSection
          title='Visual Language'
          detail='Inspiration and Lookbooks'
          icon={<Palette className='h-4 w-4' />}
          active={false}
          expanded={visibleExpandedSections.has('visualLanguage')}
          onSelect={() => onSelect({ type: 'inspiration' })}
          onToggle={() => toggleSection('visualLanguage')}
        >
          {visibleExpandedSections.has('visualLanguage') ? (
            <div className='space-y-1'>
              <StudioSidebarButton
                active={selection.type === 'inspiration' && !selection.folderId}
                icon={<BookOpen className='h-4 w-4' />}
                label='Inspiration'
                detail={`${inspirationFolders.length} folders`}
                compact
                onClick={() => onSelect({ type: 'inspiration' })}
                disclosure={{
                  expanded: visibleExpandedSections.has('inspiration'),
                  label: `${visibleExpandedSections.has('inspiration') ? 'Collapse' : 'Expand'} Inspiration`,
                  onToggle: () => toggleSection('inspiration'),
                }}
              />
              {visibleExpandedSections.has('inspiration')
                ? inspirationFolders.map((folder) => (
                    <div key={folder.id} className='pl-3'>
                      <StudioSidebarHoverActionRow
                        active={selectedInspirationFolderId === folder.id}
                        icon={<Images className='h-3.5 w-3.5' />}
                        label={folder.name}
                        onSelect={() =>
                          onSelect({ type: 'inspiration', folderId: folder.id })
                        }
                        action={
                          <DeleteConfirmDialog
                            title='Delete Folder?'
                            message={`Remove "${folder.name}" and its saved grabs.`}
                            onDelete={() => removeInspirationFolder(folder.id)}
                            trigger={
                              <Button
                                type='button'
                                size='icon'
                                variant='ghost'
                                className='h-6 w-6 rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                                aria-label={`Delete ${folder.name}`}
                              >
                                <Trash2 className='h-3.5 w-3.5' />
                              </Button>
                            }
                          />
                        }
                      />
                    </div>
                  ))
                : null}
              <StudioSidebarButton
                active={false}
                icon={<Layers3 className='h-4 w-4' />}
                label='Lookbooks'
                detail='Production and Storyboard'
                compact
                onClick={() => toggleSection('lookbooks')}
                disclosure={{
                  expanded: visibleExpandedSections.has('lookbooks'),
                  label: `${visibleExpandedSections.has('lookbooks') ? 'Collapse' : 'Expand'} Lookbooks`,
                  onToggle: () => toggleSection('lookbooks'),
                }}
              />
              {visibleExpandedSections.has('lookbooks') ? (
                <>
                  <div className='pl-3'>
                    <StudioSidebarButton
                      active={selection.type === 'lookbook' && selection.kind === 'production'}
                      icon={<Palette className='h-4 w-4' />}
                      label='Production'
                      detail='Final video direction'
                      compact
                      onClick={() => onSelect({ type: 'lookbook', kind: 'production' })}
                    />
                  </div>
                  <div className='pl-3'>
                    <StudioSidebarButton
                      active={selection.type === 'lookbook' && selection.kind === 'storyboard'}
                      icon={<Palette className='h-4 w-4' />}
                      label='Storyboard'
                      detail='Storyboard direction'
                      compact
                      onClick={() => onSelect({ type: 'lookbook', kind: 'storyboard' })}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </StudioSidebarSection>

        <StudioSidebarSection
          title='Cast'
          detail={`${project.counts.castMembers} members`}
          icon={<UsersRound className='h-4 w-4' />}
          active={selection.type === 'cast'}
          expanded={visibleExpandedSections.has('cast')}
          onSelect={() => onSelect({ type: 'cast' })}
          onToggle={() => toggleSection('cast')}
        >
          {visibleExpandedSections.has('cast')
            ? screenplayNavigation.cast.map((castMember) => (
                <StudioSidebarButton
                  key={castMember.id}
                  active={
                    selection.type === 'castMember' && selection.id === castMember.id
                  }
                  icon={<UserRound className='h-4 w-4' />}
                  label={castMember.name}
                  detail={castMember.role ?? 'Cast member'}
                  compact
                  onClick={() =>
                    onSelect({ type: 'castMember', id: castMember.id })
                  }
                />
              ))
            : null}
        </StudioSidebarSection>

        <StudioSidebarSection
          title='Locations'
          detail={`${project.counts.locations} locations`}
          icon={<MapPin className='h-4 w-4' />}
          active={selection.type === 'locations'}
          expanded={visibleExpandedSections.has('locations')}
          onSelect={() => onSelect({ type: 'locations' })}
          onToggle={() => toggleSection('locations')}
        >
          {visibleExpandedSections.has('locations')
            ? screenplayNavigation.locations.map((location) => (
                <StudioSidebarButton
                  key={location.id}
                  active={selection.type === 'location' && selection.id === location.id}
                  icon={<MapPin className='h-4 w-4' />}
                  label={location.name}
                  detail={location.timePeriod ?? 'Location'}
                  compact
                  onClick={() => onSelect({ type: 'location', id: location.id })}
                />
              ))
            : null}
        </StudioSidebarSection>

        <StudioSidebarSection
          title='Acts'
          detail={`${project.counts.acts} acts`}
          icon={<BookOpen className='h-4 w-4' />}
          active={selection.type === 'storyArc'}
          expanded={visibleExpandedSections.has('acts')}
          onSelect={() => onSelect({ type: 'storyArc' })}
          onToggle={() => toggleSection('acts')}
        >
          {visibleExpandedSections.has('acts')
            ? screenplayNavigation.acts.map((act) => (
                <ActTree
                  key={act.id}
                  act={act}
                  selection={selection}
                  sequences={screenplayNavigation.sequencesByActId.get(act.id) ?? []}
                  scenesBySequenceId={screenplayNavigation.scenesBySequenceId}
                  expandedActs={visibleExpandedActs}
                  expandedSequences={visibleExpandedSequences}
                  onToggleAct={toggleAct}
                  onToggleSequence={toggleSequence}
                  onSelect={onSelect}
                />
              ))
            : null}
        </StudioSidebarSection>

        <StudioSidebarButton
          active={selection.type === 'trash'}
          icon={<Trash2 className='h-4 w-4' />}
          label='Trash'
          detail='Discarded items'
          onClick={() => onSelect({ type: 'trash' })}
        />
      </div>
    </aside>
  );
}

function addValues<T>(current: Set<T>, values: readonly T[]): Set<T> {
  let changed = false;
  const next = new Set(current);
  for (const value of values) {
    if (!next.has(value)) {
      next.add(value);
      changed = true;
    }
  }
  return changed ? next : current;
}

function removeValue<T>(current: Set<T>, value: T): Set<T> {
  if (!current.has(value)) {
    return current;
  }
  const next = new Set(current);
  next.delete(value);
  return next;
}

function subtractValues<T>(current: Set<T>, values: ReadonlySet<T>): Set<T> {
  let changed = false;
  const next = new Set(current);
  for (const value of values) {
    if (next.delete(value)) {
      changed = true;
    }
  }
  return changed ? next : current;
}

function actIdForSequence(
  sequencesByActId: Map<string, SequenceNavigationRow[]>,
  sequenceId: string
): string | null {
  for (const [actId, sequences] of sequencesByActId) {
    if (sequences.some((sequence) => sequence.id === sequenceId)) {
      return actId;
    }
  }
  return null;
}

function ProjectCard({
  project,
  selection,
  onSelect,
}: {
  project: ProjectShellWithHttp;
  selection: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
}) {
  if (project.coverUrl) {
    return (
      <Button
        type='button'
        variant='ghost'
        onClick={() => onSelect({ type: 'projectInformation' })}
        className={cn(
          'group relative h-auto aspect-video w-full overflow-hidden rounded-md border bg-muted/50 p-0 text-left transition-colors hover:border-item-active-border hover:bg-muted/50',
          'whitespace-normal',
          selection.type === 'projectInformation'
            ? 'border-item-active-border'
            : 'border-border/40'
        )}
      >
        <img src={project.coverUrl} alt='' className='h-full w-full object-cover' />
        <span className='absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent' />
        <span className='absolute inset-x-0 bottom-0 p-3'>
          <span className='block break-words text-sm font-semibold leading-snug text-white drop-shadow-sm'>
            {project.identity.title}
          </span>
        </span>
      </Button>
    );
  }

  return (
    <Button
      type='button'
      variant='ghost'
      onClick={() => onSelect({ type: 'projectInformation' })}
      className={cn(
        'flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-md border bg-muted/35 px-3 py-3 text-left transition-colors hover:border-item-active-border hover:bg-item-hover-bg',
        selection.type === 'projectInformation'
          ? 'border-item-active-border bg-item-active-bg'
          : 'border-border/40'
      )}
    >
      <span className='mt-0.5 rounded-sm bg-background/70 p-1.5 text-muted-foreground'>
        <FileText className='h-4 w-4' />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold'>
          {project.identity.title}
        </span>
        <span className='block truncate text-xs text-muted-foreground'>
          Project Details
        </span>
      </span>
    </Button>
  );
}

function ActTree({
  act,
  selection,
  sequences,
  scenesBySequenceId,
  expandedActs,
  expandedSequences,
  onToggleAct,
  onToggleSequence,
  onSelect,
}: {
  act: ActNavigationRow;
  selection: StudioSelection;
  sequences: SequenceNavigationRow[];
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
  expandedActs: Set<string>;
  expandedSequences: Set<string>;
  onToggleAct: (actId: string) => void;
  onToggleSequence: (sequenceId: string) => void;
  onSelect: (selection: StudioSelection) => void;
}) {
  const expanded = expandedActs.has(act.id);
  const active = selection.type === 'act' && selection.id === act.id;
  return (
    <div className='space-y-1'>
      <Button
        type='button'
        variant='ghost'
        onClick={() => {
          onSelect({ type: 'act', id: act.id });
          onToggleAct(act.id);
        }}
        className={cn(
          'h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-item-hover-bg',
          active && 'bg-item-active-bg'
        )}
      >
        {expanded ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
        <span className='min-w-0 flex-1 truncate'>{act.title}</span>
      </Button>
      {expanded ? (
        <div className='ml-4 border-l border-border/30 pl-2 space-y-1'>
          {sequences.map((sequence) => (
            <SequenceTree
              key={sequence.id}
              sequence={sequence}
              selection={selection}
              scenes={scenesBySequenceId.get(sequence.id) ?? []}
              expanded={expandedSequences.has(sequence.id)}
              onToggleSequence={onToggleSequence}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SequenceTree({
  sequence,
  selection,
  scenes,
  expanded,
  onToggleSequence,
  onSelect,
}: {
  sequence: SequenceNavigationRow;
  selection: StudioSelection;
  scenes: SceneNavigationRow[];
  expanded: boolean;
  onToggleSequence: (sequenceId: string) => void;
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <div className='space-y-1'>
      <StudioSidebarButton
        active={selection.type === 'sequence' && selection.id === sequence.id}
        icon={<Layers3 className='h-4 w-4' />}
        label={sequence.title}
        detail={`${sequence.sceneCount} scenes`}
        onClick={() => onSelect({ type: 'sequence', id: sequence.id })}
        disclosure={{
          expanded,
          label: `${expanded ? 'Collapse' : 'Expand'} ${sequence.title}`,
          onToggle: () => onToggleSequence(sequence.id),
        }}
      />
      {expanded ? (
        <div className='ml-4 border-l border-border/30 pl-2 space-y-1'>
          {scenes.map((scene) => (
            <StudioSidebarButton
              key={scene.id}
              active={selection.type === 'scene' && selection.id === scene.id}
              icon={<FileText className='h-4 w-4' />}
              label={scene.title}
              detail='Scene'
              compact
              onClick={() => onSelect({ type: 'scene', id: scene.id })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

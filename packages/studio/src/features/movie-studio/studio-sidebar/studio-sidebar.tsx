import { useState } from 'react';
import {
  Clapperboard,
  Layers3,
  ListTree,
  Palette,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import {
  toggleSetValue,
  type MovieStudioSelection,
} from '../movie-studio-selection';
import { StudioSidebarButton } from './studio-sidebar-button';
import { StudioSidebarSection } from './studio-sidebar-section';

interface StudioSidebarProps {
  project: ProjectWithHttp;
  selection: MovieStudioSelection;
  onSelect: (selection: MovieStudioSelection) => void;
}

export function StudioSidebar({
  project,
  selection,
  onSelect,
}: StudioSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(['sequences', 'casting'])
  );
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(
    () => new Set(project.sequences.slice(0, 1).map((sequence) => sequence.id))
  );
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(
    () => new Set()
  );
  const sequencesExpanded = expandedSections.has('sequences');
  const castingExpanded = expandedSections.has('casting');

  const toggleSection = (section: string) => {
    setExpandedSections((current) => toggleSetValue(current, section));
  };

  const toggleSequence = (sequenceId: string) => {
    setExpandedSequences((current) => toggleSetValue(current, sequenceId));
  };

  const toggleScene = (sceneId: string) => {
    setExpandedScenes((current) => toggleSetValue(current, sceneId));
  };

  return (
    <aside className='min-h-0 rounded-(--radius-panel) border border-sidebar-border bg-sidebar-bg overflow-hidden flex flex-col'>
      <div className='h-[45px] px-4 border-b border-border/40 bg-sidebar-header-bg flex items-center justify-between shrink-0'>
        <div className='flex items-center gap-2'>
          <ListTree className='w-4 h-4 text-muted-foreground' />
          <h2 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
            Studio
          </h2>
        </div>
        <span className='text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-medium'>
          {project.counts.clips}
        </span>
      </div>

      {project.coverUrl ? (
        <div className='border-b border-border/40 p-3'>
          <button
            type='button'
            onClick={() => onSelect({ type: 'projectInformation' })}
            className='group relative aspect-video w-full overflow-hidden rounded-md border border-border/40 bg-muted/50 text-left transition-colors hover:border-item-active-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          >
            <img
              src={project.coverUrl}
              alt=''
              className='h-full w-full object-cover'
            />
            <span className='absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent' />
            <span className='absolute inset-x-0 bottom-0 p-3'>
              <span className='line-clamp-2 text-sm font-semibold text-white drop-shadow-sm'>
                {project.identity.title}
              </span>
            </span>
          </button>
        </div>
      ) : null}

      <div className='flex-1 min-h-0 overflow-y-auto p-2 space-y-4'>
        <StudioSidebarSection
          title='Visual Language'
          detail={`${project.counts.visualLanguage} entries`}
          icon={<Palette className='h-4 w-4' />}
          active={selection.type === 'visualLanguage'}
          expanded={false}
          onSelect={() => onSelect({ type: 'visualLanguage' })}
          onToggle={() => onSelect({ type: 'visualLanguage' })}
        >
          {null}
        </StudioSidebarSection>

        <StudioSidebarSection
          title='Cast'
          detail={`${project.cast.length} entries`}
          icon={<UsersRound className='h-4 w-4' />}
          active={selection.type === 'casting'}
          expanded={castingExpanded}
          onSelect={() => onSelect({ type: 'casting' })}
          onToggle={() => toggleSection('casting')}
        >
          {castingExpanded
            ? project.cast.map((castEntry) => (
                <StudioSidebarButton
                  key={castEntry.id}
                  active={selection.type === 'cast' && selection.id === castEntry.id}
                  icon={<UserRound className='h-4 w-4' />}
                  label={castEntry.name}
                  detail={castEntry.role ?? castEntry.kind ?? 'Cast entry'}
                  compact
                  onClick={() => onSelect({ type: 'cast', id: castEntry.id })}
                />
              ))
            : null}
        </StudioSidebarSection>

        <StudioSidebarSection
          title='Sequences'
          detail={`${project.counts.sequences} sequences, ${project.counts.clips} clips`}
          icon={<Layers3 className='h-4 w-4' />}
          active={selection.type === 'storyboard'}
          expanded={sequencesExpanded}
          onSelect={() => onSelect({ type: 'storyboard' })}
          onToggle={() => toggleSection('sequences')}
        >
          {sequencesExpanded
            ? project.sequences.map((sequence) => {
                const sequenceExpanded = expandedSequences.has(sequence.id);
                return (
                  <div key={sequence.id} className='space-y-1'>
                    <StudioSidebarButton
                      active={
                        selection.type === 'sequence' && selection.id === sequence.id
                      }
                      icon={<Layers3 className='h-4 w-4' />}
                      label={sequence.shortTitle ?? sequence.title}
                      detail={`${sequence.scenes.length} scenes`}
                      onClick={() => onSelect({ type: 'sequence', id: sequence.id })}
                      disclosure={{
                        expanded: sequenceExpanded,
                        label: `${sequenceExpanded ? 'Collapse' : 'Expand'} ${
                          sequence.shortTitle ?? sequence.title
                        }`,
                        onToggle: () => toggleSequence(sequence.id),
                      }}
                    />
                    {sequenceExpanded ? (
                      <div className='ml-4 border-l border-border/30 pl-2 space-y-1'>
                        {sequence.scenes.map((scene) => {
                          const sceneExpanded = expandedScenes.has(scene.id);
                          return (
                            <div key={scene.id} className='space-y-1'>
                              <StudioSidebarButton
                                active={
                                  selection.type === 'scene' &&
                                  selection.id === scene.id
                                }
                                icon={<Clapperboard className='h-4 w-4' />}
                                label={scene.title}
                                detail={`${scene.clips.length} clips`}
                                onClick={() =>
                                  onSelect({ type: 'scene', id: scene.id })
                                }
                                disclosure={{
                                  expanded: sceneExpanded,
                                  label: `${sceneExpanded ? 'Collapse' : 'Expand'} ${
                                    scene.title
                                  }`,
                                  onToggle: () => toggleScene(scene.id),
                                }}
                              />
                              {sceneExpanded ? (
                                <div className='ml-4 border-l border-border/20 pl-2 space-y-1'>
                                  {scene.clips.map((clip) => (
                                    <StudioSidebarButton
                                      key={clip.id}
                                      active={
                                        selection.type === 'clip' &&
                                        selection.id === clip.id
                                      }
                                      icon={<Sparkles className='h-3.5 w-3.5' />}
                                      label={clip.title}
                                      detail={clip.summary ?? 'Clip workspace'}
                                      compact
                                      onClick={() =>
                                        onSelect({ type: 'clip', id: clip.id })
                                      }
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            : null}
        </StudioSidebarSection>
      </div>
    </aside>
  );
}

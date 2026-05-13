import { useState } from 'react';
import {
  BookOpen,
  Clapperboard,
  FileText,
  Layers3,
  Palette,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import renkuLogo from '@/assets/renku-logo.svg';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type {
  ClipNavigationRow,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '@gorenku/studio-core';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { ThemeToggle } from '@/ui/theme-toggle';
import {
  toggleSetValue,
  type MovieStudioSelection,
} from '../movie-studio-selection';
import type { StoryNavigationState } from '../use-story-navigation';
import { StudioSidebarButton } from './studio-sidebar-button';
import { StudioSidebarSection } from './studio-sidebar-section';

interface StudioSidebarProps {
  project: ProjectShellWithHttp;
  storyNavigation: StoryNavigationState;
  selection: MovieStudioSelection;
  onSelect: (selection: MovieStudioSelection) => void;
  onHome: () => void;
}

export function StudioSidebar({
  project,
  storyNavigation,
  selection,
  onSelect,
  onHome,
}: StudioSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(['sequences', 'casting'])
  );
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(
    () => new Set()
  );
  const sequencesExpanded = expandedSections.has('sequences');
  const castingExpanded = expandedSections.has('casting');

  const toggleSection = (section: string) => {
    setExpandedSections((current) => toggleSetValue(current, section));
  };

  const toggleEpisode = (episodeId: string) => {
    setExpandedEpisodes((current) => toggleSetValue(current, episodeId));
    void storyNavigation.loadEpisodeSequences(episodeId);
  };

  const toggleSequence = (sequenceId: string) => {
    setExpandedSequences((current) => toggleSetValue(current, sequenceId));
    void storyNavigation.loadSequenceScenes(sequenceId);
  };

  const toggleScene = (sceneId: string) => {
    setExpandedScenes((current) => toggleSetValue(current, sceneId));
    void storyNavigation.loadSceneClips(sceneId);
  };

  const renderClip = (clip: ClipNavigationRow) => (
    <StudioSidebarButton
      key={clip.id}
      active={selection.type === 'clip' && selection.id === clip.id}
      icon={<Sparkles className='h-3.5 w-3.5' />}
      label={clip.title}
      detail={clip.oneLineSummary ?? 'Clip workspace'}
      compact
      onClick={() => onSelect({ type: 'clip', id: clip.id })}
    />
  );

  const renderScene = (scene: SceneNavigationRow) => {
    const sceneExpanded = expandedScenes.has(scene.id);
    const sceneLoading = storyNavigation.loadingKeys.has(`scene-clips:${scene.id}`);
    const clips = storyNavigation.clipsBySceneId.get(scene.id) ?? [];
    return (
      <div key={scene.id} className='space-y-1'>
        <StudioSidebarButton
          active={selection.type === 'scene' && selection.id === scene.id}
          icon={<Clapperboard className='h-4 w-4' />}
          label={scene.title}
          detail={`${scene.clipCount} clips`}
          onClick={() => onSelect({ type: 'scene', id: scene.id })}
          disclosure={{
            expanded: sceneExpanded,
            label: `${sceneExpanded ? 'Collapse' : 'Expand'} ${scene.title}`,
            onToggle: () => toggleScene(scene.id),
          }}
        />
        {sceneExpanded ? (
          <div className='ml-4 border-l border-border/20 pl-2 space-y-1'>
            {clips.map(renderClip)}
            {sceneLoading ? (
              <p className='px-2 py-1 text-xs text-muted-foreground'>Loading clips...</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSequence = (sequence: SequenceNavigationRow) => {
    const sequenceExpanded = expandedSequences.has(sequence.id);
    const sequenceLoading = storyNavigation.loadingKeys.has(
      `sequence-scenes:${sequence.id}`
    );
    const scenes = storyNavigation.scenesBySequenceId.get(sequence.id) ?? [];
    return (
      <div key={sequence.id} className='space-y-1'>
        <StudioSidebarButton
          active={selection.type === 'sequence' && selection.id === sequence.id}
          icon={<Layers3 className='h-4 w-4' />}
          label={sequence.shortTitle ?? sequence.title}
          detail={`${sequence.sceneCount} scenes, ${sequence.clipCount} clips`}
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
            {scenes.map(renderScene)}
            {sequenceLoading ? (
              <p className='px-2 py-1 text-xs text-muted-foreground'>Loading scenes...</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderStoryRows = () => {
    if (storyNavigation.projectType === 'standaloneMovie') {
      return storyNavigation.standaloneSequences.map(renderSequence);
    }

    return storyNavigation.episodes.map((episode) => {
      const episodeExpanded = expandedEpisodes.has(episode.id);
      const episodeLoading = storyNavigation.loadingKeys.has(
        `episode-sequences:${episode.id}`
      );
      const sequences = storyNavigation.sequencesByEpisodeId.get(episode.id) ?? [];
      return (
        <div key={episode.id} className='space-y-1'>
          <StudioSidebarButton
            active={false}
            icon={<BookOpen className='h-4 w-4' />}
            label={episode.shortTitle ?? episode.title}
            detail={`${episode.sequenceCount} sequences, ${episode.clipCount} clips`}
            onClick={() => toggleEpisode(episode.id)}
            disclosure={{
              expanded: episodeExpanded,
              label: `${episodeExpanded ? 'Collapse' : 'Expand'} ${
                episode.shortTitle ?? episode.title
              }`,
              onToggle: () => toggleEpisode(episode.id),
            }}
          />
          {episodeExpanded ? (
            <div className='ml-4 border-l border-border/30 pl-2 space-y-1'>
              {sequences.map(renderSequence)}
              {episodeLoading ? (
                <p className='px-2 py-1 text-xs text-muted-foreground'>
                  Loading sequences...
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    });
  };

  return (
    <aside className='min-h-0 rounded-(--radius-panel) border border-sidebar-border bg-sidebar-bg overflow-hidden flex flex-col'>
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
        <ThemeToggle />
      </div>

      <div className='border-b border-border/40 p-3'>
        {project.coverUrl ? (
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
            <img
              src={project.coverUrl}
              alt=''
              className='h-full w-full object-cover'
            />
            <span className='absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent' />
            <span className='absolute inset-x-0 bottom-0 p-3'>
              <span className='block break-words text-sm font-semibold leading-snug text-white drop-shadow-sm'>
                {project.identity.title}
              </span>
            </span>
          </Button>
        ) : (
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
                Project Information
              </span>
            </span>
          </Button>
        )}
      </div>

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
          {sequencesExpanded ? renderStoryRows() : null}
        </StudioSidebarSection>
      </div>
    </aside>
  );
}

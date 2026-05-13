import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  ClipNavigationRow,
  EpisodeNavigationRow,
  MovieStudioSelectionContext,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '@gorenku/studio-core';
import type {
  ClipNavigationPageResponse,
  ProjectShellWithHttp,
  SceneNavigationPageResponse,
  SequenceNavigationPageResponse,
} from '@/services/studio-project-contracts';
import {
  readClipNavigation,
  readEpisodeSequenceNavigation,
  readMovieStudioSelectionContext,
  readSceneNavigation,
} from '@/services/studio-projects-api';
import type { MovieStudioSelection } from './movie-studio-selection';

export interface StoryNavigationState {
  projectType: ProjectShellWithHttp['identity']['type'];
  episodes: EpisodeNavigationRow[];
  standaloneSequences: SequenceNavigationRow[];
  sequencesByEpisodeId: Map<string, SequenceNavigationRow[]>;
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
  clipsBySceneId: Map<string, ClipNavigationRow[]>;
  loadingKeys: Set<string>;
  error: string | null;
  loadEpisodeSequences: (episodeId: string) => Promise<void>;
  loadSequenceScenes: (sequenceId: string) => Promise<void>;
  loadSceneClips: (sceneId: string) => Promise<void>;
}

export function useStoryNavigation(
  project: ProjectShellWithHttp,
  selection: MovieStudioSelection
): StoryNavigationState {
  const projectName = project.identity.name;
  const storyStructure = project.navigation.storyStructure;
  const [episodeSequencePages, setEpisodeSequencePages] = useState<
    Map<string, SequenceNavigationPageResponse>
  >(() => new Map());
  const [scenePages, setScenePages] = useState<
    Map<string, SceneNavigationPageResponse>
  >(() => new Map());
  const [clipPages, setClipPages] = useState<Map<string, ClipNavigationPageResponse>>(
    () => new Map()
  );
  const [selectionContext, setSelectionContext] =
    useState<MovieStudioSelectionContext | null>(null);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const loadEpisodeSequences = useCallback(
    async (episodeId: string) => {
      if (episodeSequencePages.has(episodeId)) {
        return;
      }
      await loadNavigationPage({
        key: `episode-sequences:${episodeId}`,
        setLoadingKeys,
        setError,
        read: () => readEpisodeSequenceNavigation(projectName, episodeId),
        write: (page) =>
          setEpisodeSequencePages((current) => withMapEntry(current, episodeId, page)),
      });
    },
    [episodeSequencePages, projectName]
  );

  const loadSequenceScenes = useCallback(
    async (sequenceId: string) => {
      if (scenePages.has(sequenceId)) {
        return;
      }
      await loadNavigationPage({
        key: `sequence-scenes:${sequenceId}`,
        setLoadingKeys,
        setError,
        read: () => readSceneNavigation(projectName, sequenceId),
        write: (page) =>
          setScenePages((current) => withMapEntry(current, sequenceId, page)),
      });
    },
    [projectName, scenePages]
  );

  const loadSceneClips = useCallback(
    async (sceneId: string) => {
      if (clipPages.has(sceneId)) {
        return;
      }
      await loadNavigationPage({
        key: `scene-clips:${sceneId}`,
        setLoadingKeys,
        setError,
        read: () => readClipNavigation(projectName, sceneId),
        write: (page) =>
          setClipPages((current) => withMapEntry(current, sceneId, page)),
      });
    },
    [clipPages, projectName]
  );

  useEffect(() => {
    if (!isStorySelection(selection)) {
      return;
    }
    if (canResolveSelection(selection, {
      storyStructure,
      episodeSequencePages,
      scenePages,
      clipPages,
      selectionContext,
    })) {
      return;
    }
    let cancelled = false;
    void readMovieStudioSelectionContext(projectName, { selection })
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.valid) {
          setSelectionContext(result.context);
        } else {
          setError('The selected story item could not be found.');
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(errorMessage(loadError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    clipPages,
    episodeSequencePages,
    projectName,
    scenePages,
    selection,
    selectionContext,
    storyStructure,
  ]);

  return useMemo(() => {
    const contextRows = rowsFromSelectionContext(selectionContext);
    const episodes =
      storyStructure.projectType === 'series'
        ? appendUniqueRows(storyStructure.episodes.items, contextRows.episodes)
        : [];
    const standaloneSequences =
      storyStructure.projectType === 'standaloneMovie'
        ? appendUniqueRows(storyStructure.sequences.items, contextRows.sequences)
        : [];
    const sequencesByEpisodeId = new Map<string, SequenceNavigationRow[]>();
    for (const [episodeId, page] of episodeSequencePages) {
      sequencesByEpisodeId.set(
        episodeId,
        appendUniqueRows(page.items, contextRows.sequencesByEpisodeId.get(episodeId) ?? [])
      );
    }
    for (const [episodeId, rows] of contextRows.sequencesByEpisodeId) {
      if (!sequencesByEpisodeId.has(episodeId)) {
        sequencesByEpisodeId.set(episodeId, rows);
      }
    }

    const scenesBySequenceId = new Map<string, SceneNavigationRow[]>();
    for (const [sequenceId, page] of scenePages) {
      scenesBySequenceId.set(
        sequenceId,
        appendUniqueRows(page.items, contextRows.scenesBySequenceId.get(sequenceId) ?? [])
      );
    }
    for (const [sequenceId, rows] of contextRows.scenesBySequenceId) {
      if (!scenesBySequenceId.has(sequenceId)) {
        scenesBySequenceId.set(sequenceId, rows);
      }
    }

    const clipsBySceneId = new Map<string, ClipNavigationRow[]>();
    for (const [sceneId, page] of clipPages) {
      clipsBySceneId.set(
        sceneId,
        appendUniqueRows(page.items, contextRows.clipsBySceneId.get(sceneId) ?? [])
      );
    }
    for (const [sceneId, rows] of contextRows.clipsBySceneId) {
      if (!clipsBySceneId.has(sceneId)) {
        clipsBySceneId.set(sceneId, rows);
      }
    }

    return {
      projectType: project.identity.type,
      episodes,
      standaloneSequences,
      sequencesByEpisodeId,
      scenesBySequenceId,
      clipsBySceneId,
      loadingKeys,
      error,
      loadEpisodeSequences,
      loadSequenceScenes,
      loadSceneClips,
    };
  }, [
    clipPages,
    episodeSequencePages,
    error,
    loadEpisodeSequences,
    loadSceneClips,
    loadSequenceScenes,
    loadingKeys,
    project.identity.type,
    scenePages,
    selectionContext,
    storyStructure,
  ]);
}

async function loadNavigationPage<T>({
  key,
  setLoadingKeys,
  setError,
  read,
  write,
}: {
  key: string;
  setLoadingKeys: Dispatch<SetStateAction<Set<string>>>;
  setError: Dispatch<SetStateAction<string | null>>;
  read: () => Promise<PageResponse<T>>;
  write: (page: PageResponse<T>) => void;
}): Promise<void> {
  setLoadingKeys((current) => setWithValue(current, key));
  setError(null);
  try {
    write(await read());
  } catch (error) {
    setError(errorMessage(error));
  } finally {
    setLoadingKeys((current) => setWithoutValue(current, key));
  }
}

function rowsFromSelectionContext(context: MovieStudioSelectionContext | null): {
  episodes: EpisodeNavigationRow[];
  sequences: SequenceNavigationRow[];
  sequencesByEpisodeId: Map<string, SequenceNavigationRow[]>;
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
  clipsBySceneId: Map<string, ClipNavigationRow[]>;
} {
  const rows = {
    episodes: [] as EpisodeNavigationRow[],
    sequences: [] as SequenceNavigationRow[],
    sequencesByEpisodeId: new Map<string, SequenceNavigationRow[]>(),
    scenesBySequenceId: new Map<string, SceneNavigationRow[]>(),
    clipsBySceneId: new Map<string, ClipNavigationRow[]>(),
  };
  if (!context) {
    return rows;
  }
  if ('episode' in context && context.episode) {
    rows.episodes.push(context.episode);
  }
  if ('sequence' in context) {
    if (context.sequence.episodeId) {
      rows.sequencesByEpisodeId.set(context.sequence.episodeId, [context.sequence]);
    } else {
      rows.sequences.push(context.sequence);
    }
  }
  if ('scene' in context) {
    rows.scenesBySequenceId.set(context.scene.sequenceId, [context.scene]);
  }
  if ('clip' in context) {
    rows.clipsBySceneId.set(context.clip.sceneId, [context.clip]);
  }
  return rows;
}

function canResolveSelection(
  selection: MovieStudioSelection,
  input: {
    storyStructure: ProjectShellWithHttp['navigation']['storyStructure'];
    episodeSequencePages: Map<string, SequenceNavigationPageResponse>;
    scenePages: Map<string, SceneNavigationPageResponse>;
    clipPages: Map<string, ClipNavigationPageResponse>;
    selectionContext: MovieStudioSelectionContext | null;
  }
): boolean {
  if (selection.type === 'sequence') {
    return (
      sequenceRows(input).some((sequence) => sequence.id === selection.id) ||
      contextMatches(input.selectionContext, selection)
    );
  }
  if (selection.type === 'scene') {
    return (
      Array.from(input.scenePages.values()).some((page) =>
        page.items.some((scene) => scene.id === selection.id)
      ) || contextMatches(input.selectionContext, selection)
    );
  }
  if (selection.type === 'clip') {
    return (
      Array.from(input.clipPages.values()).some((page) =>
        page.items.some((clip) => clip.id === selection.id)
      ) || contextMatches(input.selectionContext, selection)
    );
  }
  return true;
}

function sequenceRows(input: {
  storyStructure: ProjectShellWithHttp['navigation']['storyStructure'];
  episodeSequencePages: Map<string, SequenceNavigationPageResponse>;
}): SequenceNavigationRow[] {
  if (input.storyStructure.projectType === 'standaloneMovie') {
    return input.storyStructure.sequences.items;
  }
  return Array.from(input.episodeSequencePages.values()).flatMap((page) => page.items);
}

function contextMatches(
  context: MovieStudioSelectionContext | null,
  selection: MovieStudioSelection
): boolean {
  if (!context) {
    return false;
  }
  if (selection.type === 'sequence' && 'sequence' in context) {
    return context.sequence.id === selection.id;
  }
  if (selection.type === 'scene' && 'scene' in context) {
    return context.scene.id === selection.id;
  }
  if (selection.type === 'clip' && 'clip' in context) {
    return context.clip.id === selection.id;
  }
  return false;
}

function isStorySelection(
  selection: MovieStudioSelection
): selection is Extract<MovieStudioSelection, { type: 'sequence' | 'scene' | 'clip' }> {
  return selection.type === 'sequence' || selection.type === 'scene' || selection.type === 'clip';
}

function appendUniqueRows<T extends { id: string }>(rows: T[], extraRows: T[]): T[] {
  const seen = new Set(rows.map((row) => row.id));
  const nextRows = [...rows];
  for (const row of extraRows) {
    if (!seen.has(row.id)) {
      nextRows.push(row);
      seen.add(row.id);
    }
  }
  return nextRows;
}

function withMapEntry<K, V>(current: Map<K, V>, key: K, value: V): Map<K, V> {
  const next = new Map(current);
  next.set(key, value);
  return next;
}

function setWithValue<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current);
  next.add(value);
  return next;
}

function setWithoutValue<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current);
  next.delete(value);
  return next;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Story navigation failed to load.';
}

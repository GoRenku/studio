import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  StudioSelectionContext,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '@gorenku/studio-core/client';
import type {
  ProjectShellWithHttp,
  SceneNavigationPageResponse,
} from '@/services/studio-project-contracts';
import {
  readStudioSelectionContext,
  readSceneNavigation,
} from '@/services/studio-projects-api';
import type { StudioSelection } from './movie-studio-selection';

export interface StoryNavigationState {
  sequences: SequenceNavigationRow[];
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
  loadingKeys: Set<string>;
  error: string | null;
  loadSequenceScenes: (sequenceId: string) => Promise<void>;
}

export function useStoryNavigation(
  project: ProjectShellWithHttp,
  selection: StudioSelection
): StoryNavigationState {
  const projectName = project.identity.name;
  const screenplay = project.navigation.screenplay;
  const [scenePages, setScenePages] = useState<
    Map<string, SceneNavigationPageResponse>
  >(() => new Map());
  const [selectionContext, setSelectionContext] =
    useState<StudioSelectionContext | null>(null);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isStorySelection(selection)) {
      return;
    }
    if (canResolveSelection(selection, {
      screenplay,
      scenePages,
      selectionContext,
    })) {
      return;
    }
    let cancelled = false;
    void readStudioSelectionContext(projectName, { selection })
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
    projectName,
    scenePages,
    selection,
    selectionContext,
    screenplay,
  ]);

  return useMemo(() => {
    const contextRows = rowsFromSelectionContext(selectionContext);
    const sequences = appendUniqueRows(
      screenplay.sequences.items,
      contextRows.sequences
    );

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

    return {
      sequences,
      scenesBySequenceId,
      loadingKeys,
      error,
      loadSequenceScenes,
    };
  }, [
    error,
    loadSequenceScenes,
    loadingKeys,
    scenePages,
    selectionContext,
    screenplay,
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

function rowsFromSelectionContext(context: StudioSelectionContext | null): {
  sequences: SequenceNavigationRow[];
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
} {
  const rows = {
    sequences: [] as SequenceNavigationRow[],
    scenesBySequenceId: new Map<string, SceneNavigationRow[]>(),
  };
  if (!context) {
    return rows;
  }
  if ('sequence' in context) {
    rows.sequences.push(context.sequence);
  }
  if ('scene' in context) {
    rows.scenesBySequenceId.set(context.scene.sequenceId, [context.scene]);
  }
  return rows;
}

function canResolveSelection(
  selection: StudioSelection,
  input: {
    screenplay: ProjectShellWithHttp['navigation']['screenplay'];
    scenePages: Map<string, SceneNavigationPageResponse>;
    selectionContext: StudioSelectionContext | null;
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
  return true;
}

function sequenceRows(input: {
  screenplay: ProjectShellWithHttp['navigation']['screenplay'];
}): SequenceNavigationRow[] {
  return input.screenplay.sequences.items;
}

function contextMatches(
  context: StudioSelectionContext | null,
  selection: StudioSelection
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
  return false;
}

function isStorySelection(
  selection: StudioSelection
): selection is Extract<StudioSelection, { type: 'sequence' | 'scene' }> {
  return selection.type === 'sequence' || selection.type === 'scene';
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

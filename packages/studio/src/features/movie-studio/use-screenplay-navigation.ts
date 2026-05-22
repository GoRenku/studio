import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  ActNavigationRow,
  CastNavigationRow,
  LocationNavigationRow,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
  StudioSelectionContext,
} from '@gorenku/studio-core/client';
import type {
  ProjectShellWithHttp,
  SceneNavigationPageResponse,
  SequenceNavigationPageResponse,
} from '@/services/studio-project-contracts';
import { readStudioSelectionContext } from '@/services/studio-projects-api';
import {
  readActNavigation,
  readScenesForSequence,
  readSequencesForAct,
} from '@/services/studio-screenplay-api';
import type { StudioSelection } from './movie-studio-selection';

export interface ScreenplayNavigationState {
  cast: CastNavigationRow[];
  locations: LocationNavigationRow[];
  acts: ActNavigationRow[];
  sequencesByActId: Map<string, SequenceNavigationRow[]>;
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
  loadingKeys: Set<string>;
  error: string | null;
  loadActs: () => Promise<void>;
  loadActSequences: (actId: string) => Promise<void>;
  loadSequenceScenes: (sequenceId: string) => Promise<void>;
}

export function useScreenplayNavigation(
  project: ProjectShellWithHttp,
  selection: StudioSelection
): ScreenplayNavigationState {
  const projectName = project.identity.name;
  const shellCast = project.navigation.cast;
  const shellLocations = project.navigation.locations;
  const shellActs = project.navigation.screenplay.acts;
  const [loadedActPage, setLoadedActPage] =
    useState<PageResponse<ActNavigationRow> | null>(null);
  const actPage = loadedActPage ?? shellActs;
  const [sequencePages, setSequencePages] = useState<
    Map<string, SequenceNavigationPageResponse>
  >(() => new Map());
  const [scenePages, setScenePages] = useState<
    Map<string, SceneNavigationPageResponse>
  >(() => new Map());
  const [selectionContext, setSelectionContext] =
    useState<StudioSelectionContext | null>(null);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const loadActs = useCallback(async () => {
    await loadNavigationPage({
      key: 'acts',
      setLoadingKeys,
      setError,
      read: () => readActNavigation(projectName),
      write: setLoadedActPage,
    });
  }, [projectName]);

  const loadActSequences = useCallback(
    async (actId: string) => {
      if (sequencePages.has(actId)) {
        return;
      }
      await loadNavigationPage({
        key: `act-sequences:${actId}`,
        setLoadingKeys,
        setError,
        read: () => readSequencesForAct(projectName, actId),
        write: (page) =>
          setSequencePages((current) => withMapEntry(current, actId, page)),
      });
    },
    [projectName, sequencePages]
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
        read: () => readScenesForSequence(projectName, sequenceId),
        write: (page) =>
          setScenePages((current) => withMapEntry(current, sequenceId, page)),
      });
    },
    [projectName, scenePages]
  );

  useEffect(() => {
    if (!needsSelectionContext(selection)) {
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
          setError('The selected screenplay item could not be found.');
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
  }, [projectName, selection]);

  return useMemo(() => {
    const contextRows = rowsFromSelectionContext(selectionContext);
    const acts = appendUniqueRows(actPage.items, contextRows.acts);
    const cast = appendUniqueRows(shellCast.items, contextRows.cast);
    const locations = appendUniqueRows(
      shellLocations.items,
      contextRows.locations
    );
    const sequencesByActId = new Map<string, SequenceNavigationRow[]>();
    for (const [actId, page] of sequencePages) {
      sequencesByActId.set(
        actId,
        appendUniqueRows(page.items, contextRows.sequencesByActId.get(actId) ?? [])
      );
    }
    for (const [actId, rows] of contextRows.sequencesByActId) {
      if (!sequencesByActId.has(actId)) {
        sequencesByActId.set(actId, rows);
      }
    }
    const scenesBySequenceId = new Map<string, SceneNavigationRow[]>();
    for (const [sequenceId, page] of scenePages) {
      scenesBySequenceId.set(
        sequenceId,
        appendUniqueRows(
          page.items,
          contextRows.scenesBySequenceId.get(sequenceId) ?? []
        )
      );
    }
    for (const [sequenceId, rows] of contextRows.scenesBySequenceId) {
      if (!scenesBySequenceId.has(sequenceId)) {
        scenesBySequenceId.set(sequenceId, rows);
      }
    }
    return {
      cast,
      locations,
      acts,
      sequencesByActId,
      scenesBySequenceId,
      loadingKeys,
      error,
      loadActs,
      loadActSequences,
      loadSequenceScenes,
    };
  }, [
    actPage,
    error,
    loadActSequences,
    loadActs,
    loadSequenceScenes,
    loadingKeys,
    shellCast.items,
    shellLocations.items,
    scenePages,
    selectionContext,
    sequencePages,
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
  cast: CastNavigationRow[];
  locations: LocationNavigationRow[];
  acts: ActNavigationRow[];
  sequencesByActId: Map<string, SequenceNavigationRow[]>;
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
} {
  const rows = {
    cast: [] as CastNavigationRow[],
    locations: [] as LocationNavigationRow[],
    acts: [] as ActNavigationRow[],
    sequencesByActId: new Map<string, SequenceNavigationRow[]>(),
    scenesBySequenceId: new Map<string, SceneNavigationRow[]>(),
  };
  if (!context) {
    return rows;
  }
  if ('castMember' in context) {
    rows.cast.push(context.castMember);
  }
  if ('location' in context) {
    rows.locations.push(context.location);
  }
  if ('act' in context) {
    rows.acts.push(context.act);
  }
  if ('sequence' in context) {
    rows.sequencesByActId.set(context.sequence.actId, [context.sequence]);
  }
  if ('scene' in context) {
    rows.scenesBySequenceId.set(context.scene.sequenceId, [context.scene]);
  }
  return rows;
}

function needsSelectionContext(selection: StudioSelection): boolean {
  return ['castMember', 'location', 'sequence', 'scene'].includes(selection.type);
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
  return error instanceof Error ? error.message : 'Screenplay navigation failed to load.';
}

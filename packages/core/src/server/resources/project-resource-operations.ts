import type {
  Asset,
  CastDesignResource,
  CastNavigationRow,
  ClipDesignResource,
  ClipNavigationRow,
  ContinuityReferenceNavigationRow,
  EpisodeNavigationRow,
  StudioSelection,
  StudioSelectionContextResult,
  PageResponse,
  ProjectInformationResource,
  ProjectShell,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '../../client/index.js';
import {
  listAssetRelationshipPage,
} from '../database/access/asset-relationships/index.js';
import {
  assertProjectType,
  listCastNavigationPage,
  listClipNavigationPage,
  listContinuityReferenceNavigationPage,
  listEpisodeNavigationPage,
  listEpisodeSequenceNavigationPage,
  listSceneNavigationPage,
  listStandaloneMovieSequenceNavigationPage,
} from './navigation.js';
import { readCastDesignResourceProjection } from '../resources/cast-design.js';
import { readClipDesignResourceProjection } from '../resources/clip-design.js';
import { readStudioSelectionContextProjection } from '../resources/selection-context.js';
import { readProjectInformationResource } from '../resources/project-information.js';
import { readProjectShellProjection } from '../resources/project-shell.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type {
  ListAssetPageInput,
  ListClipNavigationInput,
  ListEpisodeSequenceNavigationInput,
  ListNavigationInput,
  ListSceneNavigationInput,
  ReadCastDesignResourceInput,
  ReadClipDesignResourceInput,
  ReadProjectInput,
} from '../project-data-service-contracts.js';

export async function readProjectShell(input: ReadProjectInput): Promise<ProjectShell> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    return readProjectShellProjection(session, {
      projectFolder,
    });
  } finally {
    session.close();
  }
}

export async function readProjectInformationResourceForProject(
  input: ReadProjectInput
): Promise<ProjectInformationResource> {
  const { session } = await openProjectSession(input);
  try {
    return readProjectInformationResource(session);
  } finally {
    session.close();
  }
}

export async function listCastNavigation(
  input: ListNavigationInput
): Promise<PageResponse<CastNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    return listCastNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listContinuityReferenceNavigation(
  input: ListNavigationInput
): Promise<PageResponse<ContinuityReferenceNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    return listContinuityReferenceNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listEpisodeNavigation(
  input: ListNavigationInput
): Promise<PageResponse<EpisodeNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    assertProjectType(session, 'series');
    return listEpisodeNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listStandaloneMovieSequenceNavigation(
  input: ListNavigationInput
): Promise<PageResponse<SequenceNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    assertProjectType(session, 'standaloneMovie');
    return listStandaloneMovieSequenceNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listEpisodeSequenceNavigation(
  input: ListEpisodeSequenceNavigationInput
): Promise<PageResponse<SequenceNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    assertProjectType(session, 'series');
    return listEpisodeSequenceNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listSceneNavigation(
  input: ListSceneNavigationInput
): Promise<PageResponse<SceneNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    return listSceneNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listClipNavigation(
  input: ListClipNavigationInput
): Promise<PageResponse<ClipNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    return listClipNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listAssetPage(
  input: ListAssetPageInput
): Promise<PageResponse<Asset>> {
  const { session } = await openProjectSession(input);
  try {
    return listAssetRelationshipPage(session, input);
  } finally {
    session.close();
  }
}

export async function readCastDesignResource(
  input: ReadCastDesignResourceInput
): Promise<CastDesignResource> {
  const { session } = await openProjectSession(input);
  try {
    return readCastDesignResourceProjection(session, input);
  } finally {
    session.close();
  }
}

export async function readClipDesignResource(
  input: ReadClipDesignResourceInput
): Promise<ClipDesignResource> {
  const { session } = await openProjectSession(input);
  try {
    return readClipDesignResourceProjection(session, input);
  } finally {
    session.close();
  }
}

export async function readStudioSelectionContext(input: {
  projectName: string;
  selection: StudioSelection;
  homeDir?: string;
}): Promise<StudioSelectionContextResult> {
  const { session } = await openProjectSession(input);
  try {
    return readStudioSelectionContextProjection(session, {
      selection: input.selection,
    });
  } finally {
    session.close();
  }
}

import type {
  CastNavigationRow,
  ClipNavigationRow,
  ContinuityReferenceNavigationRow,
  EpisodeNavigationRow,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '../../client/index.js';
import {
  assertProjectType,
  listCastNavigationPage,
  listClipNavigationPage,
  listContinuityReferenceNavigationPage,
  listEpisodeNavigationPage,
  listEpisodeSequenceNavigationPage,
  listSceneNavigationPage,
  listStandaloneMovieSequenceNavigationPage,
} from '../database/access/navigation.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type {
  ListClipNavigationInput,
  ListEpisodeSequenceNavigationInput,
  ListNavigationInput,
  ListSceneNavigationInput,
} from '../project-data-service-contracts.js';

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

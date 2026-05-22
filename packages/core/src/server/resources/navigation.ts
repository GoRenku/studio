import type {
  ActNavigationRow,
  CastNavigationRow,
  LocationNavigationRow,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '../../client/index.js';
import {
  listActNavigationPage,
  listCastNavigationPage,
  listLocationNavigationPage,
  listSceneNavigationPage,
  listSequenceNavigationPage,
} from '../database/access/navigation.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type {
  ListNavigationInput,
  ListSequencesForActNavigationInput,
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

export async function listLocationNavigation(
  input: ListNavigationInput
): Promise<PageResponse<LocationNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    return listLocationNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listActNavigation(
  input: ListNavigationInput
): Promise<PageResponse<ActNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    return listActNavigationPage(session, input);
  } finally {
    session.close();
  }
}

export async function listSequenceNavigation(
  input: ListNavigationInput | ListSequencesForActNavigationInput
): Promise<PageResponse<SequenceNavigationRow>> {
  const { session } = await openProjectSession(input);
  try {
    return listSequenceNavigationPage(session, input);
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

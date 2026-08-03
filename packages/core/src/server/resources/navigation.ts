import type {
  CastNavigationRow,
  LocationNavigationRow,
  PageResponse,
  PropNavigationRow,
} from '../../client/index.js';
import {
  listCastNavigationPage,
  listLocationNavigationPage,
  listPropNavigationPage,
} from '../database/access/navigation.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { ListNavigationInput } from '../project-data-service-contracts.js';

export async function listCastNavigation(
  input: ListNavigationInput,
): Promise<PageResponse<CastNavigationRow>> {
  const { session } = await openProjectSession(input);
  try { return listCastNavigationPage(session, input); } finally { session.close(); }
}

export async function listLocationNavigation(
  input: ListNavigationInput,
): Promise<PageResponse<LocationNavigationRow>> {
  const { session } = await openProjectSession(input);
  try { return listLocationNavigationPage(session, input); } finally { session.close(); }
}

export async function listPropNavigation(
  input: ListNavigationInput,
): Promise<PageResponse<PropNavigationRow>> {
  const { session } = await openProjectSession(input);
  try { return listPropNavigationPage(session, input); } finally { session.close(); }
}

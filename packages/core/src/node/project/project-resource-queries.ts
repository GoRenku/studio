import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  Asset,
  AssetFile,
  AssetLocaleContext,
  AssetTarget,
  CastDesignAssetRoleCount,
  CastDesignResource,
  CastMember,
  CastNavigationRow,
  Clip,
  ClipDesignResource,
  ClipNavigationRow,
  ContinuityReference,
  ContinuityReferenceNavigationRow,
  Episode,
  EpisodeNavigationRow,
  MovieStudioSelection,
  MovieStudioSelectionContextResult,
  PageResponse,
  ProjectCounts,
  ProjectIdentity,
  ProjectLanguage,
  ProjectShell,
  SceneNavigationRow,
  Sequence,
  SequenceNavigationRow,
  VisualLanguage,
  VisualLanguageCategory,
  VisualLanguageNavigationRow,
} from '../../project/index.js';
import { ProjectDataError } from '../../project/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../config.js';
import { openProjectStore, type ProjectDataSession } from './data/sqlite-project-store.js';
import { resolveProjectFolder } from './files/project-paths.js';
import { normalizeProjectRelativePath } from './files/project-relative-paths.js';

export const DEFAULT_NAVIGATION_PAGE_LIMIT = 100;
export const DEFAULT_ASSET_PAGE_LIMIT = 60;
export const MAX_RESOURCE_PAGE_LIMIT = 200;

interface ProjectRecordRow {
  id: string;
  name: string;
  title: string;
  type: string;
  folderPath: string;
  databasePath: string;
  aspectRatio: string | null;
  logline: string | null;
  coverFile: string | null;
}

interface AssetRelationshipConfig {
  tableName: string;
  targetColumn: string | null;
  targetId: string | null;
}

interface AssetRelationshipRow {
  relationshipId: string;
  assetId: string;
  targetId: string | null;
  localeId: string | null;
  role: string;
  sortOrder: number;
  selection: string;
  selectionOrder: number | null;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  availability: string;
  createdAt: string;
  updatedAt: string;
}

interface AssetFileRow {
  id: string;
  assetId: string;
  role: string;
  projectRelativePath: string;
  mimeType: string | null;
  mediaKind: string;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface ListNavigationInput extends RenkuConfigPathOptions {
  projectName: string;
  limit?: number;
  cursor?: string | null;
}

export interface ListEpisodeSequenceNavigationInput extends ListNavigationInput {
  episodeId: string;
}

export interface ListSceneNavigationInput extends ListNavigationInput {
  sequenceId: string;
}

export interface ListClipNavigationInput extends ListNavigationInput {
  sceneId: string;
}

export interface ReadCastDesignResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  castMemberId: string;
  activeRole?: string;
  limit?: number;
  cursor?: string | null;
}

export interface ReadClipDesignResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  clipId: string;
  activeRole?: string;
  limit?: number;
  cursor?: string | null;
}

export interface ReadMovieStudioSelectionContextInput extends RenkuConfigPathOptions {
  projectName: string;
  selection: MovieStudioSelection;
}

export interface ListAssetPageInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
  role?: string;
  mediaKind?: string;
  selection?: 'take' | 'select';
  limit?: number;
  cursor?: string | null;
}

export async function readProjectShell(
  input: ListNavigationInput
): Promise<ProjectShell> {
  const { projectFolder, session } = await openResourceSession(input);
  try {
    const project = readProjectRecord(session, projectFolder);
    const counts = readProjectCounts(session);
    const languages = readLanguages(session);
    const castPage = listCastNavigationFromSession(session, input);
    const visualLanguagePage = listVisualLanguageNavigationFromSession(
      session,
      input
    );
    const continuityPage = listContinuityReferenceNavigationFromSession(
      session,
      input
    );

    if (project.identity.type === 'series') {
      const episodePage = listEpisodeNavigationFromSession(session, input);
      return {
        ...project,
        languages,
        visualLanguageCategories: readVisualLanguageCategories(session),
        visualLanguage: visualLanguagePage.items.map(toVisualLanguageShellRow),
        cast: castPage.items.map(toCastMemberShellRow),
        continuityReferences: continuityPage.items.map(
          toContinuityReferenceShellRow
        ),
        episodes: episodePage.items.map(toEpisodeShellRow),
        sequences: [],
        counts,
        navigation: {
          cast: castPage,
          visualLanguage: visualLanguagePage,
          continuityReferences: continuityPage,
          storyStructure: {
            projectType: 'series',
            episodes: episodePage,
          },
        },
      };
    }

    const sequencePage = listStandaloneMovieSequenceNavigationFromSession(
      session,
      input
    );
    return {
      ...project,
      languages,
      visualLanguageCategories: readVisualLanguageCategories(session),
      visualLanguage: visualLanguagePage.items.map(toVisualLanguageShellRow),
      cast: castPage.items.map(toCastMemberShellRow),
      continuityReferences: continuityPage.items.map(toContinuityReferenceShellRow),
      episodes: [],
      sequences: readStandaloneMovieSequenceShellRows(session, sequencePage.items),
      counts,
      navigation: {
        cast: castPage,
        visualLanguage: visualLanguagePage,
        continuityReferences: continuityPage,
        storyStructure: {
          projectType: 'standaloneMovie',
          sequences: sequencePage,
        },
      },
    };
  } finally {
    session.close();
  }
}

export async function listCastNavigation(
  input: ListNavigationInput
): Promise<PageResponse<CastNavigationRow>> {
  const { session } = await openResourceSession(input);
  try {
    return listCastNavigationFromSession(session, input);
  } finally {
    session.close();
  }
}

export async function listContinuityReferenceNavigation(
  input: ListNavigationInput
): Promise<PageResponse<ContinuityReferenceNavigationRow>> {
  const { session } = await openResourceSession(input);
  try {
    return listContinuityReferenceNavigationFromSession(session, input);
  } finally {
    session.close();
  }
}

export async function listEpisodeNavigation(
  input: ListNavigationInput
): Promise<PageResponse<EpisodeNavigationRow>> {
  const { session } = await openResourceSession(input);
  try {
    assertProjectType(session, 'series');
    return listEpisodeNavigationFromSession(session, input);
  } finally {
    session.close();
  }
}

export async function listStandaloneMovieSequenceNavigation(
  input: ListNavigationInput
): Promise<PageResponse<SequenceNavigationRow>> {
  const { session } = await openResourceSession(input);
  try {
    assertProjectType(session, 'standaloneMovie');
    return listStandaloneMovieSequenceNavigationFromSession(session, input);
  } finally {
    session.close();
  }
}

export async function listEpisodeSequenceNavigation(
  input: ListEpisodeSequenceNavigationInput
): Promise<PageResponse<SequenceNavigationRow>> {
  const { session } = await openResourceSession(input);
  try {
    assertProjectType(session, 'series');
    assertExists(session, 'episode', input.episodeId, 'PROJECT_DATA112');
    return listSequenceNavigationFromSession(session, {
      ...input,
      episodeId: input.episodeId,
    });
  } finally {
    session.close();
  }
}

export async function listSceneNavigation(
  input: ListSceneNavigationInput
): Promise<PageResponse<SceneNavigationRow>> {
  const { session } = await openResourceSession(input);
  try {
    assertExists(session, 'sequence', input.sequenceId, 'PROJECT_DATA113');
    return listSceneNavigationFromSession(session, input);
  } finally {
    session.close();
  }
}

export async function listClipNavigation(
  input: ListClipNavigationInput
): Promise<PageResponse<ClipNavigationRow>> {
  const { session } = await openResourceSession(input);
  try {
    assertExists(session, 'scene', input.sceneId, 'PROJECT_DATA114');
    return listClipNavigationFromSession(session, input);
  } finally {
    session.close();
  }
}

export async function listAssetPage(
  input: ListAssetPageInput
): Promise<PageResponse<Asset>> {
  const { session } = await openResourceSession(input);
  try {
    return listAssetPageFromSession(session, input);
  } finally {
    session.close();
  }
}

export async function readCastDesignResource(
  input: ReadCastDesignResourceInput
): Promise<CastDesignResource> {
  const { session } = await openResourceSession(input);
  try {
    const castMember = readCastMember(session, input.castMemberId);
    if (!castMember) {
      throw notFound('PROJECT_DATA115', `Cast member was not found: ${input.castMemberId}.`);
    }
    const target: AssetTarget = {
      kind: 'castMember',
      castMemberId: input.castMemberId,
    };
    const selectedAssets = listAssetPageFromSession(session, {
      ...input,
      target,
      selection: 'select',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items;
    const activeTakePage = listAssetPageFromSession(session, {
      ...input,
      target,
      role: input.activeRole ?? 'character_sheet',
      selection: 'take',
      limit: input.limit ?? DEFAULT_ASSET_PAGE_LIMIT,
      cursor: input.cursor,
    });
    return {
      castMember,
      selectedAssets,
      activeTakePage,
      countsByRole: readAssetCountsByRole(session, assetRelationshipConfig(target)),
    };
  } finally {
    session.close();
  }
}

export async function readClipDesignResource(
  input: ReadClipDesignResourceInput
): Promise<ClipDesignResource> {
  const { session } = await openResourceSession(input);
  try {
    const context = readClipContext(session, input.clipId);
    const target: AssetTarget = { kind: 'clip', clipId: input.clipId };
    return {
      clip: context.clip,
      scene: context.scene,
      sequence: context.sequence,
      episode: context.episode,
      selectedAssets: listAssetPageFromSession(session, {
        ...input,
        target,
        selection: 'select',
        limit: MAX_RESOURCE_PAGE_LIMIT,
      }).items,
      activeTakePage: listAssetPageFromSession(session, {
        ...input,
        target,
        role: input.activeRole,
        selection: 'take',
      }),
    };
  } finally {
    session.close();
  }
}

export async function readMovieStudioSelectionContext(
  input: ReadMovieStudioSelectionContextInput
): Promise<MovieStudioSelectionContextResult> {
  const { session } = await openResourceSession(input);
  try {
    switch (input.selection.type) {
      case 'projectInformation':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'project-information' },
          resourceKeys: ['project-information'],
        };
      case 'visualLanguage':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'visual-language' },
          resourceKeys: ['navigation:visual-language'],
        };
      case 'storyboard':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'storyboard' },
          resourceKeys: ['project-shell'],
        };
      case 'casting':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'casting',
            cast: listCastNavigationFromSession(session, input),
          },
          resourceKeys: ['navigation:cast'],
        };
      case 'cast': {
        const row = readCastNavigationRow(session, input.selection.id);
        return row
          ? {
              valid: true,
              selection: input.selection,
              context: { surface: 'cast-design', castMember: row },
              resourceKeys: [`surface:cast-design:${row.id}`],
            }
          : selectionNotFound(input.selection);
      }
      case 'sequence': {
        const chain = readSequenceContext(session, input.selection.id);
        return chain
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'sequence',
                sequence: chain.sequence,
                episode: chain.episode,
              },
              resourceKeys: [
                chain.episode
                  ? `navigation:episode-sequences:${chain.episode.id}`
                  : 'navigation:movie-sequences',
              ],
            }
          : selectionNotFound(input.selection);
      }
      case 'scene': {
        const chain = readSceneContext(session, input.selection.id);
        return chain
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'scene',
                scene: chain.scene,
                sequence: chain.sequence,
                episode: chain.episode,
              },
              resourceKeys: [`navigation:sequence-scenes:${chain.sequence.id}`],
            }
          : selectionNotFound(input.selection);
      }
      case 'clip': {
        const chain = readClipContext(session, input.selection.id);
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'clip-design',
            clip: {
              id: chain.clip.id,
              sceneId: chain.scene.id,
              title: chain.clip.title,
              oneLineSummary: chain.clip.summary,
            },
            scene: chain.scene,
            sequence: chain.sequence,
            episode: chain.episode,
          },
          resourceKeys: [`surface:clip-design:${chain.clip.id}`],
        };
      }
    }
  } catch (error) {
    if (error instanceof ProjectDataError && error.code === 'PROJECT_DATA116') {
      return selectionNotFound(input.selection);
    }
    throw error;
  } finally {
    session.close();
  }
}

async function openResourceSession(input: {
  projectName: string;
  homeDir?: string;
}): Promise<{ projectFolder: string; session: ProjectDataSession }> {
  const storageRoot = await resolveRenkuStorageRoot({ homeDir: input.homeDir });
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  return {
    projectFolder,
    session: openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    }),
  };
}

function readProjectRecord(
  session: ProjectDataSession,
  projectFolder: string
): Pick<ProjectShell, 'identity' | 'coverImage'> {
  const row = session.sqlite
    .prepare(
      `select id, name, title, type, aspect_ratio as aspectRatio, logline, cover_file as coverFile from project limit 1`
    )
    .get() as Omit<ProjectRecordRow, 'folderPath' | 'databasePath'> | undefined;
  if (!row) {
    throw notFound('PROJECT_DATA021', `Project database has no project row: ${session.databasePath}.`);
  }
  const identity: ProjectIdentity = {
    id: row.id,
    name: row.name,
    title: row.title,
    type: row.type === 'series' ? 'series' : 'standaloneMovie',
    folderPath: projectFolder,
    databasePath: session.databasePath,
    aspectRatio: nullable(row.aspectRatio),
    logline: nullable(row.logline),
  };
  return {
    identity,
    coverImage: row.coverFile === 'cover.png' ? { fileName: 'cover.png' } : null,
  };
}

function readProjectCounts(session: ProjectDataSession): ProjectCounts {
  return {
    languages: countRows(session, 'project_locale'),
    visualLanguageCategories: countRows(session, 'visual_language_category'),
    visualLanguage: countRows(session, 'visual_language'),
    castMembers: countRows(session, 'cast_member'),
    continuityReferences: countRows(session, 'continuity_reference'),
    episodes: countRows(session, 'episode'),
    sequences: countRows(session, 'sequence'),
    scenes: countRows(session, 'scene'),
    clips: countRows(session, 'clip'),
  };
}

function readLanguages(session: ProjectDataSession): ProjectLanguage[] {
  return session.sqlite
    .prepare(
      `select id, locale_tag as localeTag, display_name as displayName, is_base as isBase, ` +
        `supports_audio as supportsAudio, supports_subtitles as supportsSubtitles ` +
        `from project_locale order by position asc, id asc`
    )
    .all()
    .map((row) => ({
      ...(row as Omit<ProjectLanguage, 'isBase' | 'supportsAudio' | 'supportsSubtitles'>),
      isBase: Boolean((row as { isBase: number }).isBase),
      supportsAudio: Boolean((row as { supportsAudio: number }).supportsAudio),
      supportsSubtitles: Boolean((row as { supportsSubtitles: number }).supportsSubtitles),
    }));
}

function readVisualLanguageCategories(
  session: ProjectDataSession
): VisualLanguageCategory[] {
  return session.sqlite
    .prepare(
      `select id, name, description, source from visual_language_category order by position asc, id asc`
    )
    .all() as VisualLanguageCategory[];
}

function listCastNavigationFromSession(
  session: ProjectDataSession,
  input: ListNavigationInput
): PageResponse<CastNavigationRow> {
  return listPositionPage<CastNavigationRow>(session, {
    tableName: 'cast_member',
    select:
      'id, name, kind, role, position',
    mapRow: (row) => ({
      id: row.id,
      name: row.name,
      kind: nullable(row.kind),
      role: nullable(row.role),
    }),
    input,
  });
}

function listVisualLanguageNavigationFromSession(
  session: ProjectDataSession,
  input: ListNavigationInput
): PageResponse<VisualLanguageNavigationRow> {
  return listPositionPage<VisualLanguageNavigationRow>(session, {
    tableName: 'visual_language',
    select:
      'id, category_id as categoryId, name, one_line_summary as oneLineSummary, position',
    mapRow: (row) => ({
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      oneLineSummary: nullable(row.oneLineSummary),
    }),
    input,
  });
}

function listContinuityReferenceNavigationFromSession(
  session: ProjectDataSession,
  input: ListNavigationInput
): PageResponse<ContinuityReferenceNavigationRow> {
  return listPositionPage<ContinuityReferenceNavigationRow>(session, {
    tableName: 'continuity_reference',
    select:
      'id, kind, name, one_line_summary as oneLineSummary, position',
    mapRow: (row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      oneLineSummary: nullable(row.oneLineSummary),
    }),
    input,
  });
}

function listEpisodeNavigationFromSession(
  session: ProjectDataSession,
  input: ListNavigationInput
): PageResponse<EpisodeNavigationRow> {
  return listPositionPage<EpisodeNavigationRow>(session, {
    tableName: 'episode',
    select:
      `e.id, coalesce(e.episode_number, e.position) as number, e.title, e.short_title as shortTitle, e.position, ` +
      `(select count(*) from sequence s where s.episode_id = e.id) as sequenceCount, ` +
      `(select count(*) from scene sc join sequence s2 on s2.id = sc.sequence_id where s2.episode_id = e.id) as sceneCount, ` +
      `(select count(*) from clip c join scene sc2 on sc2.id = c.scene_id join sequence s3 on s3.id = sc2.sequence_id where s3.episode_id = e.id) as clipCount`,
    tableExpression: 'episode e',
    mapRow: (row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      shortTitle: nullable(row.shortTitle),
      sequenceCount: row.sequenceCount,
      sceneCount: row.sceneCount,
      clipCount: row.clipCount,
    }),
    input,
  });
}

function listStandaloneMovieSequenceNavigationFromSession(
  session: ProjectDataSession,
  input: ListNavigationInput
): PageResponse<SequenceNavigationRow> {
  return listSequenceNavigationFromSession(session, {
    ...input,
    episodeId: null,
  });
}

function listSequenceNavigationFromSession(
  session: ProjectDataSession,
  input: ListNavigationInput & { episodeId: string | null }
): PageResponse<SequenceNavigationRow> {
  const parentWhere = input.episodeId
    ? 's.episode_id = ?'
    : 's.episode_id is null';
  return listPositionPage<SequenceNavigationRow>(session, {
    tableExpression: 'sequence s',
    where: parentWhere,
    whereValues: input.episodeId ? [input.episodeId] : [],
    select:
      `s.id, s.episode_id as episodeId, s.title, s.short_title as shortTitle, s.position, ` +
      `(select count(*) from sequence sx where ${input.episodeId ? 'sx.episode_id = s.episode_id and' : 'sx.episode_id is null and'} (sx.position < s.position or (sx.position = s.position and sx.id <= s.id))) as number, ` +
      `(select count(*) from scene sc where sc.sequence_id = s.id) as sceneCount, ` +
      `(select count(*) from clip c join scene sc2 on sc2.id = c.scene_id where sc2.sequence_id = s.id) as clipCount`,
    mapRow: (row) => ({
      id: row.id,
      episodeId: nullable(row.episodeId),
      number: row.number,
      title: row.title,
      shortTitle: nullable(row.shortTitle),
      sceneCount: row.sceneCount,
      clipCount: row.clipCount,
    }),
    input,
  });
}

function listSceneNavigationFromSession(
  session: ProjectDataSession,
  input: ListSceneNavigationInput
): PageResponse<SceneNavigationRow> {
  return listPositionPage<SceneNavigationRow>(session, {
    tableExpression: 'scene sc',
    where: 'sc.sequence_id = ?',
    whereValues: [input.sequenceId],
    select:
      `sc.id, sc.sequence_id as sequenceId, sc.title, sc.position, ` +
      `(select count(*) from clip c where c.scene_id = sc.id) as clipCount`,
    mapRow: (row) => ({
      id: row.id,
      sequenceId: row.sequenceId,
      title: row.title,
      clipCount: row.clipCount,
    }),
    input,
  });
}

function listClipNavigationFromSession(
  session: ProjectDataSession,
  input: ListClipNavigationInput
): PageResponse<ClipNavigationRow> {
  return listPositionPage<ClipNavigationRow>(session, {
    tableExpression: 'clip c',
    where: 'c.scene_id = ?',
    whereValues: [input.sceneId],
    select:
      'c.id, c.scene_id as sceneId, c.title, c.one_line_summary as oneLineSummary, c.position',
    mapRow: (row) => ({
      id: row.id,
      sceneId: row.sceneId,
      title: row.title,
      oneLineSummary: nullable(row.oneLineSummary),
    }),
    input,
  });
}

function readStandaloneMovieSequenceShellRows(
  session: ProjectDataSession,
  rows: SequenceNavigationRow[]
): Sequence[] {
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    shortTitle: row.shortTitle,
    summary: undefined,
    scenes: listSceneNavigationFromSession(session, {
      projectName: '',
      sequenceId: row.id,
      limit: DEFAULT_NAVIGATION_PAGE_LIMIT,
    }).items.map((scene) => ({
      id: scene.id,
      title: scene.title,
      clips: listClipNavigationFromSession(session, {
        projectName: '',
        sceneId: scene.id,
        limit: DEFAULT_NAVIGATION_PAGE_LIMIT,
      }).items.map((clip) => ({
        id: clip.id,
        title: clip.title,
        summary: clip.oneLineSummary,
      })),
    })),
  }));
}

function listPositionPage<T>(
  session: ProjectDataSession,
  config: {
    tableName?: string;
    tableExpression?: string;
    select: string;
    where?: string;
    whereValues?: unknown[];
    mapRow: (row: Record<string, any>) => T;
    input: { limit?: number; cursor?: string | null };
  }
): PageResponse<T> {
  const limit = normalizeLimit(config.input.limit, DEFAULT_NAVIGATION_PAGE_LIMIT);
  const cursor = parseCursor(config.input.cursor);
  const values = [...(config.whereValues ?? [])];
  const conditions = config.where ? [config.where] : [];
  if (cursor) {
    conditions.push('(position > ? or (position = ? and id > ?))');
    values.push(cursor.position, cursor.position, cursor.id);
  }
  const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const rows = session.sqlite
    .prepare(
      `select ${config.select} from ${config.tableExpression ?? config.tableName} ` +
        `${whereSql} order by position asc, id asc limit ?`
    )
    .all(...values, limit + 1) as Array<Record<string, any>>;
  const pageRows = rows.slice(0, limit);
  return {
    items: pageRows.map(config.mapRow),
    nextCursor:
      rows.length > limit
        ? encodeCursor(lastPositionCursor(pageRows[pageRows.length - 1]!))
        : null,
  };
}

function listAssetPageFromSession(
  session: ProjectDataSession,
  input: ListAssetPageInput
): PageResponse<Asset> {
  const target = assetRelationshipConfig(input.target);
  validateAssetTargetExists(session, input.target);
  const limit = normalizeLimit(input.limit, DEFAULT_ASSET_PAGE_LIMIT);
  const cursor = parseAssetCursor(input.cursor);
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (target.targetColumn) {
    conditions.push(`r.${target.targetColumn} = ?`);
    values.push(target.targetId);
  }
  if (input.role) {
    conditions.push('r.role = ?');
    values.push(input.role);
  }
  if (input.mediaKind) {
    conditions.push('a.media_kind = ?');
    values.push(input.mediaKind);
  }
  if (input.selection) {
    conditions.push('r.selection = ?');
    values.push(input.selection);
  }
  if (input.locale && input.locale.localeId === null) {
    conditions.push('r.locale_id is null');
  } else if (input.locale?.localeId !== undefined) {
    conditions.push('r.locale_id = ?');
    values.push(input.locale.localeId);
  }
  if (cursor) {
    conditions.push(
      `(case when r.selection = 'select' then 0 else 1 end, coalesce(r.selection_order, 2147483647), r.sort_order, a.title, a.id) > (?, ?, ?, ?, ?)`
    );
    values.push(
      cursor.selectionRank,
      cursor.selectionOrderRank,
      cursor.sortOrder,
      cursor.title,
      cursor.assetId
    );
  }
  const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const rows = session.sqlite
    .prepare(
      `select ${assetSelectColumns(target)} from ${target.tableName} r ` +
        `join asset a on a.id = r.asset_id ${whereSql} ` +
        `order by case when r.selection = 'select' then 0 else 1 end asc, ` +
        `coalesce(r.selection_order, 2147483647) asc, r.sort_order asc, a.title asc, a.id asc limit ?`
    )
    .all(...values, limit + 1) as AssetRelationshipRow[];
  const pageRows = rows.slice(0, limit);
  const files = readAssetFileRows(
    session,
    pageRows.map((row) => row.assetId)
  );
  return {
    items: pageRows.map((row) => toAsset(row, files)),
    nextCursor:
      rows.length > limit ? encodeCursor(assetCursor(pageRows[pageRows.length - 1]!)) : null,
  };
}

function readAssetCountsByRole(
  session: ProjectDataSession,
  target: AssetRelationshipConfig
): CastDesignAssetRoleCount[] {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (target.targetColumn) {
    conditions.push(`${target.targetColumn} = ?`);
    values.push(target.targetId);
  }
  const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';
  return session.sqlite
    .prepare(
      `select role, ` +
        `sum(case when selection = 'select' then 1 else 0 end) as selectedCount, ` +
        `sum(case when selection = 'take' then 1 else 0 end) as takeCount ` +
        `from ${target.tableName} ${whereSql} group by role order by role asc`
    )
    .all(...values) as CastDesignAssetRoleCount[];
}

function readCastMember(
  session: ProjectDataSession,
  castMemberId: string
): CastMember | null {
  const row = session.sqlite
    .prepare(
      'select id, name, kind, role, short_description as shortDescription from cast_member where id = ?'
    )
    .get(castMemberId) as CastMember | undefined;
  return row ?? null;
}

function readCastNavigationRow(
  session: ProjectDataSession,
  castMemberId: string
): CastNavigationRow | null {
  const castMember = readCastMember(session, castMemberId);
  return castMember
    ? {
        id: castMember.id,
        name: castMember.name,
        kind: castMember.kind,
        role: castMember.role,
      }
    : null;
}

function readSequenceContext(
  session: ProjectDataSession,
  sequenceId: string
): { sequence: SequenceNavigationRow; episode?: EpisodeNavigationRow } | null {
  const row = session.sqlite
    .prepare(
      `select s.id, s.episode_id as episodeId, s.title, s.short_title as shortTitle, s.position, ` +
        `(select count(*) from scene sc where sc.sequence_id = s.id) as sceneCount, ` +
        `(select count(*) from clip c join scene sc2 on sc2.id = c.scene_id where sc2.sequence_id = s.id) as clipCount ` +
        `from sequence s where s.id = ?`
    )
    .get(sequenceId) as Record<string, any> | undefined;
  if (!row) {
    return null;
  }
  const sequence: SequenceNavigationRow = {
    id: row.id,
    episodeId: nullable(row.episodeId),
    number: sequenceNumber(session, row.id, row.episodeId),
    title: row.title,
    shortTitle: nullable(row.shortTitle),
    sceneCount: row.sceneCount,
    clipCount: row.clipCount,
  };
  return {
    sequence,
    episode: row.episodeId ? readEpisodeNavigationRow(session, row.episodeId) ?? undefined : undefined,
  };
}

function readSceneContext(
  session: ProjectDataSession,
  sceneId: string
):
  | {
      scene: SceneNavigationRow;
      sequence: SequenceNavigationRow;
      episode?: EpisodeNavigationRow;
    }
  | null {
  const row = session.sqlite
    .prepare(
      `select sc.id, sc.sequence_id as sequenceId, sc.title, ` +
        `(select count(*) from clip c where c.scene_id = sc.id) as clipCount ` +
        `from scene sc where sc.id = ?`
    )
    .get(sceneId) as Record<string, any> | undefined;
  if (!row) {
    return null;
  }
  const sequence = readSequenceContext(session, row.sequenceId);
  if (!sequence) {
    return null;
  }
  return {
    scene: {
      id: row.id,
      sequenceId: row.sequenceId,
      title: row.title,
      clipCount: row.clipCount,
    },
    sequence: sequence.sequence,
    episode: sequence.episode,
  };
}

function readClipContext(
  session: ProjectDataSession,
  clipId: string
): {
  clip: Clip;
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  episode?: EpisodeNavigationRow;
} {
  const row = session.sqlite
    .prepare(
      `select id, scene_id as sceneId, title, one_line_summary as summary from clip where id = ?`
    )
    .get(clipId) as Record<string, any> | undefined;
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA116', `Clip was not found: ${clipId}.`);
  }
  const scene = readSceneContext(session, row.sceneId);
  if (!scene) {
    throw new ProjectDataError(
      'PROJECT_DATA116',
      `Clip parent chain was not found: ${clipId}.`
    );
  }
  return {
    clip: {
      id: row.id,
      title: row.title,
      summary: nullable(row.summary),
    },
    scene: scene.scene,
    sequence: scene.sequence,
    episode: scene.episode,
  };
}

function readEpisodeNavigationRow(
  session: ProjectDataSession,
  episodeId: string
): EpisodeNavigationRow | null {
  return (
    session.sqlite
      .prepare(
        `select e.id, coalesce(e.episode_number, e.position) as number, e.title, e.short_title as shortTitle, ` +
          `(select count(*) from sequence s where s.episode_id = e.id) as sequenceCount, ` +
          `(select count(*) from scene sc join sequence s2 on s2.id = sc.sequence_id where s2.episode_id = e.id) as sceneCount, ` +
          `(select count(*) from clip c join scene sc2 on sc2.id = c.scene_id join sequence s3 on s3.id = sc2.sequence_id where s3.episode_id = e.id) as clipCount ` +
          `from episode e where e.id = ?`
      )
      .get(episodeId) as EpisodeNavigationRow | undefined
  ) ?? null;
}

function sequenceNumber(
  session: ProjectDataSession,
  sequenceId: string,
  episodeId: string | null
): number {
  const row = session.sqlite
    .prepare(
      `select count(*) as count from sequence sx join sequence current on current.id = ? ` +
        `where ${episodeId ? 'sx.episode_id = ?' : 'sx.episode_id is null'} ` +
        `and (sx.position < current.position or (sx.position = current.position and sx.id <= current.id))`
    )
    .get(...(episodeId ? [sequenceId, episodeId] : [sequenceId])) as { count: number };
  return row.count;
}

function assetRelationshipConfig(target: AssetTarget): AssetRelationshipConfig {
  switch (target.kind) {
    case 'project':
      return { tableName: 'project_asset', targetColumn: null, targetId: null };
    case 'visualLanguage':
      return {
        tableName: 'visual_language_asset',
        targetColumn: 'visual_language_id',
        targetId: target.visualLanguageId,
      };
    case 'castMember':
      return {
        tableName: 'cast_asset',
        targetColumn: 'cast_member_id',
        targetId: target.castMemberId,
      };
    case 'continuityReference':
      return {
        tableName: 'continuity_reference_asset',
        targetColumn: 'continuity_reference_id',
        targetId: target.continuityReferenceId,
      };
    case 'sequence':
      return {
        tableName: 'sequence_asset',
        targetColumn: 'sequence_id',
        targetId: target.sequenceId,
      };
    case 'scene':
      return {
        tableName: 'scene_asset',
        targetColumn: 'scene_id',
        targetId: target.sceneId,
      };
    case 'clip':
      return { tableName: 'clip_asset', targetColumn: 'clip_id', targetId: target.clipId };
  }
}

function validateAssetTargetExists(
  session: ProjectDataSession,
  target: AssetTarget
): void {
  switch (target.kind) {
    case 'project':
      return;
    case 'visualLanguage':
      assertExists(session, 'visual_language', target.visualLanguageId, 'PROJECT_DATA117');
      return;
    case 'castMember':
      assertExists(session, 'cast_member', target.castMemberId, 'PROJECT_DATA115');
      return;
    case 'continuityReference':
      assertExists(session, 'continuity_reference', target.continuityReferenceId, 'PROJECT_DATA118');
      return;
    case 'sequence':
      assertExists(session, 'sequence', target.sequenceId, 'PROJECT_DATA113');
      return;
    case 'scene':
      assertExists(session, 'scene', target.sceneId, 'PROJECT_DATA114');
      return;
    case 'clip':
      assertExists(session, 'clip', target.clipId, 'PROJECT_DATA116');
      return;
  }
}

function assetSelectColumns(target: AssetRelationshipConfig): string {
  const targetColumn = target.targetColumn
    ? `r.${target.targetColumn} as targetId`
    : 'null as targetId';
  return [
    'r.id as relationshipId',
    'r.asset_id as assetId',
    targetColumn,
    'r.locale_id as localeId',
    'r.role as role',
    'r.sort_order as sortOrder',
    'r.selection as selection',
    'r.selection_order as selectionOrder',
    'a.type as type',
    'a.media_kind as mediaKind',
    'a.title as title',
    'a.one_line_summary as oneLineSummary',
    'a.origin as origin',
    'a.availability as availability',
    'a.created_at as createdAt',
    'a.updated_at as updatedAt',
  ].join(', ');
}

function readAssetFileRows(
  session: ProjectDataSession,
  assetIds: string[]
): Map<string, AssetFileRow[]> {
  const filesByAssetId = new Map<string, AssetFileRow[]>();
  if (assetIds.length === 0) {
    return filesByAssetId;
  }
  const placeholders = assetIds.map(() => '?').join(', ');
  const rows = session.sqlite
    .prepare(
      `select id, asset_id as assetId, role, project_relative_path as projectRelativePath, ` +
        `mime_type as mimeType, media_kind as mediaKind, size_bytes as sizeBytes, ` +
        `content_hash as contentHash, width, height, duration_seconds as durationSeconds ` +
        `from asset_file where asset_id in (${placeholders}) order by role asc, id asc`
    )
    .all(...assetIds) as AssetFileRow[];
  for (const row of rows) {
    const existing = filesByAssetId.get(row.assetId) ?? [];
    existing.push(row);
    filesByAssetId.set(row.assetId, existing);
  }
  return filesByAssetId;
}

function toAsset(
  row: AssetRelationshipRow,
  filesByAssetId: Map<string, AssetFileRow[]>
): Asset {
  return {
    assetId: row.assetId,
    relationshipId: row.relationshipId,
    target: targetFromRelationshipRow(row),
    localeId: row.localeId,
    type: row.type,
    selection:
      row.selection === 'select'
        ? { kind: 'select', order: row.selectionOrder ?? 1 }
        : { kind: 'take' },
    availability: 'ready',
    mediaKind: row.mediaKind,
    title: row.title,
    oneLineSummary: row.oneLineSummary,
    origin: row.origin,
    role: row.role,
    sortOrder: row.sortOrder,
    files: (filesByAssetId.get(row.assetId) ?? []).map(toAssetFile),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function targetFromRelationshipRow(row: AssetRelationshipRow): AssetTarget {
  if (row.relationshipId.startsWith('visual_language_asset_')) {
    return { kind: 'visualLanguage', visualLanguageId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('cast_asset_')) {
    return { kind: 'castMember', castMemberId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('continuity_reference_asset_')) {
    return {
      kind: 'continuityReference',
      continuityReferenceId: requiredTargetId(row),
    };
  }
  if (row.relationshipId.startsWith('sequence_asset_')) {
    return { kind: 'sequence', sequenceId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('scene_asset_')) {
    return { kind: 'scene', sceneId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('clip_asset_')) {
    return { kind: 'clip', clipId: requiredTargetId(row) };
  }
  return { kind: 'project' };
}

function toAssetFile(row: AssetFileRow): AssetFile {
  return {
    id: row.id,
    role: row.role,
    projectRelativePath: normalizeProjectRelativePath(row.projectRelativePath),
    mediaKind: row.mediaKind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
  };
}

function requiredTargetId(row: AssetRelationshipRow): string {
  if (!row.targetId) {
    throw new ProjectDataError(
      'PROJECT_DATA087',
      `Asset relationship ${row.relationshipId} is missing its target id.`
    );
  }
  return row.targetId;
}

function countRows(session: ProjectDataSession, tableName: string): number {
  const row = session.sqlite
    .prepare(`select count(*) as count from ${tableName}`)
    .get() as { count: number };
  return row.count;
}

function assertProjectType(
  session: ProjectDataSession,
  expected: 'standaloneMovie' | 'series'
): void {
  const row = session.sqlite.prepare('select type from project limit 1').get() as
    | { type: string }
    | undefined;
  if (!row || row.type !== expected) {
    throw new ProjectDataError(
      'PROJECT_DATA111',
      `This route is only valid for ${expected} projects.`
    );
  }
}

function assertExists(
  session: ProjectDataSession,
  tableName: string,
  id: string,
  code: string
): void {
  const row = session.sqlite
    .prepare(`select 1 from ${tableName} where id = ?`)
    .get(id);
  if (!row) {
    throw notFound(code, `${tableName} was not found: ${id}.`);
  }
}

function normalizeLimit(input: number | undefined, defaultLimit: number): number {
  if (input === undefined) {
    return defaultLimit;
  }
  if (!Number.isInteger(input) || input < 1 || input > MAX_RESOURCE_PAGE_LIMIT) {
    throw new ProjectDataError(
      'PROJECT_DATA110',
      `Page limit must be an integer from 1 to ${MAX_RESOURCE_PAGE_LIMIT}.`
    );
  }
  return input;
}

function parseCursor(cursor: string | null | undefined): {
  position: number;
  id: string;
} | null {
  if (!cursor) {
    return null;
  }
  const value = decodeCursor(cursor);
  if (
    typeof value.position !== 'number' ||
    !Number.isInteger(value.position) ||
    typeof value.id !== 'string'
  ) {
    throw invalidCursor();
  }
  return value as {
    position: number;
    id: string;
  };
}

function parseAssetCursor(cursor: string | null | undefined): {
  selectionRank: number;
  selectionOrderRank: number;
  sortOrder: number;
  title: string;
  assetId: string;
} | null {
  if (!cursor) {
    return null;
  }
  const value = decodeCursor(cursor);
  if (
    typeof value.selectionRank !== 'number' ||
    typeof value.selectionOrderRank !== 'number' ||
    typeof value.sortOrder !== 'number' ||
    typeof value.title !== 'string' ||
    typeof value.assetId !== 'string'
  ) {
    throw invalidCursor();
  }
  return value as {
    selectionRank: number;
    selectionOrderRank: number;
    sortOrder: number;
    title: string;
    assetId: string;
  };
}

function lastPositionCursor(row: Record<string, any>): { position: number; id: string } {
  return { position: row.position, id: row.id };
}

function assetCursor(row: AssetRelationshipRow) {
  return {
    selectionRank: row.selection === 'select' ? 0 : 1,
    selectionOrderRank: row.selectionOrder ?? 2147483647,
    sortOrder: row.sortOrder,
    title: row.title,
    assetId: row.assetId,
  };
}

function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): Record<string, any> {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object') {
      throw invalidCursor();
    }
    return decoded as Record<string, any>;
  } catch {
    throw invalidCursor();
  }
}

function invalidCursor(): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA109', 'Resource page cursor is invalid.');
}

function selectionNotFound(
  selection: MovieStudioSelection
): MovieStudioSelectionContextResult {
  return {
    valid: false,
    reason: 'selectionNotFound',
    diagnostics: [
      createDiagnosticError(
        'PROJECT_DATA108',
        `Movie Studio selection was not found: ${selection.type}.`,
        { path: ['selection'] },
        'Choose a visible Studio item or refresh the project shell.'
      ),
    ],
  };
}

function notFound(code: string, message: string): ProjectDataError {
  return new ProjectDataError(code, message);
}

function nullable(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

function toCastMemberShellRow(row: CastNavigationRow): CastMember {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    role: row.role,
  };
}

function toVisualLanguageShellRow(row: VisualLanguageNavigationRow): VisualLanguage {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    summary: row.oneLineSummary,
    priority: 'default',
  };
}

function toContinuityReferenceShellRow(
  row: ContinuityReferenceNavigationRow
): ContinuityReference {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    summary: row.oneLineSummary,
  };
}

function toEpisodeShellRow(row: EpisodeNavigationRow): Episode {
  return {
    id: row.id,
    title: row.title,
    shortTitle: row.shortTitle,
    sequences: [],
  };
}

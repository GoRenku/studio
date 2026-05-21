import {
  buildDiagnosticResult,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectInformationResource } from '../../client/index.js';
import { listCastAssetRecords } from '../database/access/asset-relationships/cast-members.js';
import { listContinuityReferenceAssetRecords } from '../database/access/asset-relationships/continuity-references.js';
import {
  listClipAssetRecords,
  listSceneAssetRecords,
  listSequenceAssetRecords,
} from '../database/access/asset-relationships/screenplay-assets.js';
import {
  listProjectLocaleRecords,
  replaceProjectLocaleRecords,
  type ProjectLocaleRecord,
} from '../database/access/project-locales.js';
import { listProjectAssetRecords } from '../database/access/asset-relationships/project.js';
import {
  readProjectInformationResourceFromDatabase,
  readProjectInformationUpdateFromDatabase,
} from '../database/access/project-information.js';
import {
  readProjectRecord,
  updateProjectInformationRecord,
} from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { listVisualLanguageAssetRecords } from '../database/access/asset-relationships/visual-language.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type {
  PatchProjectInformationInput,
  ProjectInformationLanguageUpdate,
  ProjectInformationPatch,
  ProjectInformationUpdate,
  UpdateProjectInformationInput,
} from '../project-data-service-contracts.js';

export async function updateProjectInformation(
  input: UpdateProjectInformationInput
): Promise<ProjectInformationResource> {
  const { session } = await openProjectSession(input);
  try {
    const projectRecord = readProjectRecord(session);
    if (!projectRecord) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }

    validateProjectInformationUpdate(input.information);
    const now = new Date().toISOString();
    const existingLocales = listProjectLocaleRecords(session);
    const existingLocaleIds = new Map(
      existingLocales.map((language) => [
        language.localeTag,
        language.id,
      ])
    );
    const ids = createUniqueIdAllocator(createRandomIdGenerator());
    const nextLocaleIds = new Set(
      input.information.languages.map((language) => existingLocaleIds.get(language.localeTag))
    );
    assertRemovedLocalesAreUnused(
      session,
      existingLocales.filter((locale) => !nextLocaleIds.has(locale.id))
    );

    session.db.transaction((tx) => {
      const transactionSession = { ...session, db: tx };
      updateProjectInformationRecord(transactionSession, projectRecord.id, {
        title: input.information.title.trim(),
        aspectRatio: input.information.aspectRatio,
        logline: nullableTrimmed(input.information.logline),
        summary: nullableTrimmed(input.information.summary),
        updatedAt: now,
      });
      replaceProjectLocaleRecords(
        transactionSession,
        input.information.languages.map((language, index) => ({
          id: existingLocaleIds.get(language.localeTag) ?? ids('locale'),
          localeTag: language.localeTag,
          displayName: optionalTrimmed(language.displayName),
          isBase: language.isBase,
          supportsAudio: language.supportsAudio,
          supportsSubtitles: language.supportsSubtitles,
          position: index + 1,
        }))
      );
    });
    return readProjectInformationResourceFromDatabase(session);
  } finally {
    session.close();
  }
}

export async function patchProjectInformation(
  input: PatchProjectInformationInput
): Promise<ProjectInformationResource> {
  const current = await readCurrentProjectInformationUpdate(input);
  const information = applyProjectInformationPatch(current, input.patch);
  return await updateProjectInformation({
    projectName: input.projectName,
    homeDir: input.homeDir,
    information,
  });
}

function validateProjectInformationUpdate(update: ProjectInformationUpdate): void {
  const issues: DiagnosticIssue[] = [];
  const supportedAspectRatios = new Set([
    '1:1',
    '3:4',
    '4:3',
    '16:9',
    '9:16',
    '21:9',
  ]);
  const supportedLocaleTags = new Set([
    'en-US',
    'es-ES',
    'de-DE',
    'fr-FR',
    'zh-CN',
    'ja-JP',
    'tr-TR',
  ]);

  if (!update.title.trim()) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA050',
        'Project title is required.',
        { path: ['title'], context: 'project information update' },
        'Enter a project title before saving.'
      )
    );
  }

  if (
    update.aspectRatio !== undefined &&
    !supportedAspectRatios.has(update.aspectRatio)
  ) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA051',
        'Project aspect ratio is not supported.',
        { path: ['aspectRatio'], context: 'project information update' },
        'Choose one of 1:1, 3:4, 4:3, 16:9, 9:16, or 21:9.'
      )
    );
  }

  if (update.languages.length === 0) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA052',
        'At least one project language is required.',
        { path: ['languages'], context: 'project information update' },
        'Add at least one language.'
      )
    );
  }

  const seenLocaleTags = new Set<string>();
  let baseLanguageCount = 0;
  update.languages.forEach((language, index) => {
    const languagePath = ['languages', String(index)];
    if (!supportedLocaleTags.has(language.localeTag)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA053',
          `Language ${language.localeTag} is not in the supported project language catalog.`,
          { path: [...languagePath, 'localeTag'], context: 'project information update' },
          'Choose a language from the Studio language dropdown.'
        )
      );
    }
    if (seenLocaleTags.has(language.localeTag)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA054',
          `Language ${language.localeTag} appears more than once.`,
          { path: [...languagePath, 'localeTag'], context: 'project information update' },
          'Keep only one row for each locale tag.'
        )
      );
    }
    seenLocaleTags.add(language.localeTag);
    if (language.isBase) {
      baseLanguageCount += 1;
    }
  });

  if (baseLanguageCount !== 1) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA055',
        'Exactly one project language must be marked as base.',
        { path: ['languages'], context: 'project information update' },
        'Choose one base language.'
      )
    );
  }

  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throw new ProjectDataError(
      'PROJECT_DATA056',
      'Project information failed validation.',
      {
        issues: result.issues,
        suggestion: 'Fix the highlighted project information fields and save again.',
      }
    );
  }
}

interface LocaleAssetReference {
  tableName: string;
  relationshipId: string;
  assetId: string;
  role: string;
}

function assertRemovedLocalesAreUnused(
  session: DatabaseSession,
  removedLocales: ProjectLocaleRecord[]
): void {
  if (removedLocales.length === 0) {
    return;
  }

  const issues: DiagnosticIssue[] = [];
  for (const locale of removedLocales) {
    const references = listLocaleAssetReferences(session, locale.id);
    for (const reference of references) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA057',
          `Project locale ${locale.localeTag} cannot be removed because ${reference.tableName} ${reference.relationshipId} still uses asset ${reference.assetId} as ${reference.role}.`,
          {
            path: ['languages', locale.localeTag],
            context: 'project information update',
          },
          'Remove or reassign the locale-specific asset relationship before removing this project locale.'
        )
      );
    }
  }

  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throw new ProjectDataError(
      'PROJECT_DATA058',
      'Project locale removal failed because assets still use removed locales.',
      {
        issues: result.issues,
        suggestion:
          'Keep the locale, or reassign/remove the assets that still reference it before saving.',
      }
    );
  }
}

function listLocaleAssetReferences(
  session: DatabaseSession,
  localeId: string
): LocaleAssetReference[] {
  return [
    ...listProjectAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'project_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listVisualLanguageAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'visual_language_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listCastAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'cast_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listContinuityReferenceAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'continuity_reference_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listSequenceAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'sequence_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listSceneAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'scene_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listClipAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'clip_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
  ];
}

async function readCurrentProjectInformationUpdate(input: {
  projectName: string;
  homeDir?: string;
}): Promise<ProjectInformationUpdate> {
  const { session } = await openProjectSession(input);
  try {
    return readProjectInformationUpdateFromDatabase(session);
  } finally {
    session.close();
  }
}

function applyProjectInformationPatch(
  current: ProjectInformationUpdate,
  patch: ProjectInformationPatch
): ProjectInformationUpdate {
  const update: ProjectInformationUpdate = {
    title: patch.title ?? current.title,
    aspectRatio:
      patch.aspectRatio === null
        ? undefined
        : patch.aspectRatio ?? current.aspectRatio,
    logline:
      patch.logline === null ? undefined : patch.logline ?? current.logline,
    summary: 'summary' in patch ? patch.summary : current.summary,
    languages: current.languages.map((language) => ({
      localeTag: language.localeTag,
      displayName: language.displayName,
      isBase: language.isBase,
      supportsAudio: language.supportsAudio,
      supportsSubtitles: language.supportsSubtitles,
    })),
  };

  for (const operation of patch.languages ?? []) {
    if (operation.operation === 'add') {
      update.languages.push({
        localeTag: operation.localeTag,
        displayName: operation.displayName,
        isBase: operation.isBase ?? false,
        supportsAudio: operation.supportsAudio ?? true,
        supportsSubtitles: operation.supportsSubtitles ?? true,
      });
      if (operation.isBase) {
        setBaseLanguage(update.languages, operation.localeTag);
      }
    }
    if (operation.operation === 'update') {
      const language = update.languages.find(
        (entry) => entry.localeTag === operation.localeTag
      );
      if (!language) {
        update.languages.push({
          localeTag: operation.localeTag,
          displayName: operation.displayName ?? undefined,
          isBase: operation.isBase ?? false,
          supportsAudio: operation.supportsAudio ?? true,
          supportsSubtitles: operation.supportsSubtitles ?? true,
        });
      } else {
        if ('displayName' in operation) {
          language.displayName = operation.displayName ?? undefined;
        }
        if (operation.supportsAudio !== undefined) {
          language.supportsAudio = operation.supportsAudio;
        }
        if (operation.supportsSubtitles !== undefined) {
          language.supportsSubtitles = operation.supportsSubtitles;
        }
        if (operation.isBase !== undefined) {
          language.isBase = operation.isBase;
        }
      }
      if (operation.isBase) {
        setBaseLanguage(update.languages, operation.localeTag);
      }
    }
    if (operation.operation === 'remove') {
      update.languages = update.languages.filter(
        (language) => language.localeTag !== operation.localeTag
      );
    }
    if (operation.operation === 'setBase') {
      setBaseLanguage(update.languages, operation.localeTag);
    }
  }

  return update;
}

function setBaseLanguage(
  languages: ProjectInformationLanguageUpdate[],
  localeTag: string
): void {
  for (const language of languages) {
    language.isBase = language.localeTag === localeTag;
  }
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

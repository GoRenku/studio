import {
  buildDiagnosticResult,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { ProjectInformationResource } from '../../client/index.js';
import { listAssetRecords } from '../database/access/assets.js';
import {
  readProjectInformationResourceFromDatabase,
  readResolvedProjectInformationFromDatabase,
} from '../database/access/project-information.js';
import {
  listProjectLocaleRecords,
  replaceProjectLocaleRecords,
  type ProjectLocaleRecord,
} from '../database/access/project-locales.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { PatchProjectInformationInput } from '../project-data-service-contracts.js';
import type { ResolvedProjectInformation } from './contracts.js';
import { persistProjectInformationScalarPatch } from './patch-persistence.js';
import { resolveProjectInformationPatch } from './patch-resolution.js';
import { validateResolvedProjectInformation } from './validation.js';

export async function patchProjectInformation(
  input: PatchProjectInformationInput
): Promise<ProjectInformationResource> {
  const { session } = await openProjectSession(input);
  try {
    session.db.transaction((tx) => {
      const transactionSession = { ...session, db: tx };
      const projectRecord = readProjectRecord(transactionSession);
      if (!projectRecord) {
        throw new ProjectDataError(
          'PROJECT_DATA021',
          `Project database has no project row: ${session.databasePath}.`
        );
      }

      const current = readResolvedProjectInformationFromDatabase(transactionSession);
      const resolved = resolveProjectInformationPatch(current, input.patch);
      validateResolvedProjectInformation(resolved);

      const existingLocales = listProjectLocaleRecords(transactionSession);
      if (input.patch.languages !== undefined) {
        const nextLocaleTags = new Set(
          resolved.languages.map((language) => language.localeTag)
        );
        assertRemovedLocalesAreUnused(
          transactionSession,
          existingLocales.filter((locale) => !nextLocaleTags.has(locale.localeTag))
        );
      }

      persistProjectInformationScalarPatch(
        transactionSession,
        projectRecord.id,
        input.patch,
        resolved
      );
      if (input.patch.languages !== undefined) {
        persistProjectLanguages(transactionSession, existingLocales, resolved);
      }
    });

    return readProjectInformationResourceFromDatabase(session);
  } finally {
    session.close();
  }
}

function persistProjectLanguages(
  session: DatabaseSession,
  existingLocales: ProjectLocaleRecord[],
  information: ResolvedProjectInformation
): void {
  const existingLocaleIds = new Map(
    existingLocales.map((language) => [language.localeTag, language.id])
  );
  const ids = createUniqueIdAllocator(createRandomIdGenerator());
  replaceProjectLocaleRecords(
    session,
    information.languages.map((language, index) => ({
      id: existingLocaleIds.get(language.localeTag) ?? ids('locale'),
      localeTag: language.localeTag,
      displayName: optionalTrimmed(language.displayName),
      isBase: language.isBase,
      supportsAudio: language.supportsAudio,
      supportsSubtitles: language.supportsSubtitles,
      position: index + 1,
    }))
  );
}

function assertRemovedLocalesAreUnused(
  session: DatabaseSession,
  removedLocales: ProjectLocaleRecord[]
): void {
  const issues: DiagnosticIssue[] = [];
  for (const locale of removedLocales) {
    for (const asset of listAssetRecords(session)) {
      if (asset.localeId !== locale.id) {
        continue;
      }
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA057',
          `Project locale ${locale.localeTag} cannot be removed because Asset ${asset.id} still uses it as ${asset.type}.`,
          {
            path: ['languages', locale.localeTag],
            context: 'project information update',
          },
          'Remove or reassign the locale-specific Asset before removing this project locale.'
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

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

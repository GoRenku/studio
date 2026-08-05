import {
  SUPPORTED_PROJECT_LOCALES,
  type ProjectInformationPatch,
  type ProjectInformationResource,
  type ProjectLanguage,
} from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';

export interface ProjectInformationDraft {
  title: string;
  aspectRatio: string;
  logline: string;
  synopsis: string;
  premise: string;
  projectLocaleTag: string;
}

export type ProjectInformationDraftResource = Pick<
  ProjectInformationResource,
  'title' | 'aspectRatio' | 'logline' | 'synopsis' | 'premise' | 'languages'
>;

export function projectShellToInformationResource(
  project: ProjectShellWithHttp
): ProjectInformationDraftResource {
  return {
    title: project.project.title,
    aspectRatio: project.project.aspectRatio,
    logline: project.project.logline,
    synopsis: project.project.synopsis,
    premise: project.project.premise,
    languages: project.languages,
  };
}

export function toProjectInformationDraft(
  resource: ProjectInformationDraftResource
): ProjectInformationDraft {
  return {
    title: resource.title,
    aspectRatio: resource.aspectRatio ?? '16:9',
    logline: resource.logline ?? '',
    synopsis: resource.synopsis ?? '',
    premise: resource.premise ?? '',
    projectLocaleTag:
      resource.languages.find((language) => language.isBase)?.localeTag ?? '',
  };
}

export function projectInformationDraftToPatch(
  persisted: ProjectInformationDraftResource,
  draft: ProjectInformationDraft
): ProjectInformationPatch {
  const previous = toProjectInformationDraft(persisted);
  const patch: ProjectInformationPatch = {};

  if (draft.title !== previous.title) {
    patch.title = draft.title;
  }
  if (draft.aspectRatio !== previous.aspectRatio) {
    patch.aspectRatio = draft.aspectRatio;
  }
  addOptionalTextPatch(patch, 'logline', previous.logline, draft.logline);
  addOptionalTextPatch(patch, 'synopsis', previous.synopsis, draft.synopsis);
  addOptionalTextPatch(patch, 'premise', previous.premise, draft.premise);

  if (draft.projectLocaleTag !== previous.projectLocaleTag) {
    patch.languages = [projectLanguageSelectionOperation(
      persisted.languages,
      draft.projectLocaleTag
    )];
  }
  return patch;
}

export function projectInformationDraftSignature(
  draft: ProjectInformationDraft
): string {
  return JSON.stringify(draft);
}

export function projectInformationIdentitySignature(
  draft: ProjectInformationDraft
): string {
  return JSON.stringify({
    title: draft.title,
    aspectRatio: draft.aspectRatio,
    logline: draft.logline,
    synopsis: draft.synopsis,
    premise: draft.premise,
  });
}

function addOptionalTextPatch(
  patch: ProjectInformationPatch,
  field: 'logline' | 'synopsis' | 'premise',
  previous: string,
  next: string
): void {
  if (next !== previous) {
    patch[field] = next === '' ? null : next;
  }
}

function projectLanguageSelectionOperation(
  configuredLanguages: ProjectLanguage[],
  localeTag: string
): NonNullable<ProjectInformationPatch['languages']>[number] {
  if (configuredLanguages.some((language) => language.localeTag === localeTag)) {
    return { operation: 'setBase', localeTag };
  }
  const catalogLocale = SUPPORTED_PROJECT_LOCALES.find(
    (language) => language.localeTag === localeTag
  );
  return {
    operation: 'add',
    localeTag,
    displayName: catalogLocale?.displayName,
    isBase: true,
  };
}

import { describe, expect, it } from 'vitest';
import type { ProjectInformationResource } from '@gorenku/studio-core/client';
import {
  projectInformationDraftToPatch,
  toProjectInformationDraft,
} from './project-information-draft';

describe('Project Information draft projection', () => {
  it('projects the configured base locale into one draft selection', () => {
    expect(toProjectInformationDraft(makeResource()).projectLocaleTag).toBe('en-US');
  });

  it('emits only changed scalar fields and explicit null clears', () => {
    const resource = makeResource();
    const draft = toProjectInformationDraft(resource);

    expect(projectInformationDraftToPatch(resource, {
      ...draft,
      title: 'The Siege Machine',
    })).toEqual({ title: 'The Siege Machine' });
    expect(projectInformationDraftToPatch(resource, {
      ...draft,
      logline: '',
    })).toEqual({ logline: null });
    expect(projectInformationDraftToPatch(resource, draft)).toEqual({});
  });

  it('sets an already configured locale as base without removing hidden locales', () => {
    const resource = makeResource();
    const draft = toProjectInformationDraft(resource);

    expect(projectInformationDraftToPatch(resource, {
      ...draft,
      projectLocaleTag: 'tr-TR',
    })).toEqual({
      languages: [{ operation: 'setBase', localeTag: 'tr-TR' }],
    });
  });

  it('adds a supported unconfigured locale as base without copying the locale list', () => {
    const resource = makeResource();
    const draft = toProjectInformationDraft(resource);

    expect(projectInformationDraftToPatch(resource, {
      ...draft,
      projectLocaleTag: 'es-ES',
    })).toEqual({
      languages: [
        {
          operation: 'add',
          localeTag: 'es-ES',
          displayName: 'Spanish',
          isBase: true,
        },
      ],
    });
  });
});

function makeResource(): ProjectInformationResource {
  return {
    title: 'Preparation of the Siege',
    aspectRatio: '16:9',
    logline: 'A historical documentary.',
    synopsis: 'A project synopsis.',
    premise: 'Preparation determines the outcome.',
    languages: [
      {
        id: 'locale_en',
        localeTag: 'en-US',
        displayName: 'English',
        isBase: true,
        supportsAudio: true,
        supportsSubtitles: true,
      },
      {
        id: 'locale_tr',
        localeTag: 'tr-TR',
        displayName: 'Turkish',
        isBase: false,
        supportsAudio: true,
        supportsSubtitles: true,
      },
    ],
  };
}

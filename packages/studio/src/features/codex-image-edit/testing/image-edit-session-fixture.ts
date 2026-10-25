import type { ImageEditRoute, ImageEditSession, ImageEditTargetChooser, ImageEditVersion } from '@gorenku/studio-codex/image-edit';

export function imageEditVersionFixture(assetFileId: string, takeNumber: number, change: Partial<ImageEditVersion> = {}): ImageEditVersion {
  return {
    assetFileId,
    takeNumber,
    imageUri: `renku-image-edit://session/media/${assetFileId}`,
    parentAssetFileId: null,
    selected: false,
    ...change,
  };
}

/** A fictional route with its own region modes, a style reference and one output control. */
export function imageEditRouteFixture(change: Partial<ImageEditRoute> = {}): ImageEditRoute {
  return {
    provider: 'acme-images', providerLabel: 'Acme Images', model: 'acme/retouch', label: 'Acme Retouch',
    regionModes: [
      { id: 'paint', label: 'Paint', instructionRequired: true, placeholder: 'What goes here?' },
      { id: 'erase', label: 'Erase', instructionRequired: false, placeholder: 'Optional fill' },
    ],
    styleReference: true,
    controls: { groups: [{ label: 'Output', fields: [{
      key: '/detail', label: 'Detail', kind: 'enum', initialValue: 'medium',
      options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }],
    }] }] },
    ...change,
  };
}

export function imageEditSessionFixture(change: Partial<ImageEditSession> = {}): ImageEditSession {
  return {
    sessionId: 'session',
    revision: 1,
    route: imageEditRouteFixture(),
    owner: { kind: 'castMember', name: 'Constantine XI Palaiologos' },
    imageType: 'cast_profile',
    selectable: true,
    versions: [imageEditVersionFixture('profile-3', 3, { selected: true })],
    editBaseAssetFileId: 'profile-3',
    styleReferences: [
      { assetFileId: 'style-command-light', name: 'Command light', lookbook: 'production', lookbookName: 'Production', imageUri: 'renku-image-edit://session/media/style-1' },
      { assetFileId: 'style-sketch', name: 'Loose sketch style', lookbook: 'storyboard', lookbookName: 'Storyboard', imageUri: 'renku-image-edit://session/media/style-2' },
    ],
    action: null,
    lastCompletedAction: null,
    initialWholeImageInstruction: '',
    ...change,
  };
}

export function imageEditTargetChooserFixture(change: Partial<ImageEditTargetChooser> = {}): ImageEditTargetChooser {
  const candidate = (assetFileId: string, imageType: string, takeNumber: number, selected: boolean) => ({
    assetFileId,
    owner: { kind: 'castMember', name: 'Constantine XI Palaiologos' },
    imageType,
    takeNumber,
    selected,
    createdAt: '2026-10-02T10:00:00.000Z',
    imageUri: `renku-image-target://chooser/media/${assetFileId}`,
  });
  return {
    chooserId: 'chooser',
    revision: 1,
    candidates: [
      candidate('profile-3', 'cast_profile', 3, true),
      candidate('profile-2', 'cast_profile', 2, false),
      candidate('sheet-1', 'character_sheet', 1, false),
    ],
    suggestedAssetFileId: 'profile-3',
    choice: null,
    ...change,
  };
}

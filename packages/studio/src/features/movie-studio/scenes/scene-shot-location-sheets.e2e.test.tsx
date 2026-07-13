// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeReferenceSelectionFixture,
  createShotVideoTakeStateE2eFixture,
  type ShotVideoTakeStateE2eFixture,
} from '@/services/testing/shot-video-take-state-e2e.test-fixture';
import {
  readShotVideoTakeWorkspace,
  setShotVideoTakeGenerationReference,
} from '@/services/studio-shot-video-takes-api';

describe('Shot Location Sheet references e2e', () => {
  let fixture: ShotVideoTakeStateE2eFixture;

  beforeAll(async () => {
    fixture = await createShotVideoTakeStateE2eFixture();
    await createShotVideoTakeReferenceSelectionFixture(fixture);
  });

  afterAll(() => {
    fixture.restoreFetch();
  });

  it('projects exact Location Sheet candidates for the Scene Location', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Location reference take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );

    const location = workspace.generation.references.locations.find(
      (candidate) => candidate.locationId === fixture.ids.locationId
    );
    expect(workspace.generation.references.general).toEqual([]);
    expect(workspace.generation.references.lookbook).toEqual([
      expect.objectContaining({ title: 'Imperial Wound Sheet' }),
    ]);
    expect(
      workspace.generation.references.castMembers.find(
        (candidate) => candidate.castMemberId === fixture.ids.castMemberId
      )?.characterSheets
    ).toEqual([
      expect.objectContaining({ title: expect.any(String) }),
    ]);
    expect(location?.environmentSheets.length).toBeGreaterThan(0);
    expect(
      new Set(location?.environmentSheets.map((sheet) => sheet.assetId)).size
    ).toBe(location?.environmentSheets.length);
    expect(location?.environmentSheets[0]).toMatchObject({
      locationId: fixture.ids.locationId,
      card: {
        previews: [
          {
            assetId: expect.any(String),
            assetFileId: expect.any(String),
            url: expect.stringContaining('/assets/'),
          },
        ],
      },
    });
  });

  it('persists alternate inclusion in the generic spec', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Selected Location reference take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const choice = workspace.generation.references.locations
      .find((location) => location.locationId === fixture.ids.locationId)
      ?.environmentSheets[0];
    expect(choice).toBeDefined();

    await setShotVideoTakeGenerationReference(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      { selectionId: choice!.card.selectionId, included: true }
    );
    const reloaded = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );

    expect(
      reloaded.generation.references.locations
        .find((location) => location.locationId === fixture.ids.locationId)
        ?.environmentSheets[0]?.selected
    ).toBe(true);
  });
});

// @vitest-environment jsdom
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneShotPlansTab } from './scene-shot-plans-tab';
import { ShotBriefGrid } from './shot-brief-grid';
import { ShotPlanBeatLinks } from './shot-plan-beat-links';
import { ShotImageCandidatesDialog } from './shot-image-candidates-dialog';
import { ShotPlanDetailPage } from './shot-plan-detail-page';
import { ShotPlanShotContent } from './shot-plan-shot-content';
import { ShotPlanShotRail } from './shot-plan-shot-rail';
import { useSceneShotPlans } from './use-scene-shot-plans';
import { useShotImageCandidates } from './use-shot-image-candidates';
import {
  deleteStudioShotImageCandidate,
  deleteStudioShotPlan,
  setStudioShotSelectedImage,
} from '@/services/studio-shot-plans-api';

vi.mock('./use-scene-shot-plans');
vi.mock('./use-shot-image-candidates');
vi.mock('@/services/studio-shot-plans-api', () => ({
  deleteStudioShotPlan: vi.fn(),
  deleteStudioShotImageCandidate: vi.fn(),
  setStudioShotSelectedImage: vi.fn(),
}));

describe('Shot Plans feature', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    if (!Range.prototype.getClientRects) {
      Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    }
    if (!Range.prototype.getBoundingClientRect) {
      Range.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    }
  });

  it('renders one plan card, mosaics selected images, and deletes through confirmation', async () => {
    const reload = vi.fn();
    vi.mocked(useSceneShotPlans).mockReturnValue({
      resource: {
        sceneId: 'scene_one',
        warnings: [],
        shotPlans: [{
          shotPlan: {
            id: 'plan_one',
            sceneId: 'scene_one',
            title: 'Council coverage',
            coverage: null,
            createdAt: '2026-07-27T10:00:00.000Z',
            updatedAt: '2026-07-27T10:00:00.000Z',
            shots: [
              shot('shot_one', 0, 'asset_selected', [
                asset('asset_unselected', '/unselected.jpg'),
                asset('asset_selected', '/selected-one.jpg'),
              ]),
              shot('shot_two', 1, 'asset_second', [
                asset('asset_second', '/selected-two.jpg'),
              ]),
            ],
          },
          coveredBeats: [
            {
              beat: {
                id: 'beat_one',
                title: 'The decision',
                description: 'The council decides.',
                narrativeDevelopment: 'The choice hardens.',
                narrativePurpose: 'Commit the group.',
                screenplayBlockIndexes: [0],
                castMemberIds: [],
                locationIds: [],
              },
              position: 3,
              storyboardImage: null,
            },
          ],
        }],
      },
      error: null,
      reload,
    });
    vi.mocked(deleteStudioShotPlan).mockResolvedValue({ valid: true } as never);
    const onSelect = vi.fn();

    render(
      <SceneShotPlansTab
        projectName='constantinople'
        sceneId='scene_one'
        onSelect={onSelect}
        onPlanActivate={vi.fn()}
      />
    );

    expect(screen.getAllByRole('img').map((image) => image.getAttribute('src')))
      .toEqual(['/selected-one.jpg', '/selected-two.jpg']);
    expect(screen.queryByRole('img', { name: /unselected/i })).toBeNull();
    expect(screen.getByText('Council coverage')).not.toBeNull();
    expect(screen.getByText('Beat 4')).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Shot Plan Council coverage' })
    );
    expect(onSelect).toHaveBeenCalledWith({
      type: 'scene',
      id: 'scene_one',
      sceneTab: 'shotPlans',
      shotPlanId: 'plan_one',
      shotId: 'shot_one',
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Inspect Shot Plan Council coverage',
      })
    );
    expect(onSelect).toHaveBeenCalledTimes(2);

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Shot Plan Council coverage' })
    );
    expect(screen.getAllByText(
      'This Shot Plan and its Shot images will move to Trash. You can restore them later.'
    )).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(deleteStudioShotPlan).toHaveBeenCalledWith({
        projectName: 'constantinople',
        shotPlanId: 'plan_one',
      });
    });
    expect(reload).toHaveBeenCalled();
  });

  it('uses lazy candidate order, one-way selection, and no delete for selected image', async () => {
    const reload = vi.fn();
    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: {
        items: [
          asset('asset_second', '/second.jpg'),
          asset('asset_selected', '/selected.jpg'),
          asset('asset_first', '/first.jpg'),
        ],
        selectedAssetId: 'asset_selected',
      },
      error: null,
      reload,
    });
    vi.mocked(setStudioShotSelectedImage).mockResolvedValue({
      valid: true,
    } as never);
    vi.mocked(deleteStudioShotImageCandidate).mockResolvedValue({
      valid: true,
    } as never);
    const onShotPlansChange = vi.fn();

    render(
      <ShotImageCandidatesDialog
        projectName='constantinople'
        sceneId='scene_one'
        shot={shot('shot_one', 0, 'asset_selected', [])}
        open
        onOpenChange={vi.fn()}
        onShotPlansChange={onShotPlansChange}
      />
    );

    expect(screen.getAllByRole('img').map((image) => image.getAttribute('src')))
      .toEqual(['/second.jpg', '/selected.jpg', '/first.jpg']);
    expect(screen.getByRole('status', { name: 'Selected image' })).not.toBeNull();
    expect(screen.queryByRole('button', {
      name: 'Delete image candidate 2',
    })).toBeNull();

    const previewTrigger = screen.getByRole('button', {
      name: 'Preview Image candidate 1 for Shot 1',
    });
    fireEvent.click(previewTrigger);
    expect(screen.getByRole('img', {
      name: 'Image candidate 1 for Shot 1',
    })).not.toBeNull();
    expect(setStudioShotSelectedImage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {
      name: 'Close image preview',
    }));
    await waitFor(() => expect(screen.queryByLabelText(
      'Close image preview'
    )).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(previewTrigger));

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use as selected image' })[0]!
    );
    await waitFor(() => {
      expect(setStudioShotSelectedImage).toHaveBeenCalledWith({
        projectName: 'constantinople',
        shotId: 'shot_one',
        assetId: 'asset_second',
      });
    });
    expect(reload).toHaveBeenCalled();
    expect(onShotPlansChange).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete image candidate 1' })
    );
    expect(screen.getAllByText(
      'This image will move to Trash. You can restore it later.'
    )).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(deleteStudioShotImageCandidate).toHaveBeenCalledWith({
        projectName: 'constantinople',
        shotId: 'shot_one',
        assetId: 'asset_second',
      });
    });
  });

  it('opens one candidate directly without a choose control or implicit selection', () => {
    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: {
        items: [asset('asset_only', '/only.jpg')],
        selectedAssetId: null,
      },
      error: null,
      reload: vi.fn(),
    });

    render(
      <ShotImageCandidatesDialog
        projectName='constantinople'
        sceneId='scene_one'
        shot={shot('shot_one', 0, null, [])}
        open
        onOpenChange={vi.fn()}
        onShotPlansChange={vi.fn()}
      />
    );

    expect(screen.getByRole('img', {
      name: 'Image candidate 1 for Shot 1',
    })).not.toBeNull();
    expect(screen.queryByRole('button', {
      name: 'Use as selected image',
    })).toBeNull();
    expect(setStudioShotSelectedImage).not.toHaveBeenCalled();
  });

  it('keeps a selection failure visible and retryable inside the collection', async () => {
    const reload = vi.fn();
    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: {
        items: [
          asset('asset_first', '/first.jpg'),
          asset('asset_second', '/second.jpg'),
        ],
        selectedAssetId: 'asset_first',
      },
      error: null,
      reload,
    });
    vi.mocked(setStudioShotSelectedImage).mockRejectedValue(
      new Error('The selected image could not be saved.')
    );

    render(
      <ShotImageCandidatesDialog
        projectName='constantinople'
        sceneId='scene_one'
        shot={shot('shot_one', 0, 'asset_first', [])}
        open
        onOpenChange={vi.fn()}
        onShotPlansChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Use as selected image' })
    );
    expect(
      await screen.findByText('The selected image could not be saved.')
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the exact rail image action after direct and collection close', async () => {
    const shots = [
      shot('shot_one', 0, null, [asset('asset_only', '/only.jpg')]),
      shot('shot_two', 1, null, [
        asset('asset_first', '/first.jpg'),
        asset('asset_second', '/second.jpg'),
      ]),
    ];
    vi.mocked(useSceneShotPlans).mockReturnValue({
      resource: {
        sceneId: 'scene_one',
        warnings: [],
        shotPlans: [{
          shotPlan: {
            id: 'plan_one',
            sceneId: 'scene_one',
            title: 'Council coverage',
            coverage: null,
            createdAt: '2026-07-27T10:00:00.000Z',
            updatedAt: '2026-07-27T10:00:00.000Z',
            shots,
          },
          coveredBeats: [],
        }],
      },
      error: null,
      reload: vi.fn(),
    });
    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: {
        items: [asset('asset_only', '/only.jpg')],
        selectedAssetId: null,
      },
      error: null,
      reload: vi.fn(),
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0)
    );

    render(
      <ShotPlanDetailPage
        projectName='constantinople'
        sceneId='scene_one'
        shotPlanId='plan_one'
        shotId='shot_one'
        onSelect={vi.fn()}
      />
    );

    const firstTrigger = screen.getByRole('button', {
      name: 'Manage images for Shot 1',
    });
    fireEvent.click(firstTrigger);
    fireEvent.click(screen.getByRole('button', {
      name: 'Close image preview',
    }));
    await waitFor(() => expect(document.activeElement).toBe(firstTrigger));

    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: {
        items: [
          asset('asset_first', '/first.jpg'),
          asset('asset_second', '/second.jpg'),
        ],
        selectedAssetId: null,
      },
      error: null,
      reload: vi.fn(),
    });
    const secondTrigger = screen.getByRole('button', {
      name: 'Manage images for Shot 2',
    });
    fireEvent.click(secondTrigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(document.activeElement).toBe(secondTrigger));
  });

  it('keeps collection loading, error retry, and empty states quiet', () => {
    const reload = vi.fn();
    const props = {
      projectName: 'constantinople',
      sceneId: 'scene_one',
      onSelect: vi.fn(),
      onPlanActivate: vi.fn(),
    };
    vi.mocked(useSceneShotPlans).mockReturnValue({
      resource: null,
      error: null,
      reload,
    });
    const { rerender } = render(<SceneShotPlansTab {...props} />);
    expect(screen.getByText('Loading Shot Plans...')).not.toBeNull();

    vi.mocked(useSceneShotPlans).mockReturnValue({
      resource: null,
      error: 'Unable to load Shot Plans.',
      reload,
    });
    rerender(<SceneShotPlansTab {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalled();

    vi.mocked(useSceneShotPlans).mockReturnValue({
      resource: { sceneId: 'scene_one', shotPlans: [], warnings: [] },
      error: null,
      reload,
    });
    rerender(<SceneShotPlansTab {...props} />);
    expect(screen.getByText('No Shot Plans for this Scene.')).not.toBeNull();
  });

  it('keeps candidate loading and error retry stable without an empty dialog', () => {
    const reload = vi.fn();
    const props = {
      projectName: 'constantinople',
      sceneId: 'scene_one',
      shot: shot('shot_one', 0, null, []),
      open: true,
      onOpenChange: vi.fn(),
      onShotPlansChange: vi.fn(),
    };
    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: null,
      error: null,
      reload,
    });
    const { rerender } = render(<ShotImageCandidatesDialog {...props} />);
    expect(screen.getByText('Loading Shot images...')).not.toBeNull();

    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: null,
      error: 'Unable to load Shot images.',
      reload,
    });
    rerender(<ShotImageCandidatesDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalled();

    vi.mocked(useShotImageCandidates).mockReturnValue({
      resource: { items: [], selectedAssetId: null },
      error: null,
      reload,
    });
    rerender(<ShotImageCandidatesDialog {...props} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps Brief and exact read-only Description as sibling tabs', async () => {
    const description =
      '# Exact authored description — ' + 'unrepaired wording. '.repeat(60);
    const { container } = render(
      <ShotPlanShotContent
        shot={{
          ...shot('shot_one', 0, null, []),
          description,
          brief: {
            durationSeconds: 3.5,
            framing: { start: 'wide-shot', end: 'close-up' },
            camera: { angle: 'eye-level' },
            motion: { movement: 'push-in' },
            optics: {
              intent: 'Hold the map and face in shared focus.',
              focalLengthMm: 50,
              depthOfField: 'Deep',
              focusTarget: 'The map and face',
            },
            lighting: { intent: 'Cold dawn entering from the east.' },
          },
        }}
        coveredBeats={[
          {
            beat: {
              id: 'beat_one',
              title: 'First Beat',
              description: 'First Beat description.',
              narrativeDevelopment: 'First development.',
              narrativePurpose: 'First purpose.',
              screenplayBlockIndexes: [0],
              castMemberIds: [],
              locationIds: [],
            },
            position: 0,
            storyboardImage: null,
          },
          {
            beat: {
              id: 'beat_two',
              title: 'Second Beat',
              description: 'Second Beat description.',
              narrativeDevelopment: 'Second development.',
              narrativePurpose: 'Second purpose.',
              screenplayBlockIndexes: [1],
              castMemberIds: [],
              locationIds: [],
            },
            position: 1,
            storyboardImage: null,
          },
        ]}
      />
    );

    const shotTitle = screen.getByRole('heading', { name: 'Shot 1' });
    const coveredBeats = screen.getByRole('group', { name: 'Covered Beats' });
    expect(shotTitle.parentElement).toBe(coveredBeats.parentElement?.parentElement);
    expect(shotTitle.parentElement?.className).toContain('flex-col');
    expect(shotTitle.compareDocumentPosition(coveredBeats)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByText('Beat 1')).not.toBeNull();
    expect(screen.getByText('Beat 2')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Brief' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Description' })).not.toBeNull();
    expect(screen.getAllByText(/Framing|Camera|Motion|Optics|Lighting/))
      .toHaveLength(5);
    expect(
      Array.from(container.querySelectorAll('div')).some((element) =>
        /^repeat\(auto-fill, \d+px\)$/.test(element.style.gridTemplateColumns)
      )
    ).toBe(true);
    expect(screen.getByText('Lens 50 mm')).not.toBeNull();
    expect(screen.getByText('Depth Deep')).not.toBeNull();
    expect(screen.getByText('Focus The map and face')).not.toBeNull();
    expect(screen.queryByText('Preview')).toBeNull();

    const startFraming = screen.getByRole('button', {
      name: 'Inspect Start framing',
    });
    const endFraming = screen.getByRole('button', {
      name: 'Inspect End framing',
    });
    endFraming.focus();
    fireEvent.click(endFraming);
    expect(await screen.findByRole('img', {
      name: /End framing:/,
    })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', {
      name: 'Close image preview',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(endFraming));
    fireEvent.click(startFraming);
    expect(await screen.findByRole('img', {
      name: /Start framing:/,
    })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', {
      name: 'Close image preview',
    }));

    const descriptionTab = screen.getByRole('tab', { name: 'Description' });
    fireEvent.mouseDown(descriptionTab, { button: 0, ctrlKey: false });
    fireEvent.click(descriptionTab);
    const editor = await screen.findByRole('textbox', {
      name: 'Shot description',
    });
    expect(editor.getAttribute('aria-readonly')).toBe('true');
    expect(editor.textContent).toBe(description);
    expect(
      editor.closest('[data-code-mirror-editor]')?.parentElement?.className
    ).toContain('px-6');
    expect(screen.queryByText('Framing')).toBeNull();
  });

  it('keeps Shot rail selection, duration, and image management independent', () => {
    const firstShot = {
      ...shot('shot_one', 0, 'asset_selected', [
        asset('asset_selected', '/selected.jpg'),
      ]),
      brief: { durationSeconds: 3.5 },
    };
    const secondShot = shot('shot_two', 1, null, []);
    const onSelectShot = vi.fn();
    const onManageImages = vi.fn();

    const { container } = render(
      <ShotPlanShotRail
        shotPlan={{
          id: 'plan_one',
          sceneId: 'scene_one',
          title: 'Council coverage',
          coverage: null,
          createdAt: '2026-07-27T10:00:00.000Z',
          updatedAt: '2026-07-27T10:00:00.000Z',
          shots: [firstShot, secondShot],
        }}
        selectedShotId='shot_one'
        onSelectShot={onSelectShot}
        onManageImages={onManageImages}
      />
    );

    expect(screen.getByRole('button', { name: 'Select Shot 1' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Select Shot 2' })).not.toBeNull();
    expect(screen.getByLabelText('Approximate duration 3.5 seconds')).not.toBeNull();
    expect(screen.getByText('3.5s')).not.toBeNull();
    expect(container.textContent).not.toContain('Shot 1 of 2');

    expect(
      screen.queryByRole('button', { name: 'Manage images for Shot 2' })
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Manage images for Shot 1' })
    );
    expect(onManageImages).toHaveBeenCalledWith(firstShot);
    expect(onSelectShot).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Select Shot 2' }));
    expect(onSelectShot).toHaveBeenCalledWith(secondShot);
  });

  it('opens storyboard preview from keyboard focus and keeps Beats without images quiet', async () => {
    render(
      <ShotPlanBeatLinks
        coveredBeats={[
          {
            beat: {
              id: 'beat_with_image',
              title: 'The decision',
              description: 'The council decides.',
              narrativeDevelopment: 'The choice hardens.',
              narrativePurpose: 'Commit the group.',
              screenplayBlockIndexes: [0],
              castMemberIds: [],
              locationIds: [],
            },
            position: 3,
            storyboardImage: {
              assetId: 'storyboard_asset',
              assetFileId: 'storyboard_file',
              url: '/storyboard.webp',
            },
          },
          {
            beat: {
              id: 'beat_without_image',
              title: 'The reply',
              description: 'The reply lands.',
              narrativeDevelopment: 'The room shifts.',
              narrativePurpose: 'Turn the council.',
              screenplayBlockIndexes: [1],
              castMemberIds: [],
              locationIds: [],
            },
            position: 4,
            storyboardImage: null,
          },
        ]}
      />
    );

    const previewTrigger = screen.getByRole('button', {
      name: 'Beat 4',
    });
    fireEvent.focus(previewTrigger);
    expect(
      await screen.findByRole('img', {
        name: 'Storyboard image for Beat 4',
      })
    ).not.toBeNull();
    expect(screen.getByText('Beat 5').tagName).toBe('SPAN');
  });

  it('renders exact glossary catalogs and returns focus to each guide trigger', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(
      <ShotBriefGrid
        brief={{
          framing: { start: 'wide-shot', end: 'close-up' },
          camera: { angle: 'eye-level' },
          motion: { movement: 'push-in' },
          optics: { intent: 'Hold both faces in shared focus.' },
          lighting: { intent: 'Cold dawn entering from the east.' },
        }}
      />
    );

    const cases = [
      ['Framing Guide', 9],
      ['Camera Angle Guide', 8],
      ['Motion Guide', 10],
    ] as const;
    for (const [name, count] of cases) {
      const trigger = screen.getByRole('button', {
        name: `Open ${name}`,
      });
      fireEvent.click(trigger);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getAllByRole('article')).toHaveLength(count);
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(document.activeElement).toBe(trigger);
    }
  });
});

function shot(
  id: string,
  position: number,
  selectedImageId: string | null,
  images: ReturnType<typeof asset>[]
) {
  return {
    id,
    position,
    title: `Shot ${position + 1}`,
    description: `Description ${position + 1}`,
    brief: {},
    images,
    selectedImageId,
  };
}

function asset(id: string, url: string) {
  return {
    id,
    owner: { kind: 'shot' as const, id: 'shot_one' },
    localeId: null,
    type: 'shot_image',
    availability: 'ready' as const,
    mediaKind: 'image',
    title: 'Shot image',
    oneLineSummary: null,
    origin: 'generated',
    referenceName: null,
    purpose: null,
    files: [{
      id: `file_${id}`,
      role: 'primary',
      mediaKind: 'image',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      contentHash: null,
      width: 1920,
      height: 1080,
      durationSeconds: null,
      url,
    }],
    createdAt: '2026-07-27T10:00:00.000Z',
    updatedAt: '2026-07-27T10:00:00.000Z',
  };
}

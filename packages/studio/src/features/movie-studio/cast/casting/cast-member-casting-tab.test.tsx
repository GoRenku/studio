// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import {
  castLookCandidate,
  readCastCasting,
  selectCostumeCharacterSheet,
  setCastingCandidateStatus,
} from '@/services/studio-cast-casting-api';
import { CastMemberCastingTab } from './cast-member-casting-tab';
import { loadRenderedImages, stubImageZoomLayout } from '@/ui/testing/image-zoom-layout';
import { castCastingResource } from './casting-test-fixtures';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('@/services/studio-cast-casting-api', () => ({
  readCastCasting: vi.fn(),
  setCastingCandidateStatus: vi.fn(),
  castLookCandidate: vi.fn(),
  selectCostumeCharacterSheet: vi.fn(),
}));

describe('CastMemberCastingTab', () => {
  beforeEach(() => {
    vi.mocked(readCastCasting).mockReset();
    vi.mocked(setCastingCandidateStatus).mockReset();
    vi.mocked(castLookCandidate).mockReset();
    vi.mocked(selectCostumeCharacterSheet).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('asks the agent to cast the character when there are no Looks', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource({ looks: [], costumes: [], characterSheets: [] }));

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    expect(await screen.findByRole('heading', { name: "Ada isn't cast yet" })).toBeTruthy();
    expect(screen.getByText('Cast Ada.')).toBeTruthy();
  });

  it('shows each Look with its cast candidate, scenes, casting round and costume counts', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    const young = (await screen.findByRole('heading', { name: 'Young', level: 3 })).closest('article')!;
    expect(within(young).getByRole('img', { name: 'Young, cast' }).getAttribute('src')).toBe('/assets/asset_young_b');
    expect(within(young).getByText('Scenes 2–4')).toBeTruthy();
    expect(within(young).getByText('Cast from round 1 of 1 · Lumen Image')).toBeTruthy();
    expect(within(young).getByText('2 costumes · 1 sheet picked')).toBeTruthy();

    const older = screen.getByRole('heading', { name: 'Years later', level: 3 }).closest('article')!;
    expect(within(older).queryByRole('img')).toBeNull();
    expect(within(older).getByText('Scenes 1, 5–6')).toBeTruthy();
    expect(within(older).getByText('Not cast yet · 1 round')).toBeTruthy();
  });

  it('shows the wardrobe strip with a Look band and a Costume band', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    await screen.findByText('Wardrobe by scene');
    expect(screen.getByText('Look')).toBeTruthy();
    expect(screen.getByText('Costume')).toBeTruthy();
    expect(screen.getAllByTitle('Years later')).toHaveLength(2);
    expect(screen.getAllByTitle('Suit')).toHaveLength(2);
    expect(screen.getAllByTitle('Overalls')[0]!.style.gridColumn).toBe('span 2');
  });

  it('summarizes each round with its models, counts and estimate', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    expect(await screen.findByText('Round 1 · 3 candidates · Lumen Image × 3 · estimated $0.30')).toBeTruthy();
    expect(screen.getByText('Round 1 · 1 of 4 candidates · Lumen Image × 2, Prism × 2')).toBeTruthy();
    expect(screen.getAllByText('Lumen Image', { selector: 'figcaption' })).toHaveLength(3);
  });

  it('shortlists, hides and casts candidates through the Studio routes, then reloads', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    vi.mocked(setCastingCandidateStatus).mockResolvedValue({} as never);
    vi.mocked(castLookCandidate).mockResolvedValue({} as never);

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Casting rounds · Young');

    fireEvent.click(screen.getByRole('button', { name: 'Remove from shortlist' }));
    await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenCalledWith('grid', 'cast_ada', 'asset_young_a', 'candidate'));

    fireEvent.click(screen.getByRole('button', { name: 'Show again' }));
    await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenCalledWith('grid', 'cast_ada', 'asset_young_c', 'candidate'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Hide' })[0]!);
    await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenCalledWith('grid', 'cast_ada', 'asset_young_a', 'hidden'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Cast' })[0]!);
    await waitFor(() => expect(castLookCandidate).toHaveBeenCalledWith('grid', 'cast_ada', 'look_young', 'asset_young_a'));
    await waitFor(() => expect(readCastCasting).toHaveBeenCalledTimes(5));
  });

  it('marks the cast candidate and offers more like the shortlist', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Casting rounds · Young');

    expect(screen.getAllByText('Cast', { selector: 'span' })).toHaveLength(1);
    expect(screen.getByText('Run another casting round for Ada · Young like the shortlisted candidates.')).toBeTruthy();
  });

  it('shows a request for a Look with no rounds', async () => {
    const resource = castCastingResource();
    resource.looks[1] = { ...resource.looks[1]!, rounds: [] };
    vi.mocked(readCastCasting).mockResolvedValue(resource);

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    expect(await screen.findByText('Run a casting round for Ada · Years later.')).toBeTruthy();
  });

  it('reports a failed pick without leaving the tab', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    vi.mocked(castLookCandidate).mockRejectedValue(new Error('That candidate belongs to another Look.'));

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Casting rounds · Young');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cast' })[0]!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That candidate belongs to another Look.'));
    expect(screen.getByText('Casting rounds · Young')).toBeTruthy();
  });

  it('lists each costume with every character sheet and picks one through the Studio route', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    vi.mocked(selectCostumeCharacterSheet).mockResolvedValue({} as never);

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Character sheets');

    const overalls = screen.getByRole('heading', { name: 'Overalls' }).parentElement!.parentElement!;
    expect(within(overalls).getByText('Scenes 2–3')).toBeTruthy();
    expect(within(overalls).getByText('Young look')).toBeTruthy();
    expect(within(overalls).getByText('Picked')).toBeTruthy();
    expect(within(overalls).getAllByRole('button', { name: /for Overalls/ })).toHaveLength(2);
    expect(within(overalls).getAllByRole('button', { name: 'View sheet large' })).toHaveLength(2);

    const raincoat = screen.getByRole('heading', { name: 'Raincoat' }).parentElement!.parentElement!;
    expect(within(raincoat).queryByText('Picked')).toBeNull();
    fireEvent.click(within(raincoat).getAllByRole('button', { name: /^Pick for Raincoat/ })[1]!);

    await waitFor(() =>
      expect(selectCostumeCharacterSheet).toHaveBeenCalledWith('grid', 'cast_ada', 'costume_raincoat', 'asset_sheet_raincoat')
    );
  });

  it.each([
    [{ costumes: [], characterSheets: [] }, "Plan Ada's wardrobe."],
    [{ characterSheets: [] }, "Make Ada's character sheets."],
  ])('asks for the next wardrobe step when it is missing', async (overrides, request) => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource(overrides));

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    expect(await screen.findByText(request)).toBeTruthy();
  });

  it.each(['surface:castMember:cast_ada', 'screenplay'])('reloads after %s changes', async (resourceKey) => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Casting rounds · Young');

    act(() => {
      window.dispatchEvent(new CustomEvent('renku:studio-resource-changed', {
        detail: { projectName: 'grid', resourceKeys: [resourceKey] },
      }));
    });

    await waitFor(() => expect(readCastCasting).toHaveBeenCalledTimes(2));
  });

  describe('zoom', () => {
    let restoreLayout: () => void;
    beforeEach(() => { restoreLayout = stubImageZoomLayout({ width: 800, height: 600 }, { width: 1600, height: 1200 }); });
    afterEach(() => { restoreLayout(); });

    it('opens a candidate large to zoom, with shortlist, hide and cast in the viewer', async () => {
      vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
      vi.mocked(setCastingCandidateStatus).mockResolvedValue({} as never);
      vi.mocked(castLookCandidate).mockResolvedValue({} as never);

      render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
      await screen.findByText('Casting rounds · Young');
      fireEvent.click(screen.getAllByRole('button', { name: 'Open casting candidate from lumen image' })[0]!);
      const viewer = await screen.findByRole('dialog');
      loadRenderedImages();

      fireEvent.click(within(viewer).getByRole('button', { name: 'Zoom in' }));
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('75%');
      fireEvent.click(within(viewer).getByRole('button', { name: 'Fit to view' }));
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('Fit');

      fireEvent.click(within(viewer).getByRole('button', { name: 'Remove from shortlist' }));
      await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenCalledWith('grid', 'cast_ada', 'asset_young_a', 'candidate'));
      fireEvent.click(within(viewer).getByRole('button', { name: 'Hide' }));
      await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenLastCalledWith('grid', 'cast_ada', 'asset_young_a', 'hidden'));
      fireEvent.click(within(viewer).getByRole('button', { name: 'Cast' }));
      await waitFor(() => expect(castLookCandidate).toHaveBeenCalledWith('grid', 'cast_ada', 'look_young', 'asset_young_a'));

      fireEvent.click(within(viewer).getByRole('button', { name: 'Show next image' }));
      loadRenderedImages();
      expect(within(viewer).getByText('Cast', { selector: 'span' })).toBeTruthy();
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('Fit');
    });

    it('opens a character sheet large from its corner button and picks it from the viewer', async () => {
      vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
      vi.mocked(selectCostumeCharacterSheet).mockResolvedValue({} as never);

      render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
      await screen.findByText('Character sheets');
      const raincoat = screen.getByRole('heading', { name: 'Raincoat' }).parentElement!.parentElement!;
      fireEvent.click(within(raincoat).getAllByRole('button', { name: 'View sheet large' })[1]!);
      const viewer = await screen.findByRole('dialog');
      loadRenderedImages();

      fireEvent.click(within(viewer).getByRole('button', { name: 'Actual pixels' }));
      expect(within(viewer).getByRole('button', { name: 'Fit to view' }).textContent).toBe('100%');

      fireEvent.click(within(viewer).getByRole('button', { name: 'Pick' }));
      await waitFor(() =>
        expect(selectCostumeCharacterSheet).toHaveBeenCalledWith('grid', 'cast_ada', 'costume_raincoat', 'asset_sheet_raincoat')
      );
    });
  });
});

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

  it('shows each Look with its picture, name and one status, and opens on the first Look with a round', async () => {
    const resource = castCastingResource();
    resource.looks.unshift({ ...resource.looks[1]!, id: 'look_child', name: 'Child', sceneIds: [], rounds: [] });
    vi.mocked(readCastCasting).mockResolvedValue(resource);

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    const young = await screen.findByRole('tab', { name: /Young/ });
    expect(young.getAttribute('aria-selected')).toBe('true');
    expect(within(young).getByRole('img', { name: 'Young, cast' }).getAttribute('src')).toBe('/assets/asset_young_b');
    expect(within(young).getByText('Cast')).toBeTruthy();
    expect(within(screen.getByRole('tab', { name: /Years later/ })).getByText('1 candidate')).toBeTruthy();
    expect(within(screen.getByRole('tab', { name: /Child/ })).getByText('Not cast')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Young', level: 3 })).toBeTruthy();
    expect(screen.getByText('3 scenes')).toBeTruthy();
  });

  it('lights up the picked Look in the scene bar and switches Looks', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    expect(await screen.findByRole('img', { name: 'Young: Scenes 2–4' })).toBeTruthy();
    expect(screen.getByTitle('Scene 1 · Years later').className).toContain('opacity-30');
    expect(screen.getByTitle('Scene 2 · Young').className).not.toContain('opacity-30');

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Years later/ }));

    expect(screen.getByRole('img', { name: 'Years later: Scenes 1, 5–6' })).toBeTruthy();
    expect(screen.getByTitle('Scene 2 · Young').className).toContain('opacity-30');
    expect(screen.getByRole('heading', { name: 'Years later', level: 3 })).toBeTruthy();
  });

  it('summarizes each round with its count and estimate', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    expect(await screen.findByText('Round 1 · 3 candidates · $0.30')).toBeTruthy();
    expect(screen.getAllByText('Lumen Image', { selector: 'figcaption span' })).toHaveLength(2);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Years later/ }));
    expect(screen.getByText('Round 1 · 1 of 4')).toBeTruthy();
  });

  it('hides, shows again and casts candidates through the Studio routes, then reloads', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    vi.mocked(setCastingCandidateStatus).mockResolvedValue({} as never);
    vi.mocked(castLookCandidate).mockResolvedValue({} as never);

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Round 1 · 3 candidates · $0.30');

    expect(screen.getAllByRole('button', { name: /^Open casting candidate/ })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Hide' })[0]!);
    await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenCalledWith('grid', 'cast_ada', 'asset_young_a', 'hidden'));

    fireEvent.click(screen.getByRole('button', { name: 'Show 1 hidden' }));
    expect(screen.getAllByRole('button', { name: /^Open casting candidate/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Show again' }));
    await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenCalledWith('grid', 'cast_ada', 'asset_young_c', 'candidate'));
    fireEvent.click(screen.getByRole('button', { name: 'Fold away 1 hidden' }));
    expect(screen.getAllByRole('button', { name: /^Open casting candidate/ })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Cast' })[0]!);
    await waitFor(() => expect(castLookCandidate).toHaveBeenCalledWith('grid', 'cast_ada', 'look_young', 'asset_young_a'));
    await waitFor(() => expect(readCastCasting).toHaveBeenCalledTimes(4));
  });

  it('offers more like the kept candidates only while the Look is not cast', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Round 1 · 3 candidates · $0.30');
    expect(screen.queryByText(/like the candidates I kept/)).toBeNull();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Years later/ }));
    expect(screen.getByText('Run another casting round for Ada · Years later like the candidates I kept.')).toBeTruthy();
    expect(screen.queryByText('Ask your agent')).toBeNull();
  });

  it('shows one request card for a Look with no rounds', async () => {
    const resource = castCastingResource();
    resource.looks[1] = { ...resource.looks[1]!, rounds: [] };
    vi.mocked(readCastCasting).mockResolvedValue(resource);

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /Years later/ }));

    expect(screen.getByText('No casting rounds yet')).toBeTruthy();
    expect(screen.getByText('Run a casting round for Ada · Years later.')).toBeTruthy();
    expect(screen.getAllByText('Ask your agent')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Costumes' })).toBeNull();
  });

  it('reports a failed pick without leaving the tab', async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    vi.mocked(castLookCandidate).mockRejectedValue(new Error('That candidate belongs to another Look.'));

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByText('Round 1 · 3 candidates · $0.30');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cast' })[0]!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That candidate belongs to another Look.'));
    expect(screen.getByText('Round 1 · 3 candidates · $0.30')).toBeTruthy();
  });

  it("lists the cast Look's costumes with every character sheet and picks one through the Studio route", async () => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    vi.mocked(selectCostumeCharacterSheet).mockResolvedValue({} as never);

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByRole('heading', { name: 'Costumes' });
    expect(screen.queryByRole('heading', { name: 'Suit' })).toBeNull();

    const overalls = screen.getByRole('heading', { name: 'Overalls' }).parentElement!.parentElement!;
    expect(within(overalls).getByText('Scenes 2–3')).toBeTruthy();
    expect(within(overalls).getByText('Picked')).toBeTruthy();
    expect(within(overalls).getAllByRole('button', { name: /for Overalls/ })).toHaveLength(2);
    expect(within(overalls).getAllByRole('button', { name: 'View sheet large' })).toHaveLength(2);

    const raincoat = screen.getByRole('heading', { name: 'Raincoat' }).parentElement!.parentElement!;
    expect(within(raincoat).queryByText('Picked')).toBeNull();
    fireEvent.click(within(raincoat).getAllByRole('button', { name: /^Pick for Raincoat/ })[1]!);

    await waitFor(() =>
      expect(selectCostumeCharacterSheet).toHaveBeenCalledWith('grid', 'cast_ada', 'costume_raincoat', 'asset_sheet_raincoat')
    );

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Years later/ }));
    expect(screen.queryByRole('heading', { name: 'Costumes' })).toBeNull();
  });

  it.each([
    [{ costumes: [], characterSheets: [] }, "Plan Ada's wardrobe."],
    [{ characterSheets: [] }, "Make Ada's character sheets."],
  ])('asks for the next wardrobe step of the cast Look in one card', async (overrides, request) => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource(overrides));

    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);

    expect(await screen.findByText(request)).toBeTruthy();
    expect(screen.getAllByText('Ask your agent')).toHaveLength(1);
  });

  it.each(['surface:castMember:cast_ada', 'screenplay'])('reloads after %s changes', async (resourceKey) => {
    vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
    render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
    await screen.findByRole('tab', { name: /Young/ });

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

    it('opens a candidate large to zoom, with hide and cast in the zoom pill', async () => {
      vi.mocked(readCastCasting).mockResolvedValue(castCastingResource());
      vi.mocked(setCastingCandidateStatus).mockResolvedValue({} as never);
      vi.mocked(castLookCandidate).mockResolvedValue({} as never);

      render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
      await screen.findByText('Round 1 · 3 candidates · $0.30');
      fireEvent.click(screen.getAllByRole('button', { name: 'Open casting candidate from lumen image' })[0]!);
      const viewer = await screen.findByRole('dialog');
      loadRenderedImages();

      const pill = within(viewer).getByRole('toolbar', { name: 'Zoom' });
      fireEvent.click(within(pill).getByRole('button', { name: 'Zoom in' }));
      expect(within(pill).getByRole('button', { name: 'Fit to view' }).textContent).toBe('75%');
      fireEvent.click(within(pill).getByRole('button', { name: 'Fit to view' }));
      expect(within(pill).getByRole('button', { name: 'Fit to view' }).textContent).toBe('Fit');

      fireEvent.click(within(pill).getByRole('button', { name: 'Hide' }));
      await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenLastCalledWith('grid', 'cast_ada', 'asset_young_a', 'hidden'));
      fireEvent.click(within(pill).getByRole('button', { name: 'Cast' }));
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
      await screen.findByRole('heading', { name: 'Costumes' });
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

    it('compares the kept candidates in a large window, casting and hiding from either side', async () => {
      const resource = castCastingResource();
      resource.looks[0]!.rounds[0]!.candidates[2]!.status = 'candidate';
      vi.mocked(readCastCasting).mockResolvedValue(resource);
      vi.mocked(setCastingCandidateStatus).mockResolvedValue({} as never);
      vi.mocked(castLookCandidate).mockResolvedValue({} as never);

      render(<CastMemberCastingTab projectName='grid' castMemberId='cast_ada' />);
      fireEvent.click(await screen.findByRole('button', { name: 'Compare 3' }));
      const compare = await screen.findByRole('dialog', { name: 'Compare · Young' });
      loadRenderedImages();
      const first = within(compare).getByRole('region', { name: 'First candidate' });
      const second = within(compare).getByRole('region', { name: 'Second candidate' });
      expect(within(second).getByText('Cast', { selector: 'span' })).toBeTruthy();

      fireEvent.click(within(first).getByRole('button', { name: 'Cast' }));
      await waitFor(() => expect(castLookCandidate).toHaveBeenCalledWith('grid', 'cast_ada', 'look_young', 'asset_young_a'));
      await waitFor(() => expect(within(second).getByRole('button', { name: 'Hide' }).hasAttribute('disabled')).toBe(false));

      fireEvent.click(within(second).getByRole('button', { name: 'Hide' }));
      await waitFor(() => expect(setCastingCandidateStatus).toHaveBeenCalledWith('grid', 'cast_ada', 'asset_young_b', 'hidden'));
    });
  });
});

// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCastMemberCharacterArc } from '@/services/studio-continuity-api';
import { CastMemberArcTab } from './cast-member-arc-tab';
import { characterArcResource } from './character-arc-test-fixtures';

vi.mock('@/services/studio-continuity-api', () => ({
  readCastMemberCharacterArc: vi.fn(),
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  projectAssetFileUrl: vi.fn((projectName: string, assetFileId: string) => `/assets/${projectName}/${assetFileId}`),
}));

describe('CastMemberArcTab', () => {
  beforeEach(() => {
    vi.mocked(readCastMemberCharacterArc).mockReset();
  });

  it('shows the arc summary, the timeline and one card per turning point grouped by act', async () => {
    vi.mocked(readCastMemberCharacterArc).mockResolvedValue(characterArcResource());

    render(<CastMemberArcTab projectName='grid' castMemberId='cast_ada' onOpenCastMember={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByText('Grows')).toBeTruthy();
    expect(screen.getByText('Trusts only machines.')).toBeTruthy();
    expect(screen.getByText('False belief')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ada arc across the screenplay' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Act I', 'Act II', 'Act III']);
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Night shift',
      'Blackout',
      'Calls the apprentice',
    ]);
    expect(screen.getByText('Sc 2–3')).toBeTruthy();
    expect(screen.getByText('▼ turns toward “Works alone”')).toBeTruthy();
    expect(screen.getByText('▲ turns toward “Asks for help”')).toBeTruthy();
  });

  it('shows the character sheet on the card that names it', async () => {
    vi.mocked(readCastMemberCharacterArc).mockResolvedValue(characterArcResource());

    render(<CastMemberArcTab projectName='grid' castMemberId='cast_ada' onOpenCastMember={vi.fn()} />);

    const sheet = await screen.findByRole('img', { name: 'Ada — Night Shift' });
    expect(sheet.getAttribute('src')).toBe('/assets/grid/asset_sheet');
    expect(screen.getAllByRole('img', { name: 'Ada — Night Shift' })).toHaveLength(1);
  });

  it('links a shared arc to its owner and marks a stale arc', async () => {
    const onOpenCastMember = vi.fn();
    vi.mocked(readCastMemberCharacterArc).mockResolvedValue(characterArcResource({
      castMember: { id: 'cast_young_ada', name: 'Young Ada' },
      sharedWith: { ownerCastMemberId: 'cast_ada', ownerName: 'Ada' },
      freshness: 'needsRefresh',
      freshnessHelp: 'Screenplay changed since these arcs were written.',
    }));

    render(<CastMemberArcTab projectName='grid' castMemberId='cast_young_ada' onOpenCastMember={onOpenCastMember} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ada' }));
    expect(onOpenCastMember).toHaveBeenCalledWith('cast_ada');
    expect(screen.getByText('Needs refresh').getAttribute('title')).toBe('Screenplay changed since these arcs were written.');
  });

  it('hides the In scene row when no screenplay references exist', async () => {
    vi.mocked(readCastMemberCharacterArc).mockResolvedValue(characterArcResource({ presence: [] }));

    render(<CastMemberArcTab projectName='grid' castMemberId='cast_ada' onOpenCastMember={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Ada' });
    expect(screen.queryByText('IN SCENE')).toBeNull();
    expect(screen.queryByText('Speaks')).toBeNull();
  });

  it.each(['screenplay', 'screenplay:structure', 'screenplay-analysis', 'screenplay-analysis:analysis_next', 'surface:castMember:cast_ada'])('refreshes the arc after %s changes', async (resourceKey) => {
    const updated = characterArcResource({
      presence: [],
      structure: null,
      freshness: 'needsRefresh',
      freshnessHelp: 'Screenplay or analysis changed since these arcs were written.',
    });
    updated.scenes[3]!.productionNumber = '4A';
    vi.mocked(readCastMemberCharacterArc)
      .mockResolvedValueOnce(characterArcResource())
      .mockResolvedValueOnce(updated);
    render(<CastMemberArcTab projectName='grid' castMemberId='cast_ada' onOpenCastMember={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Ada' });
    expect(screen.getByText('STRUCTURE')).toBeTruthy();
    expect(screen.getByText('IN SCENE')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new CustomEvent('renku:studio-resource-changed', {
        detail: { projectName: 'grid', resourceKeys: [resourceKey] },
      }));
    });

    expect(await screen.findByText('Needs refresh')).toBeTruthy();
    expect(screen.getByText('4A')).toBeTruthy();
    expect(screen.queryByText('STRUCTURE')).toBeNull();
    expect(screen.queryByText('IN SCENE')).toBeNull();
    await waitFor(() => expect(readCastMemberCharacterArc).toHaveBeenCalledTimes(2));
  });

  it('ignores changes to other projects and unrelated Cast Members', async () => {
    vi.mocked(readCastMemberCharacterArc).mockResolvedValue(characterArcResource());
    render(<CastMemberArcTab projectName='grid' castMemberId='cast_ada' onOpenCastMember={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Ada' });

    await act(async () => {
      for (const detail of [
        { projectName: 'other', resourceKeys: ['screenplay'] },
        { projectName: 'grid', resourceKeys: ['surface:castMember:cast_other'] },
      ]) {
        window.dispatchEvent(new CustomEvent('renku:studio-resource-changed', { detail }));
      }
    });

    expect(readCastMemberCharacterArc).toHaveBeenCalledTimes(1);
  });
});

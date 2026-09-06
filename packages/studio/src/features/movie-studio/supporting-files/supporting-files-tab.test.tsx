// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRelativePath, ProjectSupportingFile } from '@gorenku/studio-core/client';
import { SupportingFilesTab } from './supporting-files-tab';
import * as api from '@/services/supporting-files';

vi.mock('@/services/supporting-files', () => ({
  readProjectSupportingFiles: vi.fn(), readSupportingFileInformation: vi.fn(),
  discardSupportingFile: vi.fn(), openSupportingFileFolder: vi.fn(),
  openSupportingFileTab: vi.fn(),
}));

const notes: ProjectSupportingFile = {
  asset: {
    id: 'notes', owner: { kind: 'project' }, localeId: null,
    type: 'screenplay_supporting_material', availability: 'ready', mediaKind: 'file',
    title: 'Research notes.md', oneLineSummary: null, origin: 'imported',
    referenceName: null, tags: [], generationProvenance: null, authoredFrom: null,
    files: [{ id: 'source', role: 'source', projectRelativePath: 'screenplay/Research notes.md' as ProjectRelativePath, mediaKind: 'file', mimeType: 'application/octet-stream', sizeBytes: 10, contentHash: null, width: null, height: null, durationSeconds: null }], createdAt: '2026-09-06T09:00:00Z', updatedAt: '2026-09-06T10:00:00Z',
  },
  sourceAssetFileId: 'source', deleteBlock: null,
};
const fdx: ProjectSupportingFile = {
  ...notes, asset: { ...notes.asset, id: 'fdx', title: 'Basilica.fdx', files: [{ ...notes.asset.files[0]!, projectRelativePath: 'screenplay/Basilica.fdx' as ProjectRelativePath }] },
  deleteBlock: { code: 'SCREENPLAY_FDX_SOURCE_PROTECTED', message: 'Retained screenplay source files cannot be deleted.' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.readProjectSupportingFiles).mockResolvedValue({ items: [notes, fdx], nextCursor: null });
  vi.mocked(api.readSupportingFileInformation).mockResolvedValue({
    supportingFile: notes, absolutePath: '/Projects/Basilica/screenplay/Research notes.md',
    folderActionLabel: 'Open in Finder',
  });
});
afterEach(cleanup);

describe('Supporting Files tab', () => {
  it('uses native image and video cards beside document cards with a shared frame', async () => {
    const files = ['research.pdf', 'notes.md', 'reference.jpg', 'reference.mp4'].map((title) => ({
      ...notes,
      asset: { ...notes.asset, id: title, title, files: [{ ...notes.asset.files[0]!, projectRelativePath: `screenplay/${title}` as ProjectRelativePath }] },
    }));
    vi.mocked(api.readProjectSupportingFiles).mockResolvedValue({ items: files, nextCursor: null });
    const { container } = render(<SupportingFilesTab projectName='basilica' />);
    await screen.findByRole('img', { name: 'reference.jpg' });
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('MD')).toBeTruthy();
    expect(container.querySelector('video')?.getAttribute('src')).toContain('reference.mp4/content');
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-media-card]'));
    expect(cards).toHaveLength(4);
    expect(new Set(cards.map((card) => card.style.aspectRatio)).size).toBe(1);
    expect(screen.getByRole('heading', { name: 'research.pdf' }).className).not.toContain('truncate');
  });

  it('isolates information and folder actions from file activation and protects FDX', async () => {
    render(<SupportingFilesTab projectName='basilica' />);
    await screen.findByRole('button', { name: 'Open Research notes.md' });
    expect(screen.queryByRole('button', { name: 'Move Basilica.fdx to Trash' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'File information: Research notes.md' }));
    await waitFor(() => expect(api.readSupportingFileInformation).toHaveBeenCalledWith('basilica', 'notes'));
    expect(screen.queryByText('File location')).toBeNull();
    expect(screen.getByText('Imported')).toBeTruthy();
    expect(screen.getByText('Last updated')).toBeTruthy();
    expect(api.openSupportingFileTab).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open In Folder' }));
    await waitFor(() => expect(api.openSupportingFileFolder).toHaveBeenCalledWith('basilica', 'notes'));
  });

  it('opens the source in a new tab through the card', async () => {
    render(<SupportingFilesTab projectName='basilica' />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Basilica.fdx' }));
    expect(api.openSupportingFileTab).toHaveBeenCalledWith('basilica', 'fdx');
  });

  it('retains existing cards when another page fails and retries that cursor', async () => {
    vi.mocked(api.readProjectSupportingFiles)
      .mockResolvedValueOnce({ items: [notes], nextCursor: 'next-page' })
      .mockRejectedValueOnce(new Error('Page unavailable'))
      .mockResolvedValueOnce({ items: [fdx], nextCursor: null });
    render(<SupportingFilesTab projectName='basilica' />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText('Page unavailable');
    expect(screen.getByRole('button', { name: 'Open Research notes.md' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Open Basilica.fdx' });
    expect(api.readProjectSupportingFiles).toHaveBeenLastCalledWith('basilica', 'next-page');
  });

  it('refreshes on project Asset events', async () => {
    render(<SupportingFilesTab projectName='basilica' />);
    await screen.findByRole('button', { name: 'Open Basilica.fdx' });
    act(() => {
      window.dispatchEvent(new CustomEvent('renku:studio-resource-changed', {
        detail: { projectName: 'basilica', resourceKeys: ['surface:project:assets'] },
      }));
    });
    await waitFor(() => expect(api.readProjectSupportingFiles).toHaveBeenCalledTimes(2));
  });

  it('does not delete on cancellation and retains the card when deletion fails', async () => {
    vi.mocked(api.discardSupportingFile).mockRejectedValue(new Error('File could not be discarded'));
    render(<SupportingFilesTab projectName='basilica' />);
    fireEvent.click(await screen.findByRole('button', { name: 'Move Research notes.md to Trash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.discardSupportingFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Research notes.md to Trash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    await screen.findByText('File could not be discarded');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Open Research notes.md' })).toBeTruthy();
    expect(api.openSupportingFileTab).not.toHaveBeenCalled();
  });

  it('removes a discarded card when the following refresh fails', async () => {
    vi.mocked(api.readProjectSupportingFiles)
      .mockResolvedValueOnce({ items: [notes, fdx], nextCursor: null })
      .mockRejectedValueOnce(new Error('Refresh unavailable'));
    vi.mocked(api.discardSupportingFile).mockResolvedValue({
      valid: true,
      warnings: [],
      project: { id: 'project_1', projectName: 'basilica' },
      changes: [{ type: 'asset.discarded', assetId: notes.asset.id }],
      recovery: {
        operationId: 'trash_operation_1',
        trashItemIds: ['trash_item_1'],
        restorable: true,
        restoreCommand: { name: 'trash.restore', trashItemId: 'trash_item_1' },
      },
      resourceKeys: ['surface:project:assets', 'trash:list'],
    });
    render(<SupportingFilesTab projectName='basilica' />);
    fireEvent.click(await screen.findByRole('button', { name: 'Move Research notes.md to Trash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    await screen.findByText('Refresh unavailable');
    expect(screen.queryByRole('button', { name: 'Open Research notes.md' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Basilica.fdx' })).toBeTruthy();
  });

  it('ignores a late response from a previous Project', async () => {
    let finishOldRequest!: (page: { items: ProjectSupportingFile[]; nextCursor: null }) => void;
    vi.mocked(api.readProjectSupportingFiles)
      .mockReturnValueOnce(new Promise((resolve) => { finishOldRequest = resolve; }))
      .mockResolvedValueOnce({ items: [fdx], nextCursor: null });
    const { rerender } = render(<SupportingFilesTab key='old' projectName='old' />);
    rerender(<SupportingFilesTab key='new' projectName='new' />);
    await screen.findByRole('button', { name: 'Open Basilica.fdx' });
    await act(async () => { finishOldRequest({ items: [notes], nextCursor: null }); });
    expect(screen.queryByRole('button', { name: 'Open Research notes.md' })).toBeNull();
  });

});

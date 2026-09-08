// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cleanProjectTemporaryFiles } from '@/services/studio-projects-api';
import { ProjectTemporaryFilesSection } from './project-temporary-files-section';

vi.mock('@/services/studio-projects-api', () => ({ cleanProjectTemporaryFiles: vi.fn() }));

describe('Project temporary-file action', () => {
  it('requires confirmation, supports cancellation, and reports the result', async () => {
    vi.mocked(cleanProjectTemporaryFiles).mockResolvedValue({ removedFiles: 12, removedBytes: 1048576 });
    render(<ProjectTemporaryFilesSection projectName='basilica' />);
    fireEvent.click(screen.getByRole('button', { name: 'Clean up temporary files' }));
    expect(cleanProjectTemporaryFiles).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cleanProjectTemporaryFiles).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clean up temporary files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clean up' }));
    await waitFor(() => expect(cleanProjectTemporaryFiles).toHaveBeenCalledWith('basilica'));
    expect((await screen.findByRole('status')).textContent).toBe('Removed 12 temporary files (1.0 MB).');
  });
});

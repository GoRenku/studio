// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioApiError } from '@/services/studio-api-errors';
import { CreateProjectDialog } from './create-project-dialog';

const createProjectMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/studio-projects-api', () => ({
  createProject: createProjectMock,
}));

describe('CreateProjectDialog', () => {
  afterEach(() => {
    cleanup();
    createProjectMock.mockReset();
  });

  it('opens with title focus and suggests the Folder name and location', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    const title = screen.getByLabelText('Project title *');
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect((title as HTMLInputElement).required).toBe(true);
    fireEvent.change(title, { target: { value: "L'été à Cádiz" } });

    const projectName = screen.getByLabelText('Folder name *') as HTMLInputElement;
    expect(projectName.required).toBe(true);
    expect(projectName.value).toBe('l-ete-a-cadiz');
    expect(screen.getByText('/Users/test/renku-movies/l-ete-a-cadiz')).toBeTruthy();
  });

  it('stops synchronizing after the Folder name is edited manually', () => {
    renderDialog();
    openDialog();

    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'The Glass Harbor' },
    });
    fireEvent.change(screen.getByLabelText('Folder name *'), {
      target: { value: 'glass-harbor-rewrite' },
    });
    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'A Different Title' },
    });

    expect((screen.getByLabelText('Folder name *') as HTMLInputElement).value)
      .toBe('glass-harbor-rewrite');
  });

  it('submits only the shared creation request, closes, and selects the Project', async () => {
    createProjectMock.mockResolvedValue({ projectName: 'the-glass-harbor' });
    const onCreated = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateProjectDialog
        storageRoot='/Users/test/renku-movies'
        onCreated={onCreated}
      />
    );
    openDialog();
    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'The Glass Harbor' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith({
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      });
      expect(onCreated).toHaveBeenCalledWith('the-glass-harbor');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the draft and projects a Core field issue under Folder name', async () => {
    createProjectMock.mockRejectedValue(
      new StudioApiError(
        'Project folder already exists.',
        'PROJECT_DATA024',
        400,
        [
          {
            code: 'PROJECT_DATA024',
            message: 'Folder name is already in use.',
            severity: 'error',
            location: { path: ['projectName'] },
          },
        ],
        'Choose another Folder name.'
      )
    );
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'The Glass Harbor' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Folder name is already in use.')).toBeTruthy();
    expect((screen.getByLabelText('Project title *') as HTMLInputElement).value)
      .toBe('The Glass Harbor');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows unexpected errors globally and resets the draft on Cancel', async () => {
    createProjectMock.mockRejectedValue(new Error('Storage is unavailable.'));
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'The Glass Harbor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Storage is unavailable.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    openDialog();

    expect((screen.getByLabelText('Project title *') as HTMLInputElement).value)
      .toBe('');
    expect((screen.getByLabelText('Folder name *') as HTMLInputElement).value)
      .toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables dismissal and duplicate submission while creating', async () => {
    createProjectMock.mockImplementation(() => new Promise(() => {}));
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'The Glass Harbor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect((await screen.findByRole('button', { name: 'Creating…' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(createProjectMock).toHaveBeenCalledTimes(1);
  });
});

function renderDialog() {
  return render(
    <CreateProjectDialog
      storageRoot='/Users/test/renku-movies'
      onCreated={vi.fn().mockResolvedValue(undefined)}
    />
  );
}

function openDialog(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
}

// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/ui/tooltip';
import { ProjectLibraryCard } from './project-library-card';

describe('ProjectLibraryCard', () => {
  it('requires the Project name rather than its title before deletion', async () => {
    const onDeleteProject = vi.fn().mockResolvedValue(undefined);
    const onSelectProject = vi.fn().mockResolvedValue(undefined);
    render(
      <TooltipProvider>
        <ProjectLibraryCard
          project={projectSummary()}
          isSelectingProject={false}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
        />
      </TooltipProvider>
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete the-glass-harbor Project',
      })
    );
    expect(onSelectProject).not.toHaveBeenCalled();
    expect(screen.getByText('Type the-glass-harbor to confirm.')).not.toBeNull();

    const deleteButton = screen.getByRole('button', {
      name: 'Delete Project',
    });
    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'The Glass Harbor' },
    });
    expect(deleteButton.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'the-glass-harbor' },
    });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(onDeleteProject).toHaveBeenCalledWith(
        'the-glass-harbor',
        'the-glass-harbor'
      );
    });
    expect(onSelectProject).not.toHaveBeenCalled();
  });
});

function projectSummary() {
  return {
    projectName: 'the-glass-harbor',
    title: 'The Glass Harbor',
    folderPath: '/tmp/renku/the-glass-harbor',
    coverImage: null,
    coverUrl: null,
    logline: 'A harbor keeps its last secret.',
    counts: {
      languages: 1,
      castMembers: 0,
      locations: 0,
      props: 0,
      acts: 0,
      sequences: 0,
      scenes: 0,
    },
    validationError: null,
  };
}

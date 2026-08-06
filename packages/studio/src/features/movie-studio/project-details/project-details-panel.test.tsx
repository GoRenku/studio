// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDetailsPanel } from './project-details-panel';

vi.mock('../project-information/project-information-panel', () => ({
  ProjectInformationPanel: () => <div data-testid='project-information'>Project Information form</div>,
}));
vi.mock('./project-settings-panel', () => ({
  ProjectSettingsPanel: () => <div data-testid='project-settings'>Project Settings form</div>,
}));

describe('ProjectDetailsPanel', () => {
  it('selects Project Info first and keeps both tab contents mounted', () => {
    render(
      <ProjectDetailsPanel
        project={project()}
        onProjectChange={() => undefined}
        onSaveStatusChange={() => undefined}
      />
    );

    const projectInfoTab = screen.getByRole('tab', { name: 'Project Info' });
    const settingsTab = screen.getByRole('tab', { name: 'Settings' });
    expect(projectInfoTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('project-information')).toBeTruthy();
    expect(screen.getByTestId('project-settings')).toBeTruthy();

    fireEvent.mouseDown(settingsTab, { button: 0 });
    fireEvent.click(settingsTab);
    expect(settingsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('project-information')).toBeTruthy();
    expect(screen.getByTestId('project-settings')).toBeTruthy();
  });
});

function project() {
  return {
    project: {
      id: 'project_test',
      projectName: 'constantinople',
      title: 'Constantinople',
      aspectRatio: '16:9',
      counts: {
        languages: 1,
        castMembers: 0,
        locations: 0,
        props: 0,
        acts: 0,
        sequences: 0,
        scenes: 0,
      },
    },
    languages: [],
    navigation: {
      cast: { items: [], nextCursor: null },
      locations: { items: [], nextCursor: null },
      props: { items: [], nextCursor: null },
      screenplay: {
        screenplay: { opening: [], sections: [], scenes: [], references: [] },
        structure: [],
      },
    },
    coverUrl: null,
    storageRoot: '/tmp/projects',
  } as never;
}

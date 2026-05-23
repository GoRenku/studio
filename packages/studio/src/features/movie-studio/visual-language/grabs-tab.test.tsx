// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrabsTab } from './grabs-tab';

describe('GrabsTab', () => {
  it('accepts multiple image files from the dropzone input', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <GrabsTab
        projectName='constantinople'
        resource={{
          folder: {
            id: 'inspiration_folder_test0001',
            name: 'Reference',
            projectRelativePath: 'visual-language/inspiration/reference' as never,
          },
          images: [],
          analysis: null,
        }}
        onUpload={onUpload}
        onDeleteImage={vi.fn()}
      />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement | null;

    expect(input).not.toBeNull();
    expect(input?.multiple).toBe(true);

    const files = [
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['second'], 'second.png', { type: 'image/png' }),
    ];
    fireEvent.change(input!, { target: { files } });

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(files));
  });

  it('accepts dropped image files across the Grabs tab', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(
      <GrabsTab
        projectName='constantinople'
        resource={{
          folder: {
            id: 'inspiration_folder_test0001',
            name: 'Reference',
            projectRelativePath: 'visual-language/inspiration/reference' as never,
          },
          images: [],
          analysis: null,
        }}
        onUpload={onUpload}
        onDeleteImage={vi.fn()}
      />
    );

    const dropTarget = screen.getByRole('region', {
      name: 'Inspiration grabs drop target',
    });
    const files = [
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
      new File(['second'], 'second.png', { type: 'image/png' }),
    ];

    fireEvent.dragEnter(dropTarget, {
      dataTransfer: { types: ['Files'], files },
    });
    expect(dropTarget.className).toContain('border-primary');

    fireEvent.drop(dropTarget, {
      dataTransfer: { files },
    });

    await waitFor(() =>
      expect(onUpload).toHaveBeenCalledWith([files[0], files[2]])
    );
  });
});

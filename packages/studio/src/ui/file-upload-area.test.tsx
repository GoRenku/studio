// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FileUploadArea } from './file-upload-area';

afterEach(cleanup);

it('shares busy handling between drop and picker and makes failures retryable', async () => {
  let reject!: (error: Error) => void;
  const onUpload = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue(undefined);
  render(<FileUploadArea label='Files' title='Upload' onUpload={onUpload}>{(card) => card}</FileUploadArea>);
  const region = screen.getByRole('region', { name: 'Files' });
  const files = [new File(['source'], 'notes.pdf')];
  fireEvent.drop(region, { dataTransfer: { files } });
  expect((screen.getByLabelText('Uploading…') as HTMLInputElement).disabled).toBe(true);
  fireEvent.drop(region, { dataTransfer: { files } });
  expect(onUpload).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Upload failed')));
  expect(screen.getByRole('alert').textContent).toBe('Upload failed');
  fireEvent.change(screen.getByLabelText('Upload'), { target: { files } });
  await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});

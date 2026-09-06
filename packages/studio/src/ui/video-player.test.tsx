// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { VideoPlayer } from './video-player';

vi.mock('./slider', () => ({ Slider: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('opens the whole player fullscreen and follows browser exit events', async () => {
  const request = vi.fn().mockResolvedValue(undefined);
  const exit = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: request });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  const { container } = render(<VideoPlayer src='/clip.mp4' title='Clip' />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
  expect(request).toHaveBeenCalled();
  expect(request.mock.contexts[0]).toBe(container.firstChild);
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: container.firstChild });
  act(() => { document.dispatchEvent(new Event('fullscreenchange')); });
  fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
  expect(exit).toHaveBeenCalled();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  act(() => { document.dispatchEvent(new Event('fullscreenchange')); });
  expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeTruthy();
});

it('reports a rejected fullscreen request', async () => {
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true, value: vi.fn().mockRejectedValue(new Error('Denied')),
  });
  render(<VideoPlayer src='/clip.mp4' title='Clip' />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Fullscreen could not'));
});

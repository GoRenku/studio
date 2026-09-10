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

it('ignores an ended event queued before a newer playback request', () => {
  const onEnded = vi.fn();
  render(<VideoPlayer src='/clip.mp4' title='Clip' onEnded={onEnded} />);
  const video = screen.getByTitle('Clip');
  Object.defineProperty(video, 'ended', { configurable: true, value: false });
  fireEvent.ended(video);
  expect(onEnded).not.toHaveBeenCalled();
  Object.defineProperty(video, 'ended', { configurable: true, value: true });
  fireEvent.ended(video);
  expect(onEnded).toHaveBeenCalledOnce();
});

it('uses shared playback state for fullscreen controls after the local video ends', () => {
  const onPlaybackRequest = vi.fn();
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const { container, rerender } = render(<VideoPlayer src='/take.mp4' title='Generation' controls='external' onPlaybackRequest={onPlaybackRequest} playing />);
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: container.firstChild });
  act(() => { document.dispatchEvent(new Event('fullscreenchange')); });
  const video = screen.getByTitle('Generation');
  Object.defineProperty(video, 'ended', { configurable: true, value: true });
  fireEvent.ended(video);
  const pauseButton = screen.getByRole('button', { name: 'Pause shot' });
  expect(pauseButton.querySelector('.lucide-pause')).toBeTruthy();
  fireEvent.click(pauseButton);
  expect(onPlaybackRequest).toHaveBeenCalledOnce();
  rerender(<VideoPlayer src='/take.mp4' title='Generation' controls='external' onPlaybackRequest={onPlaybackRequest} playing={false} />);
  const playButton = screen.getByRole('button', { name: 'Play shot' });
  expect(playButton.querySelector('.lucide-play')).toBeTruthy();
  fireEvent.click(playButton);
  expect(onPlaybackRequest).toHaveBeenCalledTimes(2);
  expect(play).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
});

it('uses local media state when playback is not delegated', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  render(<VideoPlayer src='/clip.mp4' title='Clip' />);
  fireEvent.click(screen.getByRole('button', { name: 'Play shot' }));
  expect(play).toHaveBeenCalledOnce();
  const video = screen.getByTitle('Clip');
  Object.defineProperty(video, 'paused', { configurable: true, value: false });
  fireEvent.play(video);
  fireEvent.click(screen.getByRole('button', { name: 'Pause shot' }));
  expect(pause).toHaveBeenCalledOnce();
  Object.defineProperty(video, 'paused', { configurable: true, value: true });
  fireEvent.pause(video);
  expect(screen.getByRole('button', { name: 'Play shot' })).toBeTruthy();
});

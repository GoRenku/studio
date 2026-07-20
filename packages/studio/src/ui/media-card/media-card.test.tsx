// @vitest-environment jsdom
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaCardPresentation } from './media-card-contract';
import { MediaCard } from './media-card';

describe('MediaCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('supports cover, contain, and every current frame shape', () => {
    const { container, rerender } = render(
      <MediaCard
        media={image('cover')}
        frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
        presentation={{ kind: 'overlay' }}
      />
    );

    expect(screen.getByRole('img', { name: 'cover' }).className).toContain(
      'object-cover'
    );
    expect(card(container).style.aspectRatio).toBe(String(16 / 9));

    rerender(
      <MediaCard
        media={{ ...image('contain'), fit: 'contain' }}
        frame={{ kind: 'intrinsic' }}
        presentation={{ kind: 'evidence' }}
      />
    );
    expect(hasClasses(screen.getByRole('img', { name: 'contain' }), [
      'h-auto',
      'object-contain',
    ])).toBe(true);

    rerender(
      <MediaCard
        media={image('minimum')}
        frame={{ kind: 'minimum-height', minimumHeightPx: 240 }}
        presentation={{ kind: 'evidence' }}
      />
    );
    expect(visual(container).style.minHeight).toBe('240px');
  });

  it('detects an image ratio at runtime when requested', () => {
    const { container } = render(
      <MediaCard
        media={image('detected')}
        frame={{
          kind: 'ratio',
          aspectRatio: 1,
          detectFromImage: true,
        }}
        presentation={{ kind: 'overlay' }}
      />
    );
    const imageElement = screen.getByRole('img', { name: 'detected' });
    Object.defineProperty(imageElement, 'naturalWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(imageElement, 'naturalHeight', {
      configurable: true,
      value: 800,
    });

    fireEvent.load(imageElement);

    expect(card(container).style.aspectRatio).toBe('1.5');
  });

  it.each([
    [{ kind: 'overlay', copy: { title: 'Overlay title' } }, 'Overlay title'],
    [
      { kind: 'thumbnail', footer: { title: 'Thumbnail title' } },
      'Thumbnail title',
    ],
    [
      {
        kind: 'evidence',
        copy: { kind: 'label', label: 'Evidence label' },
      },
      'Evidence label',
    ],
    [
      {
        kind: 'summary',
        body: { title: 'Summary title', metrics: [{ label: 'Scenes', value: 4 }] },
      },
      'Summary title',
    ],
  ] satisfies Array<[MediaCardPresentation, string]>)(
    'renders the %s presentation',
    (presentation, expectedCopy) => {
      render(
        <MediaCard
          media={image(expectedCopy)}
          frame={{ kind: 'ratio', aspectRatio: 1 }}
          presentation={presentation}
        />
      );

      expect(screen.getByText(expectedCopy)).not.toBeNull();
    }
  );

  it('renders a fixed four-cell mosaic in contract order and leaves empty cells quiet', () => {
    const { container } = render(
      <MediaCard
        media={{
          kind: 'mosaic',
          cells: [
            { id: 'one', src: '/one.jpg', alt: 'One' },
            { id: 'two', alt: 'Two' },
            { id: 'three', src: '/three.jpg', alt: 'Three' },
            { id: 'four', src: '/four.jpg', alt: 'Four' },
          ],
        }}
        frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
        presentation={{ kind: 'thumbnail' }}
      />
    );

    expect(
      Array.from(container.querySelectorAll('[data-media-card-visual] > div > div'))
    ).toHaveLength(4);
    expect(screen.getAllByRole('img').map((element) => element.getAttribute('alt')))
      .toEqual(['One', 'Three', 'Four']);
    expect(screen.queryByRole('img', { name: 'Two' })).toBeNull();
  });

  it('renders the three bounded empty states', () => {
    const { rerender } = render(
      <MediaCard
        media={null}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'overlay' }}
        emptyState={{ kind: 'image' }}
      />
    );
    expect(
      document.querySelector('[data-media-card-empty-state="image"]')
    ).not.toBeNull();

    rerender(
      <MediaCard
        media={null}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'overlay' }}
        emptyState={{ kind: 'film' }}
      />
    );
    expect(
      document.querySelector('[data-media-card-empty-state="film"]')
    ).not.toBeNull();

    rerender(
      <MediaCard
        media={null}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'overlay' }}
        emptyState={{ kind: 'waveform' }}
      />
    );
    expect(screen.getByTestId('voice-over-profile-placeholder')).not.toBeNull();
  });

  it('keeps activation behind meaningful sibling controls without nested buttons', async () => {
    const onActivate = vi.fn();
    const onToggle = vi.fn();
    const onInspect = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <MediaCard
        media={image('Card')}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'overlay' }}
        activation={{ label: 'Open card preview', onActivate }}
        selection={{
          selected: false,
          selectedLabel: 'Remove reference',
          unselectedLabel: 'Select reference',
          onToggle,
        }}
        inspectionAction={{ label: 'View generation request', onInspect }}
        deleteAction={{
          label: 'Delete image',
          confirmationTitle: 'Delete this image?',
          confirmationMessage: 'This cannot be undone.',
          onDelete,
        }}
      />
    );

    expect(container.querySelector('button button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open card preview' }));
    expect(onActivate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Select reference' }));
    fireEvent.click(screen.getByRole('button', { name: 'View generation request' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }));
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByText('Delete this image?')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('places persistent selection and Inspection lower-right and delete top-right', () => {
    const { container } = render(
      <MediaCard
        media={image('Actions')}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'overlay' }}
        selection={{
          selected: true,
          selectedLabel: 'Remove reference',
          unselectedLabel: 'Select reference',
          onToggle: vi.fn(),
        }}
        inspectionAction={{ label: 'View generation request', onInspect: vi.fn() }}
        deleteAction={{
          label: 'Delete image',
          confirmationTitle: 'Delete?',
          confirmationMessage: 'Confirm.',
          onDelete: vi.fn().mockResolvedValue(undefined),
        }}
      />
    );

    const lowerActions = container.querySelector(
      '[data-media-card-lower-actions]'
    );
    expect(hasClasses(lowerActions, ['bottom-2', 'right-2'])).toBe(true);
    expect(
      Array.from(lowerActions?.querySelectorAll('button') ?? []).map((button) =>
        button.getAttribute('aria-label')
      )
    ).toEqual(['Remove reference', 'View generation request']);
    expect(
      screen
        .getByRole('button', { name: 'Remove reference' })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      hasClasses(
        container.querySelector('[data-media-card-delete-action]'),
        ['right-2', 'top-2']
      )
    ).toBe(true);
  });

  it('prevents disabled activation from invoking its callback', () => {
    const onActivate = vi.fn();
    render(
      <MediaCard
        media={image('Disabled')}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'overlay' }}
        activation={{
          label: 'Open disabled card',
          disabled: true,
          onActivate,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open disabled card' }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('plays hover video only while active and preserves still playback', async () => {
    const play = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue();
    const pause = vi
      .spyOn(window.HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});
    const { container, rerender } = render(
      <MediaCard
        media={{
          kind: 'video',
          src: '/preview.mp4',
          title: 'Hover preview',
          playback: 'hover-muted',
        }}
        frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
        presentation={{ kind: 'thumbnail' }}
      />
    );
    const card = container.querySelector('[data-media-card]');
    const video = screen.getByTitle('Hover preview');
    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: false,
    });

    fireEvent.pointerEnter(card!);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    fireEvent.pointerLeave(card!);
    expect(pause).toHaveBeenCalledTimes(1);

    play.mockClear();
    rerender(
      <MediaCard
        media={{
          kind: 'video',
          src: '/still.mp4',
          title: 'Still preview',
          playback: 'still',
        }}
        frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
        presentation={{ kind: 'thumbnail' }}
      />
    );
    fireEvent.pointerEnter(container.querySelector('[data-media-card]')!);
    expect(play).not.toHaveBeenCalled();
  });

  it('uses the Shot Design poster, loop, and idle desaturation treatment', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(
      () => {}
    );
    const { container } = render(
      <MediaCard
        media={{
          kind: 'video',
          src: '/motion.mp4',
          posterSrc: '/motion.jpg',
          title: 'Motion option',
          playback: 'hover-muted-loop',
        }}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'thumbnail', footer: { title: 'Push in' } }}
        selected={false}
      />
    );

    const poster = container.querySelector('img');
    const video = screen.getByTitle('Motion option');
    expect(poster?.getAttribute('src')).toBe('/motion.jpg');
    expect(hasClasses(poster, ['grayscale', 'group-hover:grayscale-0'])).toBe(
      true
    );
    expect(video.hasAttribute('loop')).toBe(true);
    expect(video.className).toContain('opacity-0');

    fireEvent.pointerEnter(container.querySelector('[data-media-card]')!);
    await waitFor(() => expect(video.className).toContain('opacity-100'));
  });

  it('restores desaturated option images on hover or selection', () => {
    const { rerender } = render(
      <MediaCard
        media={{
          ...image('Composition option'),
          effect: 'desaturate-until-hover-or-selected',
        }}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'thumbnail', footer: { title: 'Wide' } }}
        selected={false}
      />
    );
    expect(
      hasClasses(screen.getByRole('img'), [
        'grayscale',
        'group-hover:grayscale-0',
      ])
    ).toBe(true);

    rerender(
      <MediaCard
        media={{
          ...image('Composition option'),
          effect: 'desaturate-until-hover-or-selected',
        }}
        frame={{ kind: 'ratio', aspectRatio: 1 }}
        presentation={{ kind: 'thumbnail', footer: { title: 'Wide' } }}
        selected
      />
    );
    expect(screen.getByRole('img').classList.contains('grayscale')).toBe(false);
  });
});

function image(alt: string) {
  return {
    kind: 'image' as const,
    src: `/${alt}.jpg`,
    alt,
    fit: 'cover' as const,
    effect: 'none' as const,
  };
}

function visual(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-media-card-visual]');
  if (!element) {
    throw new Error('Expected MediaCard visual');
  }
  return element;
}

function card(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-media-card]');
  if (!element) {
    throw new Error('Expected MediaCard');
  }
  return element;
}

function hasClasses(
  element: Element | null,
  classNames: string[]
): boolean {
  return Boolean(
    element && classNames.every((className) => element.classList.contains(className))
  );
}

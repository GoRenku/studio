// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Button } from './button';
import { ImagePreviewDialog } from './image-preview-dialog';
import { loadRenderedImages, stubImageZoomLayout } from './testing/image-zoom-layout';

let restoreLayout: () => void;
beforeEach(() => { restoreLayout = stubImageZoomLayout({ width: 800, height: 600 }, { width: 1600, height: 1200 }); });
afterEach(() => { cleanup(); restoreLayout(); });

const images = [
  { src: '/a.png', alt: 'First', title: 'First' },
  { src: '/b.png', alt: 'Second', title: 'Second' },
];

function renderPreview(props: Partial<React.ComponentProps<typeof ImagePreviewDialog>> = {}) {
  const result = render(<ImagePreviewDialog images={images} currentIndex={0} onOpenChange={() => {}} {...props} />);
  loadRenderedImages();
  return result;
}

const fitButton = () => screen.getByRole('button', { name: 'Fit to view' });
const shownImage = () => screen.getByRole('img', { name: 'First' });

describe('ImagePreviewDialog zoom', () => {
  it('zooms with the buttons and goes back to fit from the zoom readout', () => {
    renderPreview();
    expect(fitButton().textContent).toBe('Fit');
    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(fitButton().textContent).toBe('75%');
    expect(shownImage().style.transform).toBe('translate(-200px, -150px) scale(0.75)');

    fireEvent.click(screen.getByRole('button', { name: 'Actual pixels' }));
    expect(fitButton().textContent).toBe('100%');

    fireEvent.click(fitButton());
    expect(fitButton().textContent).toBe('Fit');
    expect(shownImage().style.transform).toBe('translate(0px, 0px) scale(0.5)');
  });

  it('zooms with the wheel and keys, and toggles fit on double-click', () => {
    renderPreview();
    const stage = shownImage().parentElement!;
    fireEvent.wheel(stage, { deltaY: -200, clientX: 400, clientY: 300 });
    expect(fitButton().textContent).not.toBe('Fit');

    fireEvent.keyDown(window, { key: '0' });
    expect(fitButton().textContent).toBe('Fit');
    fireEvent.keyDown(window, { key: '+' });
    expect(fitButton().textContent).toBe('75%');
    fireEvent.keyDown(window, { key: '1' });
    expect(fitButton().textContent).toBe('100%');

    fireEvent.doubleClick(stage, { clientX: 400, clientY: 300 });
    expect(fitButton().textContent).toBe('Fit');
    fireEvent.doubleClick(stage, { clientX: 400, clientY: 300 });
    expect(fitButton().textContent).toBe('125%');
  });

  it('drags to pan while zoomed', () => {
    renderPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Actual pixels' }));
    const stage = shownImage().parentElement!;
    expect(shownImage().style.transform).toBe('translate(-400px, -300px) scale(1)');
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 160, clientY: 120 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    expect(shownImage().style.transform).toBe('translate(-340px, -280px) scale(1)');
  });

  it('opens every image fitted when stepping to the next one', () => {
    let index = 0;
    const { rerender } = renderPreview({ onCurrentIndexChange: (next) => { index = next; } });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show next image' }));
    rerender(<ImagePreviewDialog images={images} currentIndex={index} onCurrentIndexChange={() => {}} onOpenChange={() => {}} />);
    loadRenderedImages();
    expect(screen.getByRole('img', { name: 'Second' })).toBeTruthy();
    expect(fitButton().textContent).toBe('Fit');
  });

  it('puts the caller actions in the zoom pill and keeps Close alone in the corner', () => {
    renderPreview({ actions: <Button type='button'>Pick</Button> });
    const pill = screen.getByRole('toolbar', { name: 'Zoom' });
    expect(within(pill).getByRole('button', { name: 'Pick' })).toBeTruthy();
    const close = screen.getByRole('button', { name: 'Close image preview' });
    expect(within(close.parentElement!).getAllByRole('button')).toEqual([close]);
  });

  it('leaves zoom out when the screen switches it off and shows the caller actions', () => {
    renderPreview({ zoomable: false, actions: <Button type='button'>Pick</Button> });
    expect(screen.queryByRole('toolbar', { name: 'Zoom' })).toBeNull();
    expect(shownImage().parentElement!.getAttribute('aria-roledescription')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pick' })).toBeTruthy();
  });
});

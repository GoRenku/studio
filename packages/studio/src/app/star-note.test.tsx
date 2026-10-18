// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { offerStarNote } from './star-note';

const requestStarNoteOfferMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/star-note-api', () => ({ requestStarNoteOffer: requestStarNoteOfferMock }));
vi.mock('sonner', () => ({ toast: toastMock }));

describe('offerStarNote', () => {
  afterEach(() => {
    requestStarNoteOfferMock.mockReset();
    toastMock.mockReset();
  });

  it('shows a lasting, closable note with a GitHub link when Core offers it', async () => {
    requestStarNoteOfferMock.mockResolvedValue({ show: true });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    await expect(offerStarNote('night-market')).resolves.toBe(true);

    expect(requestStarNoteOfferMock).toHaveBeenCalledWith('night-market');
    const [title, options] = toastMock.mock.calls[0]!;
    expect(title).toBe('Renku is free and open source');
    expect(options).toMatchObject({
      description: 'A star on GitHub helps other filmmakers find it.',
      duration: Infinity,
      closeButton: true,
      action: { label: 'Star on GitHub' },
    });
    options.action.onClick();
    expect(open).toHaveBeenCalledWith('https://github.com/GoRenku/studio', '_blank', 'noopener,noreferrer');
  });

  it.each([
    ['Core declines', () => requestStarNoteOfferMock.mockResolvedValue({ show: false })],
    ['the request fails', () => requestStarNoteOfferMock.mockRejectedValue(new Error('offline'))],
  ])('shows nothing when %s', async (_label, arrange) => {
    arrange();

    await expect(offerStarNote('night-market')).resolves.toBe(false);

    expect(toastMock).not.toHaveBeenCalled();
  });
});

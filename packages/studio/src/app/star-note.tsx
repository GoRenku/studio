import { toast } from 'sonner';
import { requestStarNoteOffer } from '@/services/star-note-api';

const STUDIO_REPOSITORY_URL = 'https://github.com/GoRenku/studio';

/**
 * Asks Core whether to show the one-time star note for this project and shows
 * it when Core says so. Failures show nothing.
 */
export async function offerStarNote(projectName: string): Promise<boolean> {
  try {
    const offer = await requestStarNoteOffer(projectName);
    if (!offer.show) {
      return false;
    }
  } catch {
    return false;
  }
  toast('Renku is free and open source', {
    description: 'A star on GitHub helps other filmmakers find it.',
    duration: Infinity,
    closeButton: true,
    action: {
      label: 'Star on GitHub',
      onClick: () => {
        window.open(STUDIO_REPOSITORY_URL, '_blank', 'noopener,noreferrer');
      },
    },
  });
  return true;
}

import { createContext, useContext } from 'react';
import type { ImageRevisionTarget } from '@gorenku/studio-core/client';

export interface OpenImageRevisionInput {
  projectName: string;
  target: ImageRevisionTarget;
}

export interface ImageRevisionDialogContextValue {
  openImageRevision: (input: OpenImageRevisionInput) => void;
}

export const ImageRevisionDialogContext =
  createContext<ImageRevisionDialogContextValue | null>(null);

export function useImageRevisionDialog(): ImageRevisionDialogContextValue {
  const context = useContext(ImageRevisionDialogContext);
  if (!context) {
    throw new Error(
      'useImageRevisionDialog must be used within ImageRevisionDialogProvider.',
    );
  }
  return context;
}

import type { ReactNode } from 'react';
import { VisualLanguageImageGrid } from './visual-language-image-grid';

export function GrabGrid({ children }: { children: ReactNode }) {
  return <VisualLanguageImageGrid>{children}</VisualLanguageImageGrid>;
}

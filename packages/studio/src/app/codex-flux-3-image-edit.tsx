import { createRoot } from 'react-dom/client';
import { Flux3ImageEditPanel } from '@/features/codex-image-edit/flux-3/flux-3-image-edit-panel';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<Flux3ImageEditPanel />);

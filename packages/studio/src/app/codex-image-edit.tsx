import { createRoot } from 'react-dom/client';
import { ImageEditPanel } from '@/features/codex-image-edit/image-edit-panel';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<ImageEditPanel />);

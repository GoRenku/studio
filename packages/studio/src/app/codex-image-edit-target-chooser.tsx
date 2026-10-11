import { createRoot } from 'react-dom/client';
import { ImageEditTargetChooser } from '@/features/codex-image-edit/target-chooser/image-edit-target-chooser';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<ImageEditTargetChooser />);

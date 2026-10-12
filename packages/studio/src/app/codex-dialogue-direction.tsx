import { createRoot } from 'react-dom/client';
import { DialogueDirectionPanel } from '@/features/codex-dialogue-direction/dialogue-direction-panel';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<DialogueDirectionPanel />);

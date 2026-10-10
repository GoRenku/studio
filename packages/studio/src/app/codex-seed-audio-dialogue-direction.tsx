import { createRoot } from 'react-dom/client';
import { SeedAudioDirectionPanel } from '@/features/codex-dialogue-direction/seed-audio/seed-audio-direction-panel';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<SeedAudioDirectionPanel />);

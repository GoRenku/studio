import { createRoot } from 'react-dom/client';
import { CastingBoardPanel } from '@/features/codex-casting-board/casting-board-panel';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<CastingBoardPanel />);

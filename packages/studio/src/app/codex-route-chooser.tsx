import { createRoot } from 'react-dom/client';
import { RouteChooser } from '@/features/codex-route-chooser/route-chooser';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<RouteChooser />);

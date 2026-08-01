import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppShell } from './ui/AppShell';
import { Home } from './pages/Home';
import { TrajectoryLab } from './pages/TrajectoryLab';
import { MagnusExplorer } from './pages/MagnusExplorer';
import { BounceLab } from './pages/BounceLab';

/**
 * Routes are added as each view lands. Anything not yet built redirects home
 * rather than rendering a placeholder that looks like a broken page.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/trajectory" element={<TrajectoryLab />} />
          <Route path="/magnus" element={<MagnusExplorer />} />
          <Route path="/bounce" element={<BounceLab />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

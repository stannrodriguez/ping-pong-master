import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppShell } from './ui/AppShell';
import { Home } from './pages/Home';
import { TrajectoryLab } from './pages/TrajectoryLab';
import { MagnusExplorer } from './pages/MagnusExplorer';
import { BounceLab } from './pages/BounceLab';
import { ShotGallery } from './pages/ShotGallery';
import { Predict } from './pages/Predict';

// The trainer carries the only three.js scene in the app; loading it lazily keeps
// WebGL out of the bundle for every other page.
const Trainer = lazy(() =>
  import('./pages/Trainer').then((m) => ({ default: m.Trainer })),
);

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
          <Route path="/shots" element={<ShotGallery />} />
          <Route path="/predict" element={<Predict />} />
          <Route
            path="/trainer"
            element={
              <Suspense fallback={null}>
                <Trainer />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

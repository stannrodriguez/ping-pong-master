import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';

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
 * Hosts that cannot rewrite unknown paths to index.html — a plain file server, or
 * anywhere the app is served from a URL it does not control — need hash routing,
 * because a real path like /trajectory would simply not resolve. Built with
 * `VITE_HASH_ROUTER=1` to switch.
 *
 * GitHub Pages does not need this: it falls back to 404.html, and the deploy
 * workflow puts a copy of the app there.
 */
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter;

export default function App() {
  return (
    // The router has to know it is mounted under a subdirectory when deployed to
    // a Pages project site; BASE_URL is whatever `base` was built with, and is
    // just "/" locally. HashRouter ignores it, which is correct — everything
    // after the "#" is already relative to wherever the page happens to live.
    <Router basename={import.meta.env.VITE_HASH_ROUTER ? undefined : import.meta.env.BASE_URL}>
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
    </Router>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppShell } from './ui/AppShell';
import { Home } from './pages/Home';

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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

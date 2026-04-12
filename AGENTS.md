# Agents

## Cursor Cloud specific instructions

- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4 + React Three Fiber (Three.js) + Zustand + PeerJS
- **Dev server**: `npm run dev` starts Vite on port 5173 (`--host 0.0.0.0` is configured in `vite.config.ts`)
- **Build**: `npm run build` runs `tsc -b && vite build`; output goes to `dist/`
- **Lint**: `npm run lint` runs ESLint on `.ts`/`.tsx` files
- **No backend or database required** — this is a fully client-side SPA. Multiplayer uses PeerJS (WebRTC) for peer-to-peer connections.
- **Routing**: React Router v7 with `BrowserRouter`. Routes: `/` (home), `/play` (AI game), `/lab` (Spin Lab), `/multiplayer` (peer-to-peer play).
- **Key directories**: `src/engine/` (physics, AI, types), `src/store/` (Zustand), `src/components/3d/` (R3F components), `src/components/ui/` (HUD, spin selector), `src/pages/` (route pages), `src/multiplayer/` (PeerJS wrapper).

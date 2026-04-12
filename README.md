# Spin Pong 🏓

A 3D ping pong game that teaches you spin mechanics — topspin, backspin, and sidespin — through interactive play and visualization.

## Features

- **Play vs AI** — Three difficulty levels (Beginner, Intermediate, Advanced). Select your spin type and see how it affects the ball trajectory in real-time.
- **Multiplayer** — Share a link to play with a friend via peer-to-peer WebRTC connection.
- **Spin Lab** — Visualize and compare spin trajectories side by side on a 3D table. Toggle different spin types to see how they curve.
- **Spin Quiz** — Test your understanding with scenario-based questions about when to use each spin type.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Controls

- **Mouse** — Move to aim your paddle left/right
- **Click** — Serve or hit the ball
- **1–5 keys** — Select spin type (1=Topspin, 2=Backspin, 3=Sidespin Left, 4=Sidespin Right, 5=Flat)
- **Scroll/drag** — Orbit the camera around the table
- **Esc** — Return to menu

## Tech Stack

- React 19 + TypeScript
- Three.js via React Three Fiber + Drei
- Tailwind CSS v4
- Zustand (state management)
- PeerJS (WebRTC multiplayer)
- Vite (build tool)

## Spin Types Explained

| Spin | Effect | When to Use |
|------|--------|-------------|
| **Topspin** | Ball dips down fast, accelerates after bounce | Aggressive shots, keeping ball on table |
| **Backspin** | Ball floats, stays low after bounce | Defensive play, slowing the rally |
| **Sidespin Left** | Ball curves left | Pulling opponent wide, deceptive serves |
| **Sidespin Right** | Ball curves right | Wide serves, angled returns |
| **Flat** | Straight trajectory, no spin effect | Surprising opponents who expect spin |

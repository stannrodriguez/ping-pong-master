import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Difficulty } from '../engine/types';

type ViewMode = '2d' | '3d';

export function Home() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [viewMode, setViewMode] = useState<ViewMode>('2d');

  const difficulties: { value: Difficulty; label: string; desc: string; color: string }[] = [
    { value: 'beginner', label: 'Beginner', desc: 'Slow AI, more time to react', color: '#4ade80' },
    { value: 'intermediate', label: 'Intermediate', desc: 'Faster reactions, varied spins', color: '#facc15' },
    { value: 'advanced', label: 'Advanced', desc: 'Quick, accurate, tough to beat', color: '#f87171' },
  ];

  const playPath = viewMode === '2d' ? '/play2d' : '/play';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0a1628] to-[#0d2137] overflow-auto">
      <div className="text-center mb-8 fade-in">
        <h1 className="text-6xl font-black tracking-tight mb-2">
          <span className="text-cyan-400">SPIN</span>
          <span className="text-white"> PONG</span>
        </h1>
        <p className="text-gray-400 text-lg">Master the art of ping pong spin</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md px-6 fade-in">
        {/* Play vs AI */}
        <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">🤖 Play vs AI</h3>

            {/* 2D / 3D toggle */}
            <div className="flex bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('2d')}
                className="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: viewMode === '2d' ? 'rgba(0,229,255,0.2)' : 'transparent',
                  color: viewMode === '2d' ? '#00e5ff' : '#666',
                }}
              >
                2D Fast
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: viewMode === '3d' ? 'rgba(0,229,255,0.2)' : 'transparent',
                  color: viewMode === '3d' ? '#00e5ff' : '#666',
                }}
              >
                3D
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            {viewMode === '2d'
              ? 'Top-down view — lightweight & snappy. Great for learning spin curves.'
              : '3D perspective — immersive but heavier. Best on powerful devices.'}
          </p>

          <div className="flex gap-2 mb-4">
            {difficulties.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                style={{
                  background: difficulty === d.value ? `${d.color}22` : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${difficulty === d.value ? d.color : 'transparent'}`,
                  color: difficulty === d.value ? d.color : '#888',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {difficulties.find((d) => d.value === difficulty)?.desc}
          </p>
          <button
            onClick={() => navigate(`${playPath}?difficulty=${difficulty}`)}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-lg transition-all pulse-glow cursor-pointer"
          >
            Start Match
          </button>
        </div>

        {/* Multiplayer */}
        <button
          onClick={() => navigate('/multiplayer')}
          className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 text-left hover:border-purple-500/50 transition-all cursor-pointer"
        >
          <h3 className="text-lg font-bold text-white mb-1">👥 Play with a Friend</h3>
          <p className="text-sm text-gray-400">Share a link and play in real-time (3D)</p>
        </button>

        {/* Spin Lab */}
        <button
          onClick={() => navigate('/lab')}
          className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 text-left hover:border-amber-500/50 transition-all cursor-pointer"
        >
          <h3 className="text-lg font-bold text-white mb-1">🔬 Spin Lab</h3>
          <p className="text-sm text-gray-400">
            Visualize spin physics, practice recognition, take the spin quiz
          </p>
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-8 fade-in">
        Move mouse to aim • Click to serve • Returns are automatic • Keys 1-5 to select spin
      </p>
    </div>
  );
}

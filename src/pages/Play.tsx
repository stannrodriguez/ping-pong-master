import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GameScene } from '../components/3d/GameScene';
import { HUD } from '../components/ui/HUD';
import { SpinSelector } from '../components/ui/SpinSelector';
import { useGameStore } from '../store/gameStore';
import { Difficulty, SpinType } from '../engine/types';

const SPIN_KEYS: Record<string, SpinType> = {
  '1': 'topspin',
  '2': 'backspin',
  '3': 'sidespin-left',
  '4': 'sidespin-right',
  '5': 'flat',
};

export function Play() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const startGame = useGameStore((s) => s.startGame);
  const setSelectedSpin = useGameStore((s) => s.setSelectedSpin);
  const resetGame = useGameStore((s) => s.resetGame);

  useEffect(() => {
    const difficulty = (searchParams.get('difficulty') || 'beginner') as Difficulty;
    startGame('ai', difficulty);

    return () => {
      resetGame();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (SPIN_KEYS[e.key]) {
        setSelectedSpin(SPIN_KEYS[e.key]);
      }
      if (e.key === 'Escape') {
        resetGame();
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setSelectedSpin, resetGame, navigate]);

  return (
    <div className="w-full h-full relative">
      <GameScene />
      <HUD />
      <SpinSelector />

      {/* Back button */}
      <button
        onClick={() => {
          resetGame();
          navigate('/');
        }}
        className="fixed top-3 left-3 z-30 px-3 py-1 bg-black/50 backdrop-blur rounded-lg text-sm text-gray-400 hover:text-white transition-colors cursor-pointer pointer-events-auto"
      >
        ← Back
      </button>
    </div>
  );
}

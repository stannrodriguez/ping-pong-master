import { useGameStore } from '../../store/gameStore';
import { SPIN_CONFIGS } from '../../engine/types';

export function HUD() {
  const player = useGameStore((s) => s.player);
  const opponent = useGameStore((s) => s.opponent);
  const phase = useGameStore((s) => s.phase);
  const isPlayerServing = useGameStore((s) => s.isPlayerServing);
  const lastPointMessage = useGameStore((s) => s.lastPointMessage);
  const config = useGameStore((s) => s.config);
  const selectedSpin = useGameStore((s) => s.selectedSpin);
  const nextServe = useGameStore((s) => s.nextServe);
  const resetGame = useGameStore((s) => s.resetGame);

  return (
    <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none">
      {/* Score bar */}
      <div className="flex justify-between items-center px-6 py-3 bg-black/50 backdrop-blur-sm pointer-events-auto">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-cyan-400">{player.name}</span>
          <span className="text-3xl font-black text-white">{player.score}</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-400 uppercase tracking-widest">
            {config.difficulty} AI
          </span>
          {phase === 'serving' && (
            <span className="text-xs text-yellow-400 mt-1">
              {isPlayerServing ? 'Your serve — click to serve!' : 'AI serving...'}
            </span>
          )}
          {phase === 'playing' && (
            <span
              className="text-xs mt-1 font-medium"
              style={{ color: SPIN_CONFIGS[selectedSpin].color }}
            >
              {SPIN_CONFIGS[selectedSpin].icon} {SPIN_CONFIGS[selectedSpin].label} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-white">{opponent.score}</span>
          <span className="text-lg font-bold text-red-400">{opponent.name}</span>
        </div>
      </div>

      {/* Point scored overlay */}
      {phase === 'point-scored' && (
        <div className="fixed inset-0 flex items-center justify-center z-30">
          <div className="bg-black/80 backdrop-blur-lg rounded-2xl px-8 py-6 text-center fade-in max-w-md pointer-events-auto">
            <p className="text-xl font-bold text-white mb-2">{lastPointMessage}</p>
            <p className="text-sm text-gray-400 mb-4">
              {player.score} — {opponent.score}
            </p>
            <button
              onClick={() => nextServe()}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-colors cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {phase === 'game-over' && (
        <div className="fixed inset-0 flex items-center justify-center z-30">
          <div className="bg-black/90 backdrop-blur-lg rounded-2xl px-10 py-8 text-center fade-in max-w-md pointer-events-auto">
            <h2 className="text-3xl font-black mb-2">
              {player.score > opponent.score ? (
                <span className="text-cyan-400">You Win! 🏆</span>
              ) : (
                <span className="text-red-400">AI Wins!</span>
              )}
            </h2>
            <p className="text-lg text-gray-300 mb-6">
              {player.score} — {opponent.score}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  const store = useGameStore.getState();
                  store.startGame(config.mode, config.difficulty);
                }}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-colors cursor-pointer"
              >
                Play Again
              </button>
              <button
                onClick={() => resetGame()}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useGameStore } from '../../store/gameStore';
import { SPIN_CONFIGS, SpinType } from '../../engine/types';

const spinOrder: SpinType[] = ['topspin', 'backspin', 'sidespin-left', 'sidespin-right', 'flat'];

export function SpinSelector() {
  const selectedSpin = useGameStore((s) => s.selectedSpin);
  const setSelectedSpin = useGameStore((s) => s.setSelectedSpin);
  const phase = useGameStore((s) => s.phase);
  const showSpinInfo = useGameStore((s) => s.showSpinInfo);
  const setShowSpinInfo = useGameStore((s) => s.setShowSpinInfo);

  if (phase === 'menu' || phase === 'game-over') return null;

  const currentSpin = SPIN_CONFIGS[selectedSpin];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 pointer-events-auto">
      {showSpinInfo && (
        <div
          className="bg-black/80 backdrop-blur-md rounded-xl px-4 py-3 max-w-sm text-center fade-in"
          style={{ borderColor: currentSpin.color, borderWidth: 1 }}
        >
          <p className="text-sm font-semibold" style={{ color: currentSpin.color }}>
            {currentSpin.icon} {currentSpin.label}
          </p>
          <p className="text-xs text-gray-300 mt-1">{currentSpin.tip}</p>
        </div>
      )}

      <div className="flex gap-2 bg-black/70 backdrop-blur-md rounded-2xl px-3 py-2">
        {spinOrder.map((spinType) => {
          const cfg = SPIN_CONFIGS[spinType];
          const isActive = selectedSpin === spinType;

          return (
            <button
              key={spinType}
              onClick={() => setSelectedSpin(spinType)}
              onMouseEnter={() => setShowSpinInfo(true)}
              onMouseLeave={() => setShowSpinInfo(false)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer"
              style={{
                background: isActive ? `${cfg.color}22` : 'transparent',
                border: isActive ? `2px solid ${cfg.color}` : '2px solid transparent',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <span className="text-lg">{cfg.icon}</span>
              <span
                className="text-xs font-medium"
                style={{ color: isActive ? cfg.color : '#888' }}
              >
                {cfg.label.replace('Sidespin ', '')}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">Press 1-5 or click to select spin</p>
    </div>
  );
}

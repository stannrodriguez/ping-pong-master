import { useNavigate } from 'react-router-dom';

/**
 * Interim landing page. The game modes this used to launch have been removed; the
 * full home page arrives with the design system in the next PR.
 */
export function Home() {
  const navigate = useNavigate();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0a1628] to-[#0d2137] overflow-auto">
      <div className="text-center mb-8 fade-in">
        <h1 className="text-6xl font-black tracking-tight mb-2">
          <span className="text-cyan-400">SPIN</span>
        </h1>
        <p className="text-gray-400 text-lg">The physics of table tennis spin</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md px-6 fade-in">
        <button
          onClick={() => navigate('/lab')}
          className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 text-left hover:border-amber-500/50 transition-all cursor-pointer"
        >
          <h3 className="text-lg font-bold text-white mb-1">🔬 Spin Lab</h3>
          <p className="text-sm text-gray-400">
            Compare spin trajectories and test your understanding
          </p>
        </button>
      </div>
    </div>
  );
}

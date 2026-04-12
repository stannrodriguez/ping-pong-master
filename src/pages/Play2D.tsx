import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SpinType, SPIN_CONFIGS, Difficulty } from '../engine/types';
import {
  Game2DState, TABLE_2D, createGame2D, serve2D, step2D, nextServe2D,
} from '../engine/physics2d';

const SPIN_ORDER: SpinType[] = ['topspin', 'backspin', 'sidespin-left', 'sidespin-right', 'flat'];
const SPIN_KEYS: Record<string, SpinType> = { '1': 'topspin', '2': 'backspin', '3': 'sidespin-left', '4': 'sidespin-right', '5': 'flat' };

export function Play2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Game2DState>(createGame2D('beginner'));
  const mouseXRef = useRef(TABLE_2D.width / 2);
  const animRef = useRef(0);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedSpin, setSelectedSpin] = useState<SpinType>('flat');
  const [phase, setPhase] = useState(stateRef.current.phase);
  const [scores, setScores] = useState({ player: 0, opponent: 0 });
  const [pointMsg, setPointMsg] = useState('');
  const [showSpinTip, setShowSpinTip] = useState(false);

  useEffect(() => {
    const diff = (searchParams.get('difficulty') || 'beginner') as Difficulty;
    stateRef.current = createGame2D(diff);
    setPhase('serving');
    setScores({ player: 0, opponent: 0 });
  }, [searchParams]);

  useEffect(() => {
    stateRef.current.selectedSpin = selectedSpin;
  }, [selectedSpin]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (SPIN_KEYS[e.key]) setSelectedSpin(SPIN_KEYS[e.key]);
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  const handleCanvasClick = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'serving' && s.isPlayerServing) {
      stateRef.current = serve2D(s);
    } else if (s.phase === 'point-scored') {
      if (s.playerScore >= 11 || s.opponentScore >= 11) {
        if (Math.abs(s.playerScore - s.opponentScore) >= 2) {
          stateRef.current = { ...s, phase: 'game-over' };
          setPhase('game-over');
          return;
        }
      }
      stateRef.current = nextServe2D(s);
      setPhase('serving');
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = TABLE_2D.width / rect.width;
    mouseXRef.current = (e.clientX - rect.left) * scaleX;
  }, []);

  // Game loop
  useEffect(() => {
    let aiServeTimer = 0;

    const loop = () => {
      const s = stateRef.current;

      // Move player paddle
      const targetX = mouseXRef.current - s.player.width / 2;
      s.player.x += (Math.max(0, Math.min(TABLE_2D.width - TABLE_2D.paddleW, targetX)) - s.player.x) * 0.2;

      // AI serve
      if (s.phase === 'serving' && !s.isPlayerServing) {
        aiServeTimer++;
        if (aiServeTimer > 60) {
          stateRef.current = serve2D(s);
          aiServeTimer = 0;
        }
      } else {
        aiServeTimer = 0;
      }

      // Step physics
      if (s.phase === 'playing') {
        stateRef.current = step2D(s);
      }

      // Sync React state (throttled)
      const cur = stateRef.current;
      if (cur.phase !== phase) setPhase(cur.phase);
      if (cur.playerScore !== scores.player || cur.opponentScore !== scores.opponent) {
        setScores({ player: cur.playerScore, opponent: cur.opponentScore });
      }
      if (cur.pointMessage !== pointMsg) setPointMsg(cur.pointMessage);

      draw();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    const W = TABLE_2D.width;
    const H = TABLE_2D.height;

    // Table background
    ctx.fillStyle = '#1a6b3c';
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // Center line (net)
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, TABLE_2D.netY);
    ctx.lineTo(W, TABLE_2D.netY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Net solid bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, TABLE_2D.netY - 1, W, 3);

    // Trail
    if (s.ball.trail.length > 1) {
      const spinColor = SPIN_CONFIGS[s.ball.spin].color;
      for (let i = 1; i < s.ball.trail.length; i++) {
        const alpha = i / s.ball.trail.length;
        ctx.strokeStyle = spinColor;
        ctx.globalAlpha = alpha * 0.6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.ball.trail[i - 1].x, s.ball.trail[i - 1].y);
        ctx.lineTo(s.ball.trail[i].x, s.ball.trail[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Ball
    if (s.ball.inPlay || s.phase === 'serving') {
      const spinColor = SPIN_CONFIGS[s.selectedSpin].color;

      // Glow
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, TABLE_2D.ballR + 4, 0, Math.PI * 2);
      ctx.fillStyle = s.ball.inPlay ? SPIN_CONFIGS[s.ball.spin].color + '33' : spinColor + '33';
      ctx.fill();

      // Ball body
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, TABLE_2D.ballR, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Spin direction indicator on ball
      if (s.ball.inPlay) {
        drawSpinArrow(ctx, s.ball.x, s.ball.y, s.ball.spin);
      }
    }

    // Paddles
    drawPaddle(ctx, s.player, s.selectedSpin, true);
    drawPaddle(ctx, s.opponent, 'flat', false);

    // Spin effect label (floating near ball during play)
    if (s.ball.inPlay && s.ball.spin !== 'flat') {
      ctx.font = '11px system-ui';
      ctx.fillStyle = SPIN_CONFIGS[s.ball.spin].color;
      ctx.textAlign = 'center';
      ctx.fillText(SPIN_CONFIGS[s.ball.spin].icon + ' ' + SPIN_CONFIGS[s.ball.spin].label, s.ball.x, s.ball.y - 16);
    }
  }

  function drawSpinArrow(ctx: CanvasRenderingContext2D, x: number, y: number, spin: SpinType) {
    ctx.save();
    ctx.strokeStyle = SPIN_CONFIGS[spin].color;
    ctx.lineWidth = 1.5;
    const r = TABLE_2D.ballR - 1;

    if (spin === 'topspin') {
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI * 0.7, Math.PI * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.85, y + r * 0.5);
      ctx.lineTo(x + r * 0.5, y + r * 0.9);
      ctx.lineTo(x + r * 1.1, y + r * 0.8);
      ctx.stroke();
    } else if (spin === 'backspin') {
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.3, -Math.PI * 0.7, true);
      ctx.stroke();
    } else if (spin === 'sidespin-left') {
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x - 4, y);
      ctx.lineTo(x - 1, y - 3);
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x - 1, y + 3);
      ctx.stroke();
    } else if (spin === 'sidespin-right') {
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x + 1, y - 3);
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + 1, y + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPaddle(ctx: CanvasRenderingContext2D, p: { x: number; y: number; width: number; height: number }, spin: SpinType, isPlayer: boolean) {
    const color = SPIN_CONFIGS[spin].color;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(p.x + 2, p.y + 2, p.width, p.height);

    // Paddle body
    ctx.fillStyle = isPlayer ? '#cc2222' : '#cc2222';
    ctx.fillRect(p.x, p.y, p.width, p.height);

    // Glow border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 1, p.y - 1, p.width + 2, p.height + 2);
  }

  const currentSpin = SPIN_CONFIGS[selectedSpin];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0a1628] to-[#0d2137] relative overflow-hidden">
      {/* Score bar */}
      <div className="flex items-center gap-8 mb-3 z-10">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold">You</span>
          <span className="text-3xl font-black text-white">{scores.player}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            {searchParams.get('difficulty') || 'beginner'} AI
          </span>
          {phase === 'serving' && (
            <span className="text-xs text-yellow-400 mt-0.5">
              {stateRef.current.isPlayerServing ? 'Click to serve!' : 'AI serving...'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black text-white">{scores.opponent}</span>
          <span className="text-red-400 font-bold">AI</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={TABLE_2D.width}
          height={TABLE_2D.height}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          className="rounded-lg shadow-2xl cursor-crosshair"
          style={{ maxHeight: 'calc(100vh - 220px)', width: 'auto' }}
        />

        {/* Point scored overlay */}
        {phase === 'point-scored' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="bg-black/80 backdrop-blur rounded-xl px-6 py-4 text-center fade-in">
              <p className="text-white font-bold mb-2">{pointMsg}</p>
              <p className="text-sm text-gray-400 mb-3">{scores.player} — {scores.opponent}</p>
              <button
                onClick={handleCanvasClick}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {phase === 'game-over' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
            <div className="bg-black/90 backdrop-blur rounded-xl px-8 py-6 text-center fade-in">
              <h2 className="text-2xl font-black mb-1">
                {scores.player > scores.opponent
                  ? <span className="text-cyan-400">You Win! 🏆</span>
                  : <span className="text-red-400">AI Wins!</span>}
              </h2>
              <p className="text-gray-300 mb-4">{scores.player} — {scores.opponent}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const diff = (searchParams.get('difficulty') || 'beginner') as Difficulty;
                    stateRef.current = createGame2D(diff);
                    setPhase('serving');
                    setScores({ player: 0, opponent: 0 });
                  }}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg cursor-pointer"
                >
                  Play Again
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg cursor-pointer"
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spin selector */}
      <div className="flex flex-col items-center gap-2 mt-3 z-10">
        {showSpinTip && (
          <div
            className="bg-black/80 backdrop-blur-md rounded-xl px-4 py-2 max-w-sm text-center fade-in"
            style={{ borderColor: currentSpin.color, borderWidth: 1 }}
          >
            <p className="text-sm font-semibold" style={{ color: currentSpin.color }}>
              {currentSpin.icon} {currentSpin.label}
            </p>
            <p className="text-xs text-gray-300 mt-1">{currentSpin.tip}</p>
          </div>
        )}

        <div className="flex gap-2 bg-black/70 backdrop-blur-md rounded-2xl px-3 py-2">
          {SPIN_ORDER.map((spinType) => {
            const cfg = SPIN_CONFIGS[spinType];
            const isActive = selectedSpin === spinType;
            return (
              <button
                key={spinType}
                onClick={() => setSelectedSpin(spinType)}
                onMouseEnter={() => setShowSpinTip(true)}
                onMouseLeave={() => setShowSpinTip(false)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                style={{
                  background: isActive ? `${cfg.color}22` : 'transparent',
                  border: isActive ? `2px solid ${cfg.color}` : '2px solid transparent',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <span className="text-base">{cfg.icon}</span>
                <span className="text-xs font-medium" style={{ color: isActive ? cfg.color : '#888' }}>
                  {cfg.label.replace('Sidespin ', 'S-')}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-600">Keys 1-5 to select spin • Mouse to aim</p>
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-3 left-3 z-30 px-3 py-1 bg-black/50 backdrop-blur rounded-lg text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        ← Back
      </button>
    </div>
  );
}

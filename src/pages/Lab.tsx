import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { SpinType, SPIN_CONFIGS, TABLE, BALL, BallState } from '../engine/types';
import { serveBall, stepBall, vec3 } from '../engine/physics';
import { GameEnvironment } from '../components/3d/Environment';
import { PingPongTable } from '../components/3d/Table';

type LabMode = 'visualizer' | 'quiz';

interface QuizQuestion {
  scenario: string;
  correctSpin: SpinType;
  explanation: string;
  options: SpinType[];
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    scenario: 'Your opponent is standing far back from the table. What spin should you use to keep the ball low and fast, making it dip quickly after the net?',
    correctSpin: 'topspin',
    explanation: 'Topspin makes the ball dip quickly due to the Magnus effect. This keeps it low over the net and accelerates after bouncing — perfect against an opponent standing far back since the ball rushes at them.',
    options: ['topspin', 'backspin', 'flat', 'sidespin-left'],
  },
  {
    scenario: 'Your opponent just hit a powerful topspin drive. You want to neutralize the pace and buy yourself time. Which spin should you use?',
    correctSpin: 'backspin',
    explanation: 'Backspin (or "chop") slows the ball down and makes it float. It counteracts the incoming topspin and gives you time to recover position. The ball stays low after bouncing, making it hard for the opponent to attack.',
    options: ['topspin', 'backspin', 'flat', 'sidespin-right'],
  },
  {
    scenario: "You're serving and want to pull your opponent out wide to the left side of the table. Which spin should you use?",
    correctSpin: 'sidespin-left',
    explanation: 'Left sidespin curves the ball to the left. When serving, this pulls the ball wide to the left side, forcing the opponent to reach and giving you the advantage on the next shot.',
    options: ['topspin', 'sidespin-left', 'sidespin-right', 'flat'],
  },
  {
    scenario: 'Your opponent is expecting a heavy spin serve. You want to surprise them with an easy-to-read shot. Which should you use?',
    correctSpin: 'flat',
    explanation: "A flat (no spin) shot is predictable but can be deceptive! When your opponent is reading for heavy spin, a flat ball won't behave how they expect — they'll likely overshoot their return.",
    options: ['topspin', 'backspin', 'flat', 'sidespin-right'],
  },
  {
    scenario: "You want to serve wide to your opponent's forehand (right) side. Which sidespin direction should you use?",
    correctSpin: 'sidespin-right',
    explanation: 'Right sidespin curves the ball to the right from your perspective. This sends the ball wide to the right side of the table, targeting the opponent\'s forehand side and opening up the court.',
    options: ['sidespin-left', 'sidespin-right', 'topspin', 'backspin'],
  },
  {
    scenario: 'The ball is high and you have an opportunity for a smash/kill shot. What spin maximizes your chance of keeping it on the table?',
    correctSpin: 'topspin',
    explanation: 'Topspin is essential for aggressive shots! The forward rotation creates a downward force (Magnus effect) that pulls the ball down onto the table. Without it, a hard-hit ball often flies long.',
    options: ['topspin', 'backspin', 'flat', 'sidespin-left'],
  },
  {
    scenario: 'Your opponent keeps returning your serves easily. You want to make the ball curve unpredictably. Which spin adds a sideways curve?',
    correctSpin: 'sidespin-left',
    explanation: 'Sidespin creates a lateral curve that many players find difficult to read. The ball appears to be heading straight but curves at the last moment, causing mistimed returns.',
    options: ['topspin', 'backspin', 'sidespin-left', 'flat'],
  },
  {
    scenario: 'You want to play a short, controlled push that stays low and doesn\'t bounce high. Which spin achieves this?',
    correctSpin: 'backspin',
    explanation: 'Backspin keeps the ball low after bouncing. The backward rotation fights against the bounce, making the ball stay short and low. This is the foundation of the "push" stroke in table tennis.',
    options: ['topspin', 'backspin', 'sidespin-right', 'flat'],
  },
];

function TrajectoryBall({ trajectory, spinType, isAnimating }: {
  trajectory: BallState[];
  spinType: SpinType;
  isAnimating: boolean;
}) {
  const ballRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef(0);
  const trailRef = useRef<THREE.Points>(null);
  const color = SPIN_CONFIGS[spinType].color;

  useFrame(() => {
    if (!isAnimating || trajectory.length === 0) return;

    frameRef.current = (frameRef.current + 1) % trajectory.length;
    const state = trajectory[frameRef.current];

    if (ballRef.current) {
      ballRef.current.position.set(state.position.x, state.position.y, state.position.z);
    }

    if (trailRef.current) {
      const end = frameRef.current;
      const start = Math.max(0, end - 30);
      const slice = trajectory.slice(start, end);
      const positions = new Float32Array(slice.length * 3);
      const colors = new Float32Array(slice.length * 3);
      const c = new THREE.Color(color);

      slice.forEach((s, i) => {
        positions[i * 3] = s.position.x;
        positions[i * 3 + 1] = s.position.y;
        positions[i * 3 + 2] = s.position.z;
        const alpha = i / slice.length;
        colors[i * 3] = c.r * alpha;
        colors[i * 3 + 1] = c.g * alpha;
        colors[i * 3 + 2] = c.b * alpha;
      });

      trailRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      trailRef.current.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
  });

  return (
    <group>
      <mesh ref={ballRef}>
        <sphereGeometry args={[BALL.radius, 16, 16]} />
        <meshStandardMaterial color="white" emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <points ref={trailRef}>
        <bufferGeometry />
        <pointsMaterial size={0.015} vertexColors transparent opacity={0.8} />
      </points>
    </group>
  );
}

function StaticTrajectory({ trajectory, spinType }: {
  trajectory: BallState[];
  spinType: SpinType;
}) {
  const color = SPIN_CONFIGS[spinType].color;

  const points = trajectory.map((s) => new THREE.Vector3(s.position.x, s.position.y, s.position.z));

  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  const tubePoints = curve.getPoints(100);

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(tubePoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.6} />
      </line>
    </group>
  );
}

function generateTrajectory(spinType: SpinType): BallState[] {
  let ball = serveBall(
    {
      position: vec3(0, TABLE.surfaceY + 0.3, TABLE.length / 2 - 1),
      velocity: vec3(),
      spin: vec3(),
      spinType: 'flat',
      isServing: true,
      lastHitBy: null,
      trail: [],
      bounceCount: 0,
      isInPlay: false,
    },
    spinType,
    true
  );

  const states: BallState[] = [ball];
  for (let i = 0; i < 300; i++) {
    ball = stepBall(ball, 1 / 60);
    states.push(ball);
    if (ball.position.y < -1 || Math.abs(ball.position.z) > TABLE.length) break;
  }

  return states;
}

function VisualizerView() {
  const [selectedSpins, setSelectedSpins] = useState<SpinType[]>(['topspin', 'backspin', 'flat']);
  const [isAnimating, setIsAnimating] = useState(true);
  const [trajectories, setTrajectories] = useState<Record<SpinType, BallState[]>>({} as any);

  const allSpins: SpinType[] = ['topspin', 'backspin', 'sidespin-left', 'sidespin-right', 'flat'];

  useEffect(() => {
    const spins: SpinType[] = ['topspin', 'backspin', 'sidespin-left', 'sidespin-right', 'flat'];
    const trajs: Record<string, BallState[]> = {};
    for (const spin of spins) {
      trajs[spin] = generateTrajectory(spin);
    }
    setTrajectories(trajs as any);
  }, []);

  const toggleSpin = (spin: SpinType) => {
    setSelectedSpins((prev) =>
      prev.includes(spin) ? prev.filter((s) => s !== spin) : [...prev, spin]
    );
  };

  const regenerate = () => {
    const trajs: Record<string, BallState[]> = {};
    for (const spin of allSpins) {
      trajs[spin] = generateTrajectory(spin);
    }
    setTrajectories(trajs as any);
  };

  return (
    <div className="w-full h-full flex">
      {/* 3D Viewport */}
      <div className="flex-1 relative">
        <Canvas
          shadows
          camera={{ position: [3, 4, 8], fov: 45 }}
          style={{ width: '100%', height: '100%' }}
        >
          <GameEnvironment />
          <PingPongTable />

          {selectedSpins.map((spin) => {
            const traj = trajectories[spin];
            if (!traj) return null;

            return (
              <group key={spin}>
                {isAnimating ? (
                  <TrajectoryBall trajectory={traj} spinType={spin} isAnimating={isAnimating} />
                ) : (
                  <StaticTrajectory trajectory={traj} spinType={spin} />
                )}
              </group>
            );
          })}

          <OrbitControls enablePan enableZoom enableRotate maxDistance={15} minDistance={3} />
        </Canvas>
      </div>

      {/* Controls Panel */}
      <div className="w-80 bg-black/60 backdrop-blur p-5 overflow-y-auto border-l border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Spin Comparison</h2>
        <p className="text-sm text-gray-400 mb-4">
          Toggle spins to compare their trajectories side by side. Notice how each spin type
          changes the ball's path through the air and after bouncing.
        </p>

        <div className="flex flex-col gap-2 mb-6">
          {allSpins.map((spin) => {
            const cfg = SPIN_CONFIGS[spin];
            const isOn = selectedSpins.includes(spin);

            return (
              <button
                key={spin}
                onClick={() => toggleSpin(spin)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer"
                style={{
                  background: isOn ? `${cfg.color}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isOn ? cfg.color : 'transparent'}`,
                }}
              >
                <span className="text-lg">{cfg.icon}</span>
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold" style={{ color: isOn ? cfg.color : '#666' }}>
                    {cfg.label}
                  </p>
                  <p className="text-xs text-gray-500">{cfg.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white transition-colors cursor-pointer"
          >
            {isAnimating ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={regenerate}
            className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white transition-colors cursor-pointer"
          >
            🔄 Regenerate
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-bold text-white mb-2">How Spin Works</h3>
          <div className="space-y-3 text-xs text-gray-400">
            <div>
              <p className="font-semibold text-red-400 mb-1">🔄 Topspin (Forward spin)</p>
              <p>The ball spins forward in the direction of travel. Air pressure pushes the ball <strong className="text-white">downward</strong> (Magnus effect), making it dip quickly. After bouncing, it <strong className="text-white">accelerates</strong> and shoots forward.</p>
            </div>
            <div>
              <p className="font-semibold text-blue-400 mb-1">🔄 Backspin (Backward spin)</p>
              <p>The ball spins backward against travel direction. Air pressure pushes the ball <strong className="text-white">upward</strong>, making it float. After bouncing, it <strong className="text-white">slows down</strong> and stays low.</p>
            </div>
            <div>
              <p className="font-semibold text-amber-400 mb-1">🔄 Sidespin (Lateral spin)</p>
              <p>The ball spins sideways. Air pressure pushes it <strong className="text-white">left or right</strong>, creating a curve. After bouncing, the ball <strong className="text-white">kicks sideways</strong>, making it very deceptive.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-400 mb-1">⏺ Flat (No spin)</p>
              <p>No Magnus effect — the ball follows a simple parabolic arc. Predictable but can surprise opponents expecting spin.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizView() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<SpinType | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [shuffledQuestions] = useState(() => [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5));

  const question = shuffledQuestions[currentQ];

  const handleAnswer = (spin: SpinType) => {
    if (showExplanation) return;
    setSelected(spin);
    setShowExplanation(true);
    if (spin === question.correctSpin) {
      setScore((s) => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQ + 1 >= shuffledQuestions.length) {
      setCompleted(true);
    } else {
      setCurrentQ((q) => q + 1);
      setSelected(null);
      setShowExplanation(false);
    }
  };

  const restart = () => {
    setCurrentQ(0);
    setSelected(null);
    setShowExplanation(false);
    setScore(0);
    setCompleted(false);
  };

  if (completed) {
    const pct = Math.round((score / shuffledQuestions.length) * 100);
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="bg-white/5 backdrop-blur rounded-2xl p-8 max-w-lg text-center border border-white/10 fade-in">
          <h2 className="text-3xl font-black mb-2">
            {pct >= 80 ? '🏆 Spin Master!' : pct >= 50 ? '🎯 Getting There!' : '📚 Keep Learning!'}
          </h2>
          <p className="text-5xl font-black text-cyan-400 mb-2">{pct}%</p>
          <p className="text-gray-400 mb-6">
            You got {score} out of {shuffledQuestions.length} correct
          </p>
          <button
            onClick={restart}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="bg-white/5 backdrop-blur rounded-2xl p-6 max-w-2xl w-full border border-white/10 fade-in">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-400">
            Question {currentQ + 1} of {shuffledQuestions.length}
          </span>
          <span className="text-sm text-cyan-400 font-bold">Score: {score}</span>
        </div>

        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <p className="text-white text-lg leading-relaxed">{question.scenario}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {question.options.map((spin) => {
            const cfg = SPIN_CONFIGS[spin];
            let bg = 'rgba(255,255,255,0.05)';
            let border = 'transparent';

            if (showExplanation) {
              if (spin === question.correctSpin) {
                bg = 'rgba(74, 222, 128, 0.15)';
                border = '#4ade80';
              } else if (spin === selected && spin !== question.correctSpin) {
                bg = 'rgba(248, 113, 113, 0.15)';
                border = '#f87171';
              }
            } else if (spin === selected) {
              bg = `${cfg.color}15`;
              border = cfg.color;
            }

            return (
              <button
                key={spin}
                onClick={() => handleAnswer(spin)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer"
                style={{ background: bg, border: `2px solid ${border}` }}
              >
                <span className="text-xl">{cfg.icon}</span>
                <span className="font-semibold text-white">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {showExplanation && (
          <div className="fade-in">
            <div
              className="rounded-xl p-4 mb-4"
              style={{
                background:
                  selected === question.correctSpin
                    ? 'rgba(74,222,128,0.1)'
                    : 'rgba(248,113,113,0.1)',
                borderLeft: `4px solid ${selected === question.correctSpin ? '#4ade80' : '#f87171'}`,
              }}
            >
              <p className="text-sm font-bold mb-1" style={{ color: selected === question.correctSpin ? '#4ade80' : '#f87171' }}>
                {selected === question.correctSpin ? '✅ Correct!' : `❌ Not quite — ${SPIN_CONFIGS[question.correctSpin].label} is the answer`}
              </p>
              <p className="text-sm text-gray-300">{question.explanation}</p>
            </div>

            <button
              onClick={nextQuestion}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-colors cursor-pointer"
            >
              {currentQ + 1 >= shuffledQuestions.length ? 'See Results' : 'Next Question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Lab() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LabMode>('visualizer');

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#0a1628] to-[#0d2137]">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-black/40 backdrop-blur border-b border-white/10 z-10">
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          ← Back
        </button>

        <h2 className="text-lg font-bold text-white">🔬 Spin Lab</h2>

        <div className="flex gap-1 ml-auto bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setMode('visualizer')}
            className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer"
            style={{
              background: mode === 'visualizer' ? 'rgba(0,229,255,0.2)' : 'transparent',
              color: mode === 'visualizer' ? '#00e5ff' : '#888',
            }}
          >
            🎯 Visualizer
          </button>
          <button
            onClick={() => setMode('quiz')}
            className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer"
            style={{
              background: mode === 'quiz' ? 'rgba(0,229,255,0.2)' : 'transparent',
              color: mode === 'quiz' ? '#00e5ff' : '#888',
            }}
          >
            🧠 Spin Quiz
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'visualizer' ? <VisualizerView /> : <QuizView />}
      </div>
    </div>
  );
}

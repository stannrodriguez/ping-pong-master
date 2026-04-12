import { create } from 'zustand';
import {
  GamePhase,
  GameConfig,
  PlayerState,
  BallState,
  SpinType,
  Difficulty,
  GameMode,
} from '../engine/types';
import { createInitialBall } from '../engine/physics';

interface GameState {
  phase: GamePhase;
  config: GameConfig;
  player: PlayerState;
  opponent: PlayerState;
  ball: BallState;
  isPlayerServing: boolean;
  selectedSpin: SpinType;
  rallies: number;
  showSpinInfo: boolean;
  lastPointMessage: string;
  
  setPhase: (phase: GamePhase) => void;
  setConfig: (config: Partial<GameConfig>) => void;
  setPlayerPaddleX: (x: number) => void;
  setOpponentPaddleX: (x: number) => void;
  setBall: (ball: BallState) => void;
  setSelectedSpin: (spin: SpinType) => void;
  scorePoint: (scorer: 'player' | 'opponent', message: string) => void;
  resetGame: () => void;
  setShowSpinInfo: (show: boolean) => void;
  startGame: (mode: GameMode, difficulty?: Difficulty) => void;
  nextServe: () => void;
}

const initialPlayer = (): PlayerState => ({
  paddle: { position: { x: 0, y: 0.9, z: 3.5 }, rotation: { x: 0, y: 0, z: 0 }, spinType: 'flat' },
  score: 0,
  name: 'You',
});

const initialOpponent = (): PlayerState => ({
  paddle: { position: { x: 0, y: 0.9, z: -3.5 }, rotation: { x: 0, y: 0, z: 0 }, spinType: 'flat' },
  score: 0,
  name: 'AI',
});

export const useGameStore = create<GameState>((set) => ({
  phase: 'menu',
  config: {
    mode: 'ai',
    difficulty: 'beginner',
    pointsToWin: 11,
    showSpinHelpers: true,
    showTrajectory: true,
  },
  player: initialPlayer(),
  opponent: initialOpponent(),
  ball: createInitialBall(),
  isPlayerServing: true,
  selectedSpin: 'flat',
  rallies: 0,
  showSpinInfo: false,
  lastPointMessage: '',

  setPhase: (phase) => set({ phase }),
  setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
  setPlayerPaddleX: (x) =>
    set((s) => ({
      player: {
        ...s.player,
        paddle: { ...s.player.paddle, position: { ...s.player.paddle.position, x } },
      },
    })),
  setOpponentPaddleX: (x) =>
    set((s) => ({
      opponent: {
        ...s.opponent,
        paddle: { ...s.opponent.paddle, position: { ...s.opponent.paddle.position, x } },
      },
    })),
  setBall: (ball) => set({ ball }),
  setSelectedSpin: (spin) => set({ selectedSpin: spin }),
  scorePoint: (scorer, message) =>
    set((s) => ({
      phase: 'point-scored',
      lastPointMessage: message,
      player: scorer === 'player' ? { ...s.player, score: s.player.score + 1 } : s.player,
      opponent: scorer === 'opponent' ? { ...s.opponent, score: s.opponent.score + 1 } : s.opponent,
      ball: { ...s.ball, isInPlay: false },
    })),
  setShowSpinInfo: (show) => set({ showSpinInfo: show }),

  startGame: (mode, difficulty = 'beginner') =>
    set({
      phase: 'serving',
      config: {
        mode,
        difficulty,
        pointsToWin: 11,
        showSpinHelpers: true,
        showTrajectory: true,
      },
      player: initialPlayer(),
      opponent: { ...initialOpponent(), name: mode === 'ai' ? 'AI' : 'Opponent' },
      ball: createInitialBall(),
      isPlayerServing: true,
      selectedSpin: 'flat',
      rallies: 0,
      lastPointMessage: '',
    }),

  nextServe: () =>
    set((s) => {
      const totalPoints = s.player.score + s.opponent.score;
      const isPlayerServing = Math.floor(totalPoints / 2) % 2 === 0;
      const ptw = s.config.pointsToWin;

      if (s.player.score >= ptw || s.opponent.score >= ptw) {
        const diff = Math.abs(s.player.score - s.opponent.score);
        if (diff >= 2) {
          return { phase: 'game-over' };
        }
      }

      return {
        phase: 'serving',
        isPlayerServing,
        ball: createInitialBall(),
        rallies: 0,
      };
    }),

  resetGame: () =>
    set({
      phase: 'menu',
      player: initialPlayer(),
      opponent: initialOpponent(),
      ball: createInitialBall(),
      isPlayerServing: true,
      selectedSpin: 'flat',
      rallies: 0,
      lastPointMessage: '',
    }),
}));

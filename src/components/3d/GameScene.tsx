import { useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PingPongTable } from './Table';
import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { GameEnvironment } from './Environment';
import { useGameStore } from '../../store/gameStore';
import { stepBall, checkPoint, serveBall, hitBall } from '../../engine/physics';
import { getAITargetX, getAITrackingSpeed, getAISpin, shouldAIHit } from '../../engine/ai';
import { TABLE, SPIN_CONFIGS } from '../../engine/types';

function GameLogic() {
  const {
    phase, config, ball, player, opponent,
    isPlayerServing, setBall, setPlayerPaddleX, setOpponentPaddleX,
    scorePoint, setPhase,
  } = useGameStore();

  const mouseX = useRef(0);
  const aiTargetX = useRef(0);
  const frameCount = useRef(0);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const normalized = (e.clientX / window.innerWidth) * 2 - 1;
    mouseX.current = normalized * (TABLE.width / 2) * 0.9;
  }, []);

  const handleClick = useCallback(() => {
    const state = useGameStore.getState();

    if (state.phase === 'serving' && state.isPlayerServing) {
      const newBall = serveBall(state.ball, state.selectedSpin, true);
      setBall(newBall);
      setPhase('playing');
      return;
    }

    if (state.phase === 'playing' && state.ball.isInPlay) {
      const b = state.ball;
      const hitZoneZ = TABLE.length / 2 - 1.5;

      if (b.position.z > hitZoneZ - 1 && b.position.z < TABLE.length / 2 + 0.5 && b.lastHitBy === 'opponent') {
        const paddleX = state.player.paddle.position.x;
        const dist = Math.abs(b.position.x - paddleX);

        if (dist < 0.8) {
          const newBall = hitBall(b, state.selectedSpin, paddleX, true);
          setBall(newBall);
        }
      }
    }

    if (state.phase === 'point-scored') {
      state.nextServe();
    }
  }, [setBall, setPhase]);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('click', handleClick);
    };
  }, [handlePointerMove, handleClick]);

  useFrame(() => {
    setPlayerPaddleX(THREE.MathUtils.lerp(player.paddle.position.x, mouseX.current, 0.15));

    if (phase === 'serving' && !isPlayerServing) {
      frameCount.current++;
      if (frameCount.current > 90) {
        const aiSpin = getAISpin(config.difficulty);
        const newBall = serveBall(ball, aiSpin, false);
        setBall(newBall);
        setPhase('playing');
        frameCount.current = 0;
      }
    }

    if (phase !== 'playing') return;

    const newBall = stepBall(ball, 1 / 60);
    setBall(newBall);

    if (config.mode === 'ai') {
      aiTargetX.current = getAITargetX(newBall, config.difficulty);
      const aiSpeed = getAITrackingSpeed(config.difficulty);
      const currentAiX = opponent.paddle.position.x;
      const nextAiX = THREE.MathUtils.lerp(currentAiX, aiTargetX.current, aiSpeed);
      setOpponentPaddleX(nextAiX);

      if (shouldAIHit(newBall, config.difficulty) && newBall.isInPlay) {
        const aiSpin = getAISpin(config.difficulty);
        const hit = hitBall(newBall, aiSpin, currentAiX, false);
        setBall(hit);
      }
    }

    const scorer = checkPoint(newBall);
    if (scorer) {
      const spinLabel = SPIN_CONFIGS[newBall.spinType].label;
      let message = '';
      if (scorer === 'player') {
        message = `Your point! ${newBall.lastHitBy === 'opponent' ? `AI's ${spinLabel} went out` : 'AI missed the return'}`;
      } else {
        message = `AI's point! ${newBall.lastHitBy === 'player' ? `Your ${spinLabel} went out` : 'You missed the return'}`;
      }
      scorePoint(scorer, message);
    }
  });

  return null;
}

export function GameScene() {
  const player = useGameStore((s) => s.player);
  const opponent = useGameStore((s) => s.opponent);
  const selectedSpin = useGameStore((s) => s.selectedSpin);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 4, 7], fov: 50, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
    >
      <GameEnvironment />
      <PingPongTable />
      <Ball />
      <Paddle
        position={[player.paddle.position.x, player.paddle.position.y, player.paddle.position.z]}
        isPlayer={true}
        spinType={selectedSpin}
        targetX={player.paddle.position.x}
      />
      <Paddle
        position={[opponent.paddle.position.x, opponent.paddle.position.y, opponent.paddle.position.z]}
        isPlayer={false}
        spinType="flat"
        targetX={opponent.paddle.position.x}
      />
      <GameLogic />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        maxDistance={12}
        minDistance={4}
      />
    </Canvas>
  );
}

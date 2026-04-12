import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { SPIN_CONFIGS, BALL } from '../../engine/types';

const MAX_TRAIL = 20;

export function Ball() {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);
  const ball = useGameStore((s) => s.ball);

  const trailBuffers = useMemo(() => ({
    positions: new Float32Array(MAX_TRAIL * 3),
    colors: new Float32Array(MAX_TRAIL * 3),
  }), []);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.set(ball.position.x, ball.position.y, ball.position.z);

    if (trailRef.current && ball.trail.length > 0) {
      const { positions, colors } = trailBuffers;
      const color = new THREE.Color(SPIN_CONFIGS[ball.spinType].color);
      const len = Math.min(ball.trail.length, MAX_TRAIL);

      for (let i = 0; i < len; i++) {
        const p = ball.trail[ball.trail.length - len + i];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const alpha = i / len;
        colors[i * 3] = color.r * alpha;
        colors[i * 3 + 1] = color.g * alpha;
        colors[i * 3 + 2] = color.b * alpha;
      }

      const geom = trailRef.current.geometry;
      geom.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, len * 3), 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, len * 3), 3));
      geom.setDrawRange(0, len);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[BALL.radius, 8, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {ball.isInPlay && (
        <points ref={trailRef}>
          <bufferGeometry />
          <pointsMaterial size={0.012} vertexColors transparent opacity={0.7} />
        </points>
      )}
    </group>
  );
}

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { SPIN_CONFIGS, BALL } from '../../engine/types';

export function Ball() {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);
  const ball = useGameStore((s) => s.ball);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.set(ball.position.x, ball.position.y, ball.position.z);

    if (ball.spin.x !== 0) meshRef.current.rotation.x += ball.spin.x * 0.0001;
    if (ball.spin.y !== 0) meshRef.current.rotation.y += ball.spin.y * 0.0001;

    if (trailRef.current) {
      const positions = new Float32Array(ball.trail.length * 3);
      const colors = new Float32Array(ball.trail.length * 3);
      const color = new THREE.Color(SPIN_CONFIGS[ball.spinType].color);

      ball.trail.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const alpha = i / ball.trail.length;
        colors[i * 3] = color.r * alpha;
        colors[i * 3 + 1] = color.g * alpha;
        colors[i * 3 + 2] = color.b * alpha;
      });

      trailRef.current.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
      trailRef.current.geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colors, 3)
      );
    }
  });

  const spinColor = SPIN_CONFIGS[ball.spinType].color;

  return (
    <group>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[BALL.radius, 16, 16]} />
        <meshStandardMaterial color="white" roughness={0.3} />
      </mesh>

      {ball.isInPlay && (
        <>
          <pointLight
            position={[ball.position.x, ball.position.y, ball.position.z]}
            color={spinColor}
            intensity={0.5}
            distance={2}
          />
          <points ref={trailRef}>
            <bufferGeometry />
            <pointsMaterial size={0.01} vertexColors transparent opacity={0.7} />
          </points>
        </>
      )}
    </group>
  );
}

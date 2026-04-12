import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SPIN_CONFIGS, SpinType } from '../../engine/types';

interface PaddleProps {
  position: [number, number, number];
  isPlayer: boolean;
  spinType: SpinType;
  targetX?: number;
}

export function Paddle({ position, isPlayer, spinType, targetX }: PaddleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const color = SPIN_CONFIGS[spinType].color;

  useFrame(() => {
    if (!groupRef.current) return;

    if (targetX !== undefined) {
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetX,
        0.15
      );
    }
    groupRef.current.position.y = position[1];
    groupRef.current.position.z = position[2];

    if (glowRef.current) {
      const t = Date.now() * 0.003;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(t) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Handle */}
      <mesh position={[0, 0.05, isPlayer ? 0.06 : -0.06]}>
        <cylinderGeometry args={[0.015, 0.018, 0.1, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.6} />
      </mesh>

      {/* Blade */}
      <mesh castShadow>
        <boxGeometry args={[0.15, 0.17, 0.01]} />
        <meshStandardMaterial color="#222" roughness={0.4} />
      </mesh>

      {/* Red rubber side (facing opponent) */}
      <mesh position={[0, 0, isPlayer ? -0.006 : 0.006]}>
        <boxGeometry args={[0.14, 0.16, 0.003]} />
        <meshStandardMaterial color={isPlayer ? '#cc2222' : '#cc2222'} roughness={0.7} />
      </mesh>

      {/* Black rubber side (facing player) */}
      <mesh position={[0, 0, isPlayer ? 0.006 : -0.006]}>
        <boxGeometry args={[0.14, 0.16, 0.003]} />
        <meshStandardMaterial color="#111" roughness={0.8} />
      </mesh>

      {/* Spin glow indicator */}
      <mesh ref={glowRef} position={[0, 0, isPlayer ? -0.01 : 0.01]}>
        <boxGeometry args={[0.16, 0.18, 0.001]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

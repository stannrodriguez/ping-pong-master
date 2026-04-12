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
  const color = SPIN_CONFIGS[spinType].color;

  useFrame(() => {
    if (!groupRef.current) return;
    if (targetX !== undefined) {
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.15);
    }
    groupRef.current.position.y = position[1];
    groupRef.current.position.z = position[2];
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Handle */}
      <mesh position={[0, 0.05, isPlayer ? 0.06 : -0.06]}>
        <cylinderGeometry args={[0.015, 0.018, 0.1, 6]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Blade with rubber */}
      <mesh>
        <boxGeometry args={[0.15, 0.17, 0.01]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 0, isPlayer ? -0.006 : 0.006]}>
        <boxGeometry args={[0.14, 0.16, 0.003]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

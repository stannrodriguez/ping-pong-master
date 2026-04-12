import { TABLE } from '../../engine/types';

export function PingPongTable() {
  const { width, length, surfaceY, netHeight, netThickness } = TABLE;

  return (
    <group>
      {/* Table surface */}
      <mesh position={[0, surfaceY - 0.05, 0]} receiveShadow>
        <boxGeometry args={[width, 0.1, length]} />
        <meshStandardMaterial color="#1a6b3c" roughness={0.3} />
      </mesh>

      {/* White border lines */}
      {/* End lines */}
      <mesh position={[0, surfaceY + 0.001, length / 2 - 0.01]}>
        <boxGeometry args={[width, 0.002, 0.02]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, surfaceY + 0.001, -length / 2 + 0.01]}>
        <boxGeometry args={[width, 0.002, 0.02]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Side lines */}
      <mesh position={[width / 2 - 0.01, surfaceY + 0.001, 0]}>
        <boxGeometry args={[0.02, 0.002, length]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-width / 2 + 0.01, surfaceY + 0.001, 0]}>
        <boxGeometry args={[0.02, 0.002, length]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Center line (for doubles/serves) */}
      <mesh position={[0, surfaceY + 0.001, 0]}>
        <boxGeometry args={[0.02, 0.002, length]} />
        <meshStandardMaterial color="white" opacity={0.3} transparent />
      </mesh>

      {/* Net */}
      <mesh position={[0, surfaceY + netHeight / 2, 0]}>
        <boxGeometry args={[width + 0.4, netHeight, netThickness]} />
        <meshStandardMaterial color="#dddddd" transparent opacity={0.85} />
      </mesh>

      {/* Net posts */}
      <mesh position={[width / 2 + 0.15, surfaceY + netHeight / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, netHeight + 0.02, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.8} />
      </mesh>
      <mesh position={[-width / 2 - 0.15, surfaceY + netHeight / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, netHeight + 0.02, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.8} />
      </mesh>

      {/* Legs */}
      {[
        [width / 2 - 0.1, -length / 2 + 0.3],
        [-width / 2 + 0.1, -length / 2 + 0.3],
        [width / 2 - 0.1, length / 2 - 0.3],
        [-width / 2 + 0.1, length / 2 - 0.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, surfaceY / 2 - 0.05, z]}>
          <boxGeometry args={[0.06, surfaceY, 0.06]} />
          <meshStandardMaterial color="#333" metalness={0.6} />
        </mesh>
      ))}

      {/* Floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>
    </group>
  );
}

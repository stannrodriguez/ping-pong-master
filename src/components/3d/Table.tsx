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

      {/* End lines */}
      <mesh position={[0, surfaceY + 0.001, length / 2 - 0.01]}>
        <boxGeometry args={[width, 0.002, 0.02]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0, surfaceY + 0.001, -length / 2 + 0.01]}>
        <boxGeometry args={[width, 0.002, 0.02]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Net */}
      <mesh position={[0, surfaceY + netHeight / 2, 0]}>
        <boxGeometry args={[width + 0.4, netHeight, netThickness]} />
        <meshStandardMaterial color="#dddddd" transparent opacity={0.85} />
      </mesh>

      {/* Net posts */}
      <mesh position={[width / 2 + 0.15, surfaceY + netHeight / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, netHeight + 0.02, 6]} />
        <meshBasicMaterial color="#666666" />
      </mesh>
      <mesh position={[-width / 2 - 0.15, surfaceY + netHeight / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, netHeight + 0.02, 6]} />
        <meshBasicMaterial color="#666666" />
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
          <meshBasicMaterial color="#333" />
        </mesh>
      ))}
    </group>
  );
}

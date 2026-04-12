export function GameEnvironment() {
  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <pointLight position={[0, 4, 0]} intensity={0.4} color="#fff5e6" />

      {/* Back wall */}
      <mesh position={[0, 4, -8]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#0f1b33" />
      </mesh>

      {/* Floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#1a1a2e" />
      </mesh>
    </group>
  );
}

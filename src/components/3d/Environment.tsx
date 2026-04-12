export function GameEnvironment() {
  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#fff5e6" />
      <pointLight position={[-3, 3, -3]} intensity={0.3} color="#aaccff" />
      <pointLight position={[3, 3, 3]} intensity={0.3} color="#ffaacc" />

      {/* Back wall */}
      <mesh position={[0, 4, -8]} receiveShadow>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#0f1b33" roughness={0.9} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-8, 4, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#0f1b33" roughness={0.9} />
      </mesh>
      <mesh position={[8, 4, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#0f1b33" roughness={0.9} />
      </mesh>
    </group>
  );
}

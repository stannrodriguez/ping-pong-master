/**
 * The first-person 3D scene for the Return Trainer.
 *
 * Camera at the receiver's eye line behind the +z end of the table; the opponent
 * serves from -z. Everything that moves is driven by one clock inside `useFrame`,
 * sampling the same trajectories the grading uses — the scene is a *view* of the
 * simulation, never a second physics.
 *
 * This is a depiction, not a chart, so the app's charting rules (uniform
 * metres-per-pixel, three-hue limit) don't apply here — but colours still reuse the
 * app's tokens (as literals: CSS variables can't reach WebGL materials), and every
 * judgment cue (trail, spin axis, strike zone) can be switched off, because reading
 * the ball with no aids is the skill being trained.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

import {
  BALL,
  TABLE,
  TABLE_HALF_LENGTH,
  TABLE_HALF_WIDTH,
  sampleAt,
  type Trajectory,
  type Vec3,
} from '../physics';
import type { ServeRep } from './serves';
import { racketFor, type ReturnResult, type StrokeChoice } from './strokes';
import { bounceSound, missSound, racketSound } from './audio';

export type ScenePhase = 'idle' | 'toss' | 'flight' | 'hold' | 'return' | 'done';

export interface SceneCallbacks {
  onTossDone: () => void;
  /** The ball has bounced on the receiver's half — the read deadline. */
  onBounce: () => void;
  /** The ball has reached the contact point. */
  onBallArrived: () => void;
  /** The return (or the miss) has finished playing out. */
  onReturnDone: () => void;
}

interface SceneProps extends SceneCallbacks {
  rep: ServeRep | null;
  phase: ScenePhase;
  playbackRate: number;
  cues: boolean;
  /** Hovered or locked choice — poses the first-person racket. */
  preview: StrokeChoice | null;
  returnResult: ReturnResult | null;
  /** The serve with its spin removed, drawn after the reveal. */
  ghost: Trajectory | null;
}

const COLOR = {
  // Literal copies of the app's tokens — CSS variables don't reach WebGL.
  accent: '#9085e9',
  good: '#199e70',
  bad: '#e34948',
  none: '#8b90a0',
  table: '#274e75',
  tableLine: '#dfe3ea',
  floor: '#0b0c0f',
  fog: '#0f1114',
  ball: '#f7f4ea',
  rubber: '#a83a3a',
  rubberBack: '#16181c',
  wood: '#8a6c48',
} as const;

const TOSS_DURATION = 0.9;
const RETURN_WINDUP = 0.18;

const toVector = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);

/** Decimated Vector3 points for a trajectory path line. */
function pathPoints(trajectory: Trajectory, until = Infinity): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < trajectory.samples.length; i += 2) {
    const s = trajectory.samples[i];
    if (s.t > until) break;
    points.push(toVector(s.position));
  }
  return points.length >= 2 ? points : [];
}

/**
 * Orient a blade: local +Y becomes the face normal, and the handle (local +Z) is
 * kept pointing as much toward low-and-behind (the player's hand) as the normal
 * allows. Removes the twist ambiguity a plain quaternion-from-normal would have.
 */
function bladeQuaternion(normal: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const y = normal.clone().normalize();
  const handleHint = new THREE.Vector3(0, -0.55, 0.84);
  const z = handleHint.sub(y.clone().multiplyScalar(handleHint.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** A racket: red rubber facing local +Y, black backing, wooden handle at local +Z. */
function Blade() {
  return (
    <group>
      <mesh position={[0, 0.0023, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.0045, 36]} />
        <meshStandardMaterial color={COLOR.rubber} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.0023, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.0045, 36]} />
        <meshStandardMaterial color={COLOR.rubberBack} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.125]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.017, 0.1, 12]} />
        <meshStandardMaterial color={COLOR.wood} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Table() {
  const lineY = 0.0012;
  const lines: Array<{ position: [number, number, number]; size: [number, number] }> = [
    { position: [0, lineY, TABLE_HALF_LENGTH - 0.01], size: [TABLE.width, 0.02] },
    { position: [0, lineY, -TABLE_HALF_LENGTH + 0.01], size: [TABLE.width, 0.02] },
    { position: [TABLE_HALF_WIDTH - 0.01, lineY, 0], size: [0.02, TABLE.length] },
    { position: [-TABLE_HALF_WIDTH + 0.01, lineY, 0], size: [0.02, TABLE.length] },
    { position: [0, lineY, 0], size: [0.006, TABLE.length] }, // centre line
  ];
  const legX = TABLE_HALF_WIDTH - 0.12;
  const legZ = TABLE_HALF_LENGTH - 0.25;
  return (
    <group>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[TABLE.width, 0.04, TABLE.length]} />
        <meshStandardMaterial color={COLOR.table} roughness={0.6} />
      </mesh>
      {lines.map((line, i) => (
        <mesh key={i} position={line.position} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={line.size} />
          <meshBasicMaterial color={COLOR.tableLine} />
        </mesh>
      ))}
      {[-legX, legX].map((x) =>
        [-legZ, legZ].map((z) => (
          <mesh key={`${x}${z}`} position={[x, -TABLE.height / 2 - 0.02, z]}>
            <boxGeometry args={[0.05, TABLE.height - 0.04, 0.05]} />
            <meshStandardMaterial color="#1c2027" roughness={0.8} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Net() {
  const span = TABLE.width + 2 * TABLE.netOverhang;
  return (
    <group>
      <mesh position={[0, TABLE.netHeight / 2, 0]}>
        <planeGeometry args={[span, TABLE.netHeight]} />
        <meshStandardMaterial
          color="#232733"
          transparent
          opacity={0.62}
          side={THREE.DoubleSide}
          roughness={1}
        />
      </mesh>
      <mesh position={[0, TABLE.netHeight - 0.006, 0]}>
        <boxGeometry args={[span, 0.012, 0.006]} />
        <meshBasicMaterial color={COLOR.tableLine} />
      </mesh>
      {[-span / 2, span / 2].map((x) => (
        <mesh key={x} position={[x, TABLE.netHeight / 2, 0]}>
          <cylinderGeometry args={[0.011, 0.011, TABLE.netHeight + 0.05, 10]} />
          <meshStandardMaterial color="#3a3f4c" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** A flat ring on the playing surface marking where a ball bounced. */
function BounceRing({
  position,
  color,
  visible,
}: {
  position: Vec3;
  color: string;
  visible: boolean;
}) {
  return (
    <mesh position={[position.x, 0.002, position.z]} rotation={[-Math.PI / 2, 0, 0]} visible={visible}>
      <ringGeometry args={[0.026, 0.042, 28]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

const TRAIL_LENGTH = 26;

function SceneInner({
  rep,
  phase,
  playbackRate,
  cues,
  preview,
  returnResult,
  ghost,
  onTossDone,
  onBounce,
  onBallArrived,
  onReturnDone,
}: SceneProps) {
  const camera = useThree((state) => state.camera);

  const ballRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const racketRef = useRef<THREE.Group>(null);
  const opponentRef = useRef<THREE.Group>(null);
  const spinAxisRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);

  const clockRef = useRef({ toss: 0, serve: 0, ret: -RETURN_WINDUP });
  const notifiedRef = useRef({ toss: false, bounce: false, arrived: false, returned: false });
  const soundedRef = useRef(new Set<string>());
  const trailBufferRef = useRef<THREE.Vector3[]>([]);
  const scratch = useRef({
    ball: new THREE.Vector3(),
    target: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    spinAxis: new THREE.Vector3(),
    matrix: new THREE.Matrix4(),
  });

  // A new rep starts every clock and marker over.
  useEffect(() => {
    clockRef.current = { toss: 0, serve: 0, ret: -RETURN_WINDUP };
    notifiedRef.current = { toss: false, bounce: false, arrived: false, returned: false };
    soundedRef.current.clear();
    trailBufferRef.current = [];
  }, [rep]);

  // Replays re-enter 'toss'; a fresh return re-enters 'return'.
  useEffect(() => {
    if (phase === 'toss') {
      clockRef.current = { toss: 0, serve: 0, ret: -RETURN_WINDUP };
      notifiedRef.current = { toss: false, bounce: false, arrived: false, returned: false };
      soundedRef.current.clear();
      trailBufferRef.current = [];
    }
    if (phase === 'return') {
      clockRef.current.ret = -RETURN_WINDUP;
      notifiedRef.current.returned = false;
    }
  }, [phase]);

  const racketPlane = useMemo(
    () => (preview ? racketFor(preview) : racketFor({ stroke: 'drive', aim: 'straight' })),
    [preview],
  );

  const serveEvents = useMemo(
    () => (rep ? rep.trajectory.events.filter((e) => e.kind === 'bounce') : []),
    [rep],
  );
  const returnEndT = returnResult
    ? Math.min(returnResult.trajectory.duration, 1.9)
    : 0;

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const clocks = clockRef.current;
    const notified = notifiedRef.current;
    const s = scratch.current;
    if (!rep) return;

    // --- Advance the phase clock and place the ball -----------------------------
    let ballState = sampleAt(rep.trajectory, 0);
    let ballVisible = true;

    if (phase === 'toss') {
      clocks.toss += dt; // The toss plays in real time regardless of playback rate.
      const k = Math.min(clocks.toss / TOSS_DURATION, 1);
      const launch = rep.launch.position;
      ballState = {
        ...ballState,
        position: { x: launch.x, y: launch.y + 1.4 * k * (1 - k), z: launch.z },
      };
      if (k >= 1 && !notified.toss) {
        notified.toss = true;
        racketSound();
        onTossDone();
      }
    } else if (phase === 'flight' || phase === 'hold') {
      if (phase === 'flight') clocks.serve += dt * playbackRate;
      const t = Math.min(clocks.serve, rep.contactT);
      ballState = sampleAt(rep.trajectory, t);

      for (const event of serveEvents) {
        if (event.t <= t && !soundedRef.current.has(`serve${event.t}`)) {
          soundedRef.current.add(`serve${event.t}`);
          bounceSound();
        }
      }
      if (!notified.bounce && t >= rep.receiverBounceT) {
        notified.bounce = true;
        onBounce();
      }
      if (phase === 'flight' && !notified.arrived && clocks.serve >= rep.contactT) {
        notified.arrived = true;
        onBallArrived();
      }
    } else if (phase === 'return' || phase === 'done') {
      if (phase === 'return') clocks.ret += dt * playbackRate;
      if (!returnResult) {
        // No stroke was played (a missed read at match speed): the serve just
        // carries on past the receiver.
        const t = Math.min(clocks.serve + Math.max(clocks.ret, 0) + RETURN_WINDUP, rep.trajectory.duration);
        if (phase === 'return') {
          ballState = sampleAt(rep.trajectory, rep.contactT + Math.max(clocks.ret + RETURN_WINDUP, 0));
          if (!notified.returned && clocks.ret > 0.6) {
            notified.returned = true;
            missSound();
            onReturnDone();
          }
          void t;
        } else {
          ballVisible = false;
        }
      } else {
        const t = Math.max(Math.min(clocks.ret, returnEndT), 0);
        ballState = t === 0 && clocks.ret < 0 ? rep.contact : sampleAt(returnResult.trajectory, t);
        if (clocks.ret >= 0 && !soundedRef.current.has('strike')) {
          soundedRef.current.add('strike');
          racketSound();
        }
        for (const event of returnResult.trajectory.events) {
          if (event.t <= t && event.t > 0 && !soundedRef.current.has(`ret${event.t}`)) {
            soundedRef.current.add(`ret${event.t}`);
            if (event.kind === 'bounce') bounceSound();
            else if (event.kind === 'net' || event.kind === 'floor') missSound();
          }
        }
        if (phase === 'return' && !notified.returned && clocks.ret > returnEndT + 0.45) {
          notified.returned = true;
          onReturnDone();
        }
      }
    } else if (phase === 'idle') {
      ballVisible = false;
    }

    // --- Ball, spin, shadow, trail ----------------------------------------------
    const ball = ballRef.current;
    if (ball) {
      ball.visible = ballVisible;
      s.ball.set(ballState.position.x, ballState.position.y, ballState.position.z);
      ball.position.copy(s.ball);

      const spinRate = Math.hypot(ballState.spin.x, ballState.spin.y, ballState.spin.z);
      if (spinRate > 1e-6 && phase !== 'idle') {
        s.spinAxis.set(ballState.spin.x, ballState.spin.y, ballState.spin.z).divideScalar(spinRate);
        s.quat.setFromAxisAngle(s.spinAxis, spinRate * dt * playbackRate);
        ball.quaternion.premultiply(s.quat);
      }

      const axis = spinAxisRef.current;
      if (axis) {
        const showAxis = cues && spinRate > 30 && (phase === 'flight' || phase === 'hold');
        axis.visible = showAxis;
        if (showAxis) {
          axis.position.copy(s.ball);
          axis.quaternion.copy(
            s.quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.spinAxis),
          );
        }
      }
    }

    const shadow = shadowRef.current;
    if (shadow) {
      const overTable =
        Math.abs(ballState.position.x) <= TABLE_HALF_WIDTH &&
        Math.abs(ballState.position.z) <= TABLE_HALF_LENGTH;
      const groundY = overTable ? 0.0016 : -TABLE.height + 0.0016;
      const height = ballState.position.y - groundY;
      shadow.visible = ballVisible && height < 1.4;
      shadow.position.set(ballState.position.x, groundY, ballState.position.z);
      const spread = 1 + height * 0.9;
      shadow.scale.set(spread, spread, spread);
      (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.04, 0.32 - height * 0.2);
    }

    const trail = trailRef.current;
    if (trail) {
      const active = cues && ballVisible && (phase === 'flight' || phase === 'return');
      if (active) {
        trailBufferRef.current.push(s.ball.clone());
        if (trailBufferRef.current.length > TRAIL_LENGTH) trailBufferRef.current.shift();
      }
      const buffer = trailBufferRef.current;
      trail.count = cues ? buffer.length : 0;
      for (let i = 0; i < buffer.length; i++) {
        const age = (i + 1) / buffer.length; // 1 = newest
        s.matrix.makeScale(age * 0.75, age * 0.75, age * 0.75).setPosition(buffer[i]);
        trail.setMatrixAt(i, s.matrix);
      }
      trail.instanceMatrix.needsUpdate = true;
    }

    // --- First-person racket ------------------------------------------------------
    const racket = racketRef.current;
    if (racket) {
      // Only during the stroke itself — in 'done' the racket eases home so the
      // revealed paths aren't hidden behind the blade.
      const striking = phase === 'return' && returnResult;
      if (striking) {
        const n = racketPlane.normal;
        const contact = rep.contact.position;
        const back = BALL.radius + 0.0075;
        s.target.set(contact.x - n.x * back, contact.y - n.y * back, contact.z - n.z * back);
        const swing = Math.max(Math.min(clocks.ret, 0.12), -RETURN_WINDUP);
        if (swing < 0) {
          // Winding up: hang back along the (reversed) stroke direction.
          const wind = -swing / RETURN_WINDUP;
          s.target.addScaledVector(
            new THREE.Vector3(racketPlane.velocity.x, racketPlane.velocity.y, racketPlane.velocity.z),
            -0.075 * wind,
          );
        } else {
          // Follow through along the stroke.
          s.target.addScaledVector(
            new THREE.Vector3(racketPlane.velocity.x, racketPlane.velocity.y, racketPlane.velocity.z),
            swing * 0.55,
          );
        }
        racket.position.lerp(s.target, Math.min(1, dt * 26));
      } else {
        s.target.set(0.36, 0.3, 1.98);
        racket.position.lerp(s.target, Math.min(1, dt * 10));
      }
      bladeQuaternion(
        s.spinAxis.set(racketPlane.normal.x, racketPlane.normal.y, racketPlane.normal.z),
        s.quat,
      );
      racket.quaternion.slerp(s.quat, Math.min(1, dt * 12));
    }

    // --- Opponent's racket, animating the serve strike ----------------------------
    const opponent = opponentRef.current;
    if (opponent) {
      const launch = rep.launch.position;
      if (phase === 'toss') {
        const k = Math.min(clocks.toss / TOSS_DURATION, 1);
        const strike = k > 0.78 ? (k - 0.78) / 0.22 : 0;
        opponent.position.set(launch.x, launch.y - 0.02, launch.z - 0.3 + strike * 0.26);
      } else {
        opponent.position.lerp(s.target.set(launch.x, launch.y - 0.02, launch.z - 0.3), dt * 3);
      }
    }

    // --- Camera: a hint of head-tracking toward the ball --------------------------
    const followX = THREE.MathUtils.clamp(ballState.position.x * 0.3, -0.3, 0.3);
    camera.position.x += (followX - camera.position.x) * Math.min(1, dt * 4);
    camera.lookAt(followX * 0.4, 0.0, -0.3);
  });

  const opponentQuat = useMemo(() => {
    const q = new THREE.Quaternion();
    return bladeQuaternion(new THREE.Vector3(0, 0.25, 1).normalize(), q);
  }, []);

  return (
    <>
      <fog attach="fog" args={[COLOR.fog, 7.5, 14]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.35} />
      <pointLight position={[0, 2.4, 0.4]} intensity={9} distance={7} />

      <Table />
      <Net />
      <mesh position={[0, -TABLE.height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color={COLOR.floor} roughness={1} />
      </mesh>

      {/* The ball, with sticker dots so its spin reads as rotation. */}
      <group ref={ballRef} visible={false}>
        <mesh>
          <sphereGeometry args={[BALL.radius, 28, 20]} />
          <meshStandardMaterial color={COLOR.ball} roughness={0.4} emissive={COLOR.ball} emissiveIntensity={0.18} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={side} position={[0, 0, side * (BALL.radius - 0.0006)]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <circleGeometry args={[0.008, 16]} />
            <meshBasicMaterial color={COLOR.accent} />
          </mesh>
        ))}
      </group>

      {/* Blob shadow — the depth cue that makes the approach readable. */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[BALL.radius * 1.15, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>

      {/* Flight trail (a learning cue; off in match mode). */}
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL_LENGTH]} frustumCulled={false}>
        <sphereGeometry args={[0.008, 8, 6]} />
        <meshBasicMaterial color={COLOR.accent} transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>

      {/* Spin axis cue (learning mode): the rotation axis, arrowhead by right-hand rule. */}
      <group ref={spinAxisRef} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.0022, 0.0022, 0.11, 8]} />
          <meshBasicMaterial color={COLOR.accent} />
        </mesh>
        <mesh position={[0, 0.062, 0]}>
          <coneGeometry args={[0.007, 0.018, 10]} />
          <meshBasicMaterial color={COLOR.accent} />
        </mesh>
      </group>

      {/* Where the ball will be taken — visible while the choice is open. */}
      {rep && cues && phase === 'flight' && (
        <mesh
          position={[rep.contact.position.x, rep.contact.position.y, rep.contact.position.z]}
          rotation={[0, 0, 0]}
        >
          <ringGeometry args={[0.03, 0.036, 24]} />
          <meshBasicMaterial color={COLOR.none} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Serve bounce marks appear as they happen; the return's landing after it lands. */}
      {rep &&
        serveEvents.map((event) => (
          <BounceRing
            key={event.t}
            position={event.position}
            color={COLOR.accent}
            visible={phase !== 'idle' && phase !== 'toss' && clockRef.current.serve >= event.t}
          />
        ))}
      {returnResult?.trajectory.landing && phase === 'done' && (
        <BounceRing position={returnResult.trajectory.landing} color={COLOR.good} visible />
      )}

      {/* After the reveal: the serve's real path against its no-spin ghost, and the return. */}
      {phase === 'done' && rep && (
        <>
          <Line points={pathPoints(rep.trajectory, rep.contactT)} color={COLOR.accent} lineWidth={1.6} />
          {ghost && ghost.samples.length > 4 && (
            <Line
              points={pathPoints(ghost)}
              color={COLOR.none}
              lineWidth={1.1}
              dashed
              dashSize={0.035}
              gapSize={0.03}
            />
          )}
          {returnResult && (
            <Line
              points={pathPoints(returnResult.trajectory, returnEndT)}
              color={returnResult.outcome === 'landed' ? COLOR.good : COLOR.bad}
              lineWidth={1.6}
            />
          )}
        </>
      )}

      {/* The opponent's racket. */}
      <group ref={opponentRef} quaternion={opponentQuat} visible={phase !== 'idle'}>
        <Blade />
      </group>

      {/* Your racket. */}
      <group ref={racketRef} position={[0.36, 0.3, 1.98]}>
        <Blade />
      </group>
    </>
  );
}

export function TrainerScene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.62, 2.48], fov: 60, near: 0.05, far: 30 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      style={{ background: COLOR.fog, borderRadius: 'var(--radius-lg)' }}
    >
      <SceneInner {...props} />
    </Canvas>
  );
}

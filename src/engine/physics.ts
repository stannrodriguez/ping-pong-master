import { Vec3, BallState, SpinType, BALL, TABLE, GAME, SPIN_CONFIGS } from './types';

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scaleVec3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function lengthVec3(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalizeVec3(v: Vec3): Vec3 {
  const l = lengthVec3(v);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function magnusForce(spin: Vec3, velocity: Vec3): Vec3 {
  const cross = crossVec3(spin, velocity);
  return scaleVec3(cross, BALL.magnusCoeff);
}

function dragForce(velocity: Vec3): Vec3 {
  const speed = lengthVec3(velocity);
  if (speed === 0) return vec3();
  const dir = normalizeVec3(velocity);
  const drag = -BALL.dragCoeff * speed * speed * 0.001;
  return scaleVec3(dir, drag);
}

export function createInitialBall(): BallState {
  return {
    position: vec3(0, TABLE.surfaceY + 0.3, TABLE.length / 2 - 1),
    velocity: vec3(),
    spin: vec3(),
    spinType: 'flat',
    isServing: true,
    lastHitBy: null,
    trail: [],
    bounceCount: 0,
    isInPlay: false,
  };
}

export function serveBall(ball: BallState, spinType: SpinType, isPlayer: boolean): BallState {
  const cfg = SPIN_CONFIGS[spinType];
  const dir = isPlayer ? 1 : -1;

  const xSpread = (Math.random() - 0.5) * 0.5;

  return {
    ...ball,
    position: vec3(
      xSpread,
      TABLE.surfaceY + 0.3,
      isPlayer ? TABLE.length / 2 - 1 : -TABLE.length / 2 + 1
    ),
    velocity: vec3(xSpread * 0.5, 2.0, -dir * GAME.serveSpeed),
    spin: { ...cfg.rpm },
    spinType,
    isServing: false,
    lastHitBy: isPlayer ? 'player' : 'opponent',
    trail: [],
    bounceCount: 0,
    isInPlay: true,
  };
}

export function hitBall(
  ball: BallState,
  spinType: SpinType,
  paddleX: number,
  isPlayer: boolean,
): BallState {
  const cfg = SPIN_CONFIGS[spinType];
  const dir = isPlayer ? 1 : -1;

  const offsetX = (ball.position.x - paddleX);
  const speed = GAME.returnSpeed + Math.random() * 1.5;

  let vy = 2.0;
  if (spinType === 'topspin') vy = 1.5;
  if (spinType === 'backspin') vy = 2.8;

  return {
    ...ball,
    velocity: vec3(offsetX * 2.5, vy, -dir * speed),
    spin: { ...cfg.rpm },
    spinType,
    lastHitBy: isPlayer ? 'player' : 'opponent',
    trail: [],
    bounceCount: 0,
  };
}

export function stepBall(ball: BallState, dt: number): BallState {
  if (!ball.isInPlay) return ball;

  const gravity = vec3(0, GAME.gravity, 0);
  const magnus = magnusForce(ball.spin, ball.velocity);
  const drag = dragForce(ball.velocity);

  const totalAccel = addVec3(addVec3(gravity, magnus), drag);

  let newVel = addVec3(ball.velocity, scaleVec3(totalAccel, dt));
  const newPos = addVec3(ball.position, scaleVec3(newVel, dt));

  const speed = lengthVec3(newVel);
  if (speed > GAME.maxBallSpeed) {
    newVel = scaleVec3(normalizeVec3(newVel), GAME.maxBallSpeed);
  }

  let bounceCount = ball.bounceCount;

  if (newPos.y <= TABLE.surfaceY + BALL.radius) {
    const halfW = TABLE.width / 2;
    const halfL = TABLE.length / 2;

    if (Math.abs(newPos.x) <= halfW && Math.abs(newPos.z) <= halfL) {
      newPos.y = TABLE.surfaceY + BALL.radius;
      newVel.y = Math.abs(newVel.y) * BALL.restitution;

      if (ball.spinType === 'topspin') {
        newVel.z *= 1.15;
        newVel.y *= 0.85;
      } else if (ball.spinType === 'backspin') {
        newVel.z *= 0.75;
        newVel.y *= 1.1;
      } else if (ball.spinType === 'sidespin-left') {
        newVel.x -= 1.0;
      } else if (ball.spinType === 'sidespin-right') {
        newVel.x += 1.0;
      }

      bounceCount++;
    }
  }

  // Net collision — only if ball is below net height
  const netZ = 0;
  const prevZ = ball.position.z;
  if ((prevZ < netZ && newPos.z >= netZ) || (prevZ > netZ && newPos.z <= netZ)) {
    if (newPos.y < TABLE.surfaceY + TABLE.netHeight + BALL.radius) {
      return {
        ...ball,
        position: newPos,
        velocity: vec3(newVel.x * 0.1, 0.5, -newVel.z * 0.1),
        bounceCount,
        isInPlay: false,
        trail: [...ball.trail.slice(-GAME.trailLength + 1), { ...newPos }],
      };
    }
  }

  const trail = [...ball.trail.slice(-GAME.trailLength + 1), { ...newPos }];

  return {
    ...ball,
    position: newPos,
    velocity: newVel,
    bounceCount,
    trail,
  };
}

export function checkPoint(ball: BallState): 'player' | 'opponent' | null {
  if (!ball.isInPlay && ball.velocity.y <= 0 && ball.position.y < TABLE.surfaceY) {
    return ball.lastHitBy === 'player' ? 'opponent' : 'player';
  }

  const halfL = TABLE.length / 2;
  const halfW = TABLE.width / 2;

  if (ball.position.z < -halfL - 2) return 'player';
  if (ball.position.z > halfL + 2) return 'opponent';
  if (Math.abs(ball.position.x) > halfW + 3) {
    return ball.lastHitBy === 'player' ? 'opponent' : 'player';
  }

  if (ball.position.y < -1) {
    return ball.lastHitBy === 'player' ? 'opponent' : 'player';
  }

  return null;
}

export function predictLanding(ball: BallState, targetZ: number): { x: number; time: number } {
  let sim = { ...ball, position: { ...ball.position }, velocity: { ...ball.velocity }, spin: { ...ball.spin }, trail: [] as Vec3[] };
  const dt = GAME.dt;
  let time = 0;

  for (let i = 0; i < 300; i++) {
    const prev = sim.position.z;
    sim = stepBall(sim, dt) as any;
    time += dt;

    if ((prev < targetZ && sim.position.z >= targetZ) || (prev > targetZ && sim.position.z <= targetZ)) {
      return { x: sim.position.x, time };
    }
  }

  return { x: 0, time: 2 };
}

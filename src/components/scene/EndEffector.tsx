import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * Retrofit end effector for the OpenArm wrist.
 *
 * The URDF ships a pinch gripper; the demo hides its fingers and bolts on the
 * tool this application actually needs — a six-axis force puck, a vacuum
 * manifold, a small bellows cup, and (on the applicator arm) a sprung roller
 * that irons the patch down while following the curve of the back.
 *
 * Everything is modelled along local +Y and the whole head is then rotated so
 * +Y runs along -Z, which is the approach direction of the IK tool frame. The
 * sealing face of the cup sits at exactly TOOL_LENGTH, so the anchor published
 * through `onCup` *is* the tool control point: anything parented to it is
 * rigidly carried by the cup, with no chance of drifting off it.
 */

/** Distance from ee_base_link to the sealing face of the cup, in metres. */
export const TOOL_LENGTH = 0.16
/**
 * How far the wrist motor of link 6 reaches past ee_base_link along the tool
 * axis (measured off the URDF meshes). The head bolts onto that end face — at
 * the link origin it would be buried inside the motor housing.
 */
const MOUNT_OFFSET = 0.032
/** Tool length as laid out inside the head, i.e. from its own mounting face. */
const TOOL_STACK = TOOL_LENGTH - MOUNT_OFFSET

/** 機体と同じ黒〜グラファイト。金属だけアルミの明度で抜く。 */
const SHELL = '#3a4043'
const CHARCOAL = '#24282a'
const DARK = '#15181a'
const METAL = '#a9afb2'
const RUBBER = '#2a2d2f'

// ---------------------------------------------------------------- vacuum pad
/**
 * ø8 bellows pad — the part the dossier actually selected (φ8 × 2 @ −60 kPa →
 * 3.0 N). Modelled to the published section of a ø8 bellows pad: ø8 sealing
 * lip, ø8.8 over the convolutions, 7 mm tall, on a ø6 stem.
 */
const CUP_LIP = 0.0044
const CUP_SEAL = 0.004
const CUP_HEIGHT = 0.007

/**
 * Half-section of the bellows cup, closed so the lathe produces a hollow cup
 * with a real rim: up the outside through two and a half convolutions, over the
 * sealing lip, then back down the inner wall into the bore. Authored with the
 * lip at y = 0 so the cup can be compressed by scaling towards the face it
 * seals on.
 */
function bellowsProfile() {
  const outside: [number, number][] = [
    [0.003, -CUP_HEIGHT],
    [CUP_LIP, -0.006],
    [0.0028, -0.005],
    [CUP_LIP, -0.0038],
    [0.0029, -0.0028],
    [CUP_LIP, -0.0014],
    [CUP_SEAL, -0.0003],
    [CUP_SEAL, 0],
  ]
  const inside: [number, number][] = [
    [0.0032, -0.0001],
    [0.0029, -0.0008],
    [0.0026, -0.0018],
    [0.0022, -0.0028],
    [0.0014, -0.0034],
    [0.0012, -0.0044],
  ]
  return [...outside, ...inside].map(([x, y]) => new THREE.Vector2(x, y))
}

// -------------------------------------------------------------- press roller
const ROLLER_COUNT = 7
const ROLLER_RADIUS = 0.0102
const SEGMENT_WIDTH = 0.0084
const SEGMENT_PITCH = 0.0116
/** Hub flange, sized to show through the gap so the barrel reads as segmented. */
const HUB_RADIUS = 0.0074
/** How far a single roller segment can retreat into its spring, in metres. */
const SEGMENT_TRAVEL = 0.0038
const SPRING_LENGTH = 0.013
const HALF_SPAN = ((ROLLER_COUNT - 1) / 2) * SEGMENT_PITCH

/** Hinge of the deploy arm and, when deployed, the roller axle. */
const HINGE = new THREE.Vector2(0.054, -0.028)
const AXLE = new THREE.Vector2(TOOL_STACK - ROLLER_RADIUS, -0.045)
const ARM_LENGTH = Math.hypot(AXLE.x - HINGE.x, AXLE.y - HINGE.y)
/** Rotation about local X that swings the arm onto the back… */
const ARM_DEPLOYED = Math.atan2(AXLE.y - HINGE.y, AXLE.x - HINGE.x)
/** …and the rotation that folds it clear of the cup the rest of the time. */
const ARM_STOWED = ARM_DEPLOYED + 1.25

/** One coil spring, drawn once and reused by every roller segment. */
function useSpringGeometry() {
  const geometry = useMemo(() => {
    const turns = 4.5
    const radius = 0.0034
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 84; i += 1) {
      const t = i / 84
      const angle = t * turns * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * radius, t * SPRING_LENGTH, Math.sin(angle) * radius))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 84, 0.00068, 5, false)
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

interface RollerProps {
  /** 0 stowed, 1 swung out over the back. */
  deploy: number
  /** How hard the roller is loaded against the back. */
  load: number
  /** World-space travel of the head along its rolling direction, in metres. */
  travelRef: React.MutableRefObject<number>
}

/**
 * Compliance roller.
 *
 * A rigid roller can only touch a curved back along one line, so the barrel is
 * split into seven discs, each on its own sprung plunger. The discs nearest
 * the crown of the back are pushed furthest into their springs, which is what
 * lets a straight axle follow a convex surface and keeps the pressing load
 * spread across the whole width of the patch.
 */
function PressRoller({ deploy, load, travelRef }: RollerProps) {
  const arm = useRef<THREE.Group>(null)
  const rocker = useRef<THREE.Group>(null)
  const segments = useRef<(THREE.Group | null)[]>([])
  const springs = useRef<(THREE.Object3D | null)[]>([])
  const tyres = useRef<(THREE.Mesh | null)[]>([])
  const spring = useSpringGeometry()
  const spin = useRef(0)

  const offsets = useMemo(
    () => Array.from({ length: ROLLER_COUNT }, (_, index) => index * SEGMENT_PITCH - HALF_SPAN),
    [],
  )

  useFrame(() => {
    if (arm.current) arm.current.rotation.x = THREE.MathUtils.lerp(ARM_STOWED, ARM_DEPLOYED, deploy)
    // The yoke floats on its pivot, so the barrel lies down on whichever way
    // the back happens to slope rather than digging in with one end.
    if (rocker.current) rocker.current.rotation.z = load * 0.06

    spin.current -= travelRef.current / ROLLER_RADIUS
    offsets.forEach((offset, index) => {
      const u = offset / (HALF_SPAN || 1)
      const compression = SEGMENT_TRAVEL * (1 - u * u) * load
      const group = segments.current[index]
      if (group) group.position.y = ARM_LENGTH - compression
      const coil = springs.current[index]
      if (coil) coil.scale.y = (SPRING_LENGTH - compression) / SPRING_LENGTH
      const tyre = tyres.current[index]
      if (tyre) tyre.rotation.x = spin.current
    })
  })

  return (
    <group ref={arm} position={[0, HINGE.x, HINGE.y]}>
      {/* hinge boss the yoke swings on */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.0052, 0.0052, 0.05, 16]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>

      <group ref={rocker}>
        {/* yoke side plates */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * (HALF_SPAN + 0.0072), ARM_LENGTH / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.0032, ARM_LENGTH, 0.014]} />
            <meshStandardMaterial color={SHELL} />
          </mesh>
        ))}
        {/* spring plate the plungers slide through */}
        <mesh position={[0, ARM_LENGTH - SPRING_LENGTH, 0]} castShadow>
          <boxGeometry args={[HALF_SPAN * 2 + 0.017, 0.005, 0.0125]} />
          <meshStandardMaterial color={CHARCOAL} />
        </mesh>

        {offsets.map((offset, index) => (
          <group key={offset} position={[offset, 0, 0]}>
            {/* plunger guide the segment rides up and down on */}
            <mesh position={[0, ARM_LENGTH - SPRING_LENGTH / 2, 0]}>
              <cylinderGeometry args={[0.0016, 0.0016, SPRING_LENGTH + 0.004, 10]} />
              <meshStandardMaterial color={METAL} />
            </mesh>
            <object3D
              ref={(object) => {
                springs.current[index] = object
              }}
              position={[0, ARM_LENGTH - SPRING_LENGTH, 0]}
            >
              <mesh geometry={spring}>
                <meshStandardMaterial color="#9aa0a3" />
              </mesh>
            </object3D>

            <group
              ref={(group) => {
                segments.current[index] = group
              }}
              position={[0, ARM_LENGTH, 0]}
            >
              {/* hub flange, proud of the tyre so each disc reads separately */}
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[HUB_RADIUS, HUB_RADIUS, SEGMENT_WIDTH + 0.0026, 12]} />
                <meshStandardMaterial color={SHELL} />
              </mesh>
              <mesh
                ref={(mesh) => {
                  tyres.current[index] = mesh
                }}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[ROLLER_RADIUS, ROLLER_RADIUS, SEGMENT_WIDTH, 14]} />
                <meshStandardMaterial color={RUBBER} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

interface SuctionHeadProps {
  vacuum: number
  accent: string
  side: 'left' | 'right'
  /** Reported once the cup exists, so the patch can be parented to it. */
  onCup: (side: 'left' | 'right', cup: THREE.Object3D | null) => void
  roller?: { deploy: number; load: number }
}

export function SuctionHead({ vacuum, accent, side, onCup, roller }: SuctionHeadProps) {
  const cup = useRef<THREE.Object3D>(null)
  const head = useRef<THREE.Group>(null)
  const bellows = useRef<THREE.Group>(null)
  const indicator = useRef<THREE.MeshBasicMaterial>(null)
  const profile = useMemo(() => bellowsProfile(), [])
  const geometry = useMemo(() => new THREE.LatheGeometry(profile, 40), [profile])
  const travel = useRef(0)
  const seen = useRef(false)
  const previous = useMemo(() => new THREE.Vector3(), [])
  const worldPosition = useMemo(() => new THREE.Vector3(), [])
  const step = useMemo(() => new THREE.Vector3(), [])
  const rollDirection = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    onCup(side, cup.current)
    return () => onCup(side, null)
  }, [onCup, side])

  useFrame((state) => {
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 9 + (side === 'left' ? 0 : 1.6))
    if (indicator.current) indicator.current.opacity = vacuum * (0.5 + 0.5 * pulse)
    // The convolutions draw in when the line pulls down; the lip stays put
    // because the bellows is scaled towards the face it is sealing against.
    if (bellows.current) bellows.current.scale.y = 1 - vacuum * 0.16

    // Rolling is driven by how far the head actually moved along its own
    // rolling axis, so the roller stays in sync when the timeline is scrubbed.
    const group = head.current
    if (!group) return
    group.getWorldPosition(worldPosition)
    // The head is rotated so its local +Z is the direction the tool sweeps in.
    group.getWorldDirection(rollDirection)
    step.subVectors(worldPosition, previous)
    // A scrub teleports the head; cap the step so the barrel does not spin up.
    travel.current = seen.current ? THREE.MathUtils.clamp(step.dot(rollDirection), -0.02, 0.02) : 0
    previous.copy(worldPosition)
    seen.current = true
  })

  const hoseX = side === 'left' ? -1 : 1

  return (
    <group
      ref={head}
      position={[0, 0, -MOUNT_OFFSET]}
      rotation={[-Math.PI / 2, 0, 0]}
      userData={{ retrofit: true }}
    >
      {/* wrist adapter onto the gripper flange */}
      <mesh position={[0, 0.007, 0]} castShadow>
        <cylinderGeometry args={[0.0245, 0.026, 0.014, 32]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      {[0, 1, 2, 3].map((index) => {
        const angle = (index / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.0195, 0.0145, Math.sin(angle) * 0.0195]}
          >
            <cylinderGeometry args={[0.0022, 0.0022, 0.0022, 6]} />
            <meshStandardMaterial color={METAL} />
          </mesh>
        )
      })}

      {/* six-axis force / torque sensor */}
      <mesh position={[0, 0.029, 0]} castShadow>
        <cylinderGeometry args={[0.0215, 0.0215, 0.03, 32]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0.0345, 0]}>
        <cylinderGeometry args={[0.0221, 0.0221, 0.0045, 32]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.0465, 0]} castShadow>
        <cylinderGeometry args={[0.0235, 0.0235, 0.007, 32]} />
        <meshStandardMaterial color={SHELL} />
      </mesh>

      {/* vacuum manifold with its solenoid and line-pressure lamp */}
      <group position={[0, 0.068, 0]}>
        <RoundedBox args={[0.042, 0.034, 0.03]} radius={0.003} smoothness={2} castShadow>
          <meshStandardMaterial color={SHELL} />
        </RoundedBox>
        <mesh position={[0, 0.0185, -0.004]} castShadow>
          <boxGeometry args={[0.016, 0.008, 0.018]} />
          <meshStandardMaterial color={CHARCOAL} />
        </mesh>
        <mesh position={[0, 0.002, 0.0152]}>
          <circleGeometry args={[0.0032, 14]} />
          <meshBasicMaterial ref={indicator} color={accent} transparent opacity={0} toneMapped={false} />
        </mesh>

        {/* blanked-off vacuum port; the line runs inside the arm */}
        <mesh position={[hoseX * 0.021, 0.002, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.0052, 0.0062, 0.016, 14]} />
          <meshStandardMaterial color={METAL} />
        </mesh>
      </group>

      {/* stem down to the cup, with its coupling nut. The pad itself is only
          7 mm tall, so the stem is what makes up the rest of the tool length. */}
      <mesh position={[0, 0.0985, 0]} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, 0.027, 18]} />
        <meshStandardMaterial color={METAL} />
      </mesh>
      <mesh position={[0, 0.1145, 0]} castShadow>
        <cylinderGeometry args={[0.0078, 0.0078, 0.005, 6]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      {/* M5 pad adapter the cup screws onto */}
      <mesh position={[0, 0.1215, 0]} castShadow>
        <cylinderGeometry args={[0.0034, 0.0034, 0.008, 14]} />
        <meshStandardMaterial color={METAL} />
      </mesh>

      {/* bellows cup: authored with its lip at the origin, so scaling the group
          compresses the convolutions without moving the sealing face */}
      <group ref={bellows} position={[0, TOOL_STACK, 0]}>
        <mesh geometry={geometry} castShadow>
          <meshStandardMaterial color={RUBBER} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.0002, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.0032, CUP_SEAL, 28]} />
          <meshStandardMaterial color="#33383b" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {roller && <PressRoller deploy={roller.deploy} load={roller.load} travelRef={travel} />}

      {/* The tool control point. Undoing the head rotation leaves this frame
          aligned with the IK tool frame, so a patch parented here is carried
          by the cup exactly, whatever residual the solver leaves behind. */}
      <object3D ref={cup} position={[0, TOOL_STACK, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  )
}

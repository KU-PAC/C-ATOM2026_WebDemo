import { ContactShadows, Grid, Html, OrbitControls, RoundedBox, useProgress } from '@react-three/drei'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import URDFLoader, { type URDFRobot } from 'urdf-loader'

type CameraMode = 'overview' | 'detail'

interface PatchAssistSceneProps {
  progress: number
  cameraMode: CameraMode
}

type JointPose = Record<string, number>

interface Keyframe {
  at: number
  pose: JointPose
}

class OpenArmLoader extends THREE.Loader<URDFRobot> {
  load(
    url: string,
    onLoad: (robot: URDFRobot) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    const loader = new URDFLoader(this.manager)
    loader.packages = { openarm_description: '/models/openarm' }
    loader.parseCollision = false
    loader.load(url, onLoad, onProgress, onError)
  }
}

const left = (values: number[]) => Object.fromEntries(values.map((value, index) => [`openarm_left_joint${index + 1}`, value]))
const right = (values: number[]) => Object.fromEntries(values.map((value, index) => [`openarm_right_joint${index + 1}`, value]))

const pose = (leftArm: number[], rightArm: number[], fingers: [number, number]): JointPose => ({
  ...left(leftArm),
  ...right(rightArm),
  openarm_left_finger_joint1: fingers[0],
  openarm_right_finger_joint1: fingers[1],
})

const keyframes: Keyframe[] = [
  // Joint-space waypoints are generated against the upstream OpenArm 2.0 URDF.
  // The gripper-base targets and tool directions are solved within every URDF joint limit;
  // TreatmentPatch then samples the resulting world transforms instead of using a separate path.
  {
    at: 0,
    pose: pose(
      [1.3963, -0.9575, 0.1921, 1.7541, 0, 0, 0],
      [-1.3963, 0.9575, -0.1921, 1.7541, 0, 0, 0],
      [0.64, -0.64],
    ),
  },
  {
    at: 0.18,
    pose: pose(
      [0.9915, 0.0005, 0.3467, 0.7191, 0, 0, 0],
      [-0.9915, -0.0005, -0.3467, 0.7191, 0, 0, 0],
      [0.64, -0.64],
    ),
  },
  {
    at: 0.28,
    pose: pose(
      [0.9915, 0.0005, 0.3467, 0.7191, 0, 0, 0],
      [-0.9915, -0.0005, -0.3467, 0.7191, 0, 0, 0],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.36,
    pose: pose(
      [0.9915, 0.0005, 0.3467, 0.7191, 0, 0, 0],
      [-0.9915, -0.0005, -0.3467, 0.7191, 0, 0, 0],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.46,
    pose: pose(
      [0.9915, 0.0005, 0.3467, 0.7191, 0, 0, 0],
      [-1.3963, 0.4975, -0.4545, 1.6562, 0, 0, 0],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.52,
    pose: pose(
      [0.9915, 0.0005, 0.3467, 0.7191, 0, 0, 0],
      [-0.9915, -0.0005, -0.3467, 0.7191, 0, 0, 0],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.64,
    pose: pose(
      [1.2558, -0.051, 0.3723, 0.9943, 0, 0, 0],
      [-1.2558, 0.051, -0.3723, 0.9943, 0, 0, 0],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.74,
    pose: pose(
      [1.3963, -0.0362, 0.4049, 0.9163, 0.0025, -0.7817, 0.0164],
      [-1.3963, 0.0362, -0.4049, 0.9163, -0.0025, 0.7817, -0.0164],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.82,
    pose: pose(
      [1.3397, -0.0865, 0.6325, 0.7565, 0.1671, -0.7854, -0.2665],
      [-1.3397, 0.0865, -0.6325, 0.7565, -0.1671, 0.7854, 0.2665],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.94,
    pose: pose(
      [1.2733, -0.0196, 0.6169, 0.5257, 0.1444, -0.7348, -0.2842],
      [-1.2733, 0.0196, -0.6169, 0.5257, -0.1444, 0.7348, 0.2842],
      [0.08, -0.08],
    ),
  },
  {
    at: 0.97,
    pose: pose(
      [1.2733, -0.0196, 0.6169, 0.5257, 0.1444, -0.7348, -0.2842],
      [-1.2733, 0.0196, -0.6169, 0.5257, -0.1444, 0.7348, 0.2842],
      [0.56, -0.56],
    ),
  },
  {
    at: 1,
    pose: pose(
      [1.3397, -0.0865, 0.6325, 0.7565, 0.1671, -0.7854, -0.2665],
      [-1.3397, 0.0865, -0.6325, 0.7565, -0.1671, 0.7854, 0.2665],
      [0.62, -0.62],
    ),
  },
]

function smootherStep(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function range(value: number, start: number, end: number) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function getInterpolatedPose(progress: number) {
  let endIndex = keyframes.findIndex((keyframe) => progress <= keyframe.at)
  if (endIndex <= 0) endIndex = 1
  if (endIndex < 0) endIndex = keyframes.length - 1
  const from = keyframes[endIndex - 1]
  const to = keyframes[endIndex]
  const amount = smootherStep((progress - from.at) / (to.at - from.at))
  return Object.fromEntries(
    Object.keys(from.pose).map((name) => [name, THREE.MathUtils.lerp(from.pose[name], to.pose[name], amount)]),
  )
}

interface RobotProps {
  progress: number
  robotRef: { current: URDFRobot | null }
}

function OpenArmRobot({ progress, robotRef }: RobotProps) {
  const robot = useLoader(OpenArmLoader, '/models/openarm/urdf/openarm-v2.urdf')

  useEffect(() => {
    robot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        let link: THREE.Object3D | null = child.parent
        while (link && link !== robot && !link.name.startsWith('openarm_')) link = link.parent
        const linkName = link?.name ?? ''
        const linkNumber = Number(linkName.match(/link(\d+)/)?.[1] ?? 0)
        const color = linkName.includes('_left_')
          ? linkNumber % 2 ? '#477a68' : '#2f6654'
          : linkName.includes('_right_')
            ? linkNumber % 2 ? '#648777' : '#416f5d'
            : '#285846'
        const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
        const upgraded = sourceMaterials.map(() => new THREE.MeshStandardMaterial({
          color,
          roughness: 0.82,
          metalness: 0.02,
        }))
        child.material = Array.isArray(child.material) ? upgraded : upgraded[0]
      }
    })

    if (import.meta.env.DEV) {
      ;(window as unknown as { __patchAssistRobot?: URDFRobot }).__patchAssistRobot = robot
    }
    robotRef.current = robot

    return () => {
      robotRef.current = null
      if (import.meta.env.DEV) {
        delete (window as unknown as { __patchAssistRobot?: URDFRobot }).__patchAssistRobot
      }
    }
  }, [robot, robotRef])

  useFrame(() => {
    robot.setJointValues(getInterpolatedPose(progress))
  })

  return (
    <group position={[0.05, 0.12, -0.12]} rotation-y={Math.PI / 2}>
      <primitive object={robot} rotation-x={-Math.PI / 2} scale={1.62} />
    </group>
  )
}

interface GripperSample {
  base: THREE.Vector3
  tip: THREE.Vector3
  direction: THREE.Vector3
}

function sampleGripper(robot: URDFRobot, side: 'left' | 'right'): GripperSample | null {
  const link = robot.links[`openarm_${side}_ee_base_link`]
  if (!link) return null
  const base = link.localToWorld(new THREE.Vector3(0, 0, 0))
  const tip = link.localToWorld(new THREE.Vector3(0, 0, -0.075))
  return { base, tip, direction: tip.clone().sub(base).normalize() }
}

function patchQuaternion(leftGrip: GripperSample, rightGrip: GripperSample) {
  const xAxis = rightGrip.tip.clone().sub(leftGrip.tip).normalize()
  const normal = leftGrip.direction.clone().add(rightGrip.direction).normalize()
  const zAxis = xAxis.clone().cross(normal).normalize()
  const yAxis = zAxis.clone().cross(xAxis).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))
}

function TreatmentPatch({ progress, robotRef }: RobotProps) {
  const patch = useRef<THREE.Group>(null)
  const film = useRef<THREE.Group>(null)
  const scanRing = useRef<THREE.Mesh>(null)
  const start = useMemo(() => new THREE.Vector3(0.05, 0.617, 0.315), [])
  const filmStart = useMemo(() => new THREE.Vector3(0.05, 0.628, 0.315), [])
  const applied = useMemo(() => new THREE.Vector3(0.05, 0.92, 0.591), [])
  const appliedRotation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), [])

  useFrame((state) => {
    const robot = robotRef.current
    if (robot) {
      robot.updateMatrixWorld(true)
      const leftGrip = sampleGripper(robot, 'left')
      const rightGrip = sampleGripper(robot, 'right')
      if (leftGrip && rightGrip) {
        if (patch.current) {
          if (progress < 0.52) {
            patch.current.position.copy(start)
            patch.current.quaternion.identity()
            patch.current.scale.set(1, 1, 1)
          } else if (progress < 0.94) {
            patch.current.position.copy(leftGrip.tip).lerp(rightGrip.tip, 0.5)
            patch.current.quaternion.copy(patchQuaternion(leftGrip, rightGrip))
            const gripSpan = leftGrip.tip.distanceTo(rightGrip.tip)
            patch.current.scale.set(THREE.MathUtils.clamp(gripSpan / 0.3, 0.9, 1.07), 1, 1)
          } else {
            patch.current.position.copy(applied)
            patch.current.quaternion.copy(appliedRotation)
            patch.current.scale.set(1, 1, 1)
          }
        }
        if (film.current) {
          const peel = smootherStep(range(progress, 0.3, 0.47))
          film.current.visible = progress < 0.5
          const heldPosition = rightGrip.tip.clone().add(new THREE.Vector3(-0.105, 0.008, 0))
          film.current.position.copy(filmStart).lerp(heldPosition, peel)
          film.current.rotation.set(-peel * 0.48, peel * 0.18, -peel * 0.72)
        }
      }
    }
    if (scanRing.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.08
      scanRing.current.scale.setScalar(pulse)
      ;(scanRing.current.material as THREE.MeshBasicMaterial).opacity = progress < 0.23 ? 0.5 : 0
    }
  })

  return (
    <>
      <group ref={patch} name="treatment-patch" position={start.toArray()}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.014, 0.18]} />
          <meshBasicMaterial color="#8cc77c" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.24, 0.12]} />
          <meshBasicMaterial color="#dff0d8" transparent opacity={0.34} />
        </mesh>
      </group>

      <group ref={film} position={filmStart.toArray()}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.008, 0.18]} />
          <meshBasicMaterial color="#dce9df" transparent opacity={0.72} toneMapped={false} />
        </mesh>
        <mesh position={[0.08, 0.015, -0.07]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 0.025]} />
          <meshBasicMaterial color="#2c4b3d" transparent opacity={0.55} />
        </mesh>
      </group>

      <mesh ref={scanRing} position={[0.05, 0.604, 0.315]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.205, 64]} />
        <meshBasicMaterial color="#ff6b45" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </>
  )
}

function SkinTarget({ progress }: { progress: number }) {
  const contact = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!contact.current) return
    const visible = range(progress, 0.75, 0.92)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.1
    contact.current.scale.setScalar(pulse)
    ;(contact.current.material as THREE.MeshBasicMaterial).opacity = visible * 0.42
  })

  return (
    <group name="skin-target" position={[0.05, 1.05, 0.62]}>
      <mesh name="skin-board" castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.48, 0.045]} />
        <meshBasicMaterial color="#a96649" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.023]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.5, 0.42]} />
        <meshBasicMaterial color="#c68768" toneMapped={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[0, -0.13, -0.024]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.155, 64]} />
        <meshBasicMaterial color="#8e5d4e" transparent opacity={0.08} />
      </mesh>
      <mesh ref={contact} position={[0, -0.13, -0.025]} rotation={[0, Math.PI, 0]}>
        <ringGeometry args={[0.17, 0.185, 64]} />
        <meshBasicMaterial color="#ff6b45" transparent opacity={0} depthWrite={false} />
      </mesh>
      <group>
        <mesh position={[0, -0.67, -0.02]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.74, 24]} />
          <meshBasicMaterial color="#505a54" toneMapped={false} />
        </mesh>
        <mesh position={[0, -1.02, -0.02]} castShadow>
          <cylinderGeometry args={[0.18, 0.23, 0.025, 36]} />
          <meshBasicMaterial color="#59635d" toneMapped={false} />
        </mesh>
      </group>
      <Html position={[-0.27, 0.4, -0.04]} rotation={[0, Math.PI, 0]} transform distanceFactor={2.1} style={{ pointerEvents: 'none' }}>
        <div className="three-label"><i />SKIN SIMULANT / BACK</div>
      </Html>
    </group>
  )
}

function LabEnvironment() {
  return (
    <>
      <Grid
        position={[0, 0.012, 0]}
        args={[8, 8]}
        cellSize={0.22}
        cellThickness={0.5}
        cellColor="#aeb3ac"
        sectionSize={1.1}
        sectionThickness={0.8}
        sectionColor="#969d95"
        fadeDistance={5.5}
        fadeStrength={1.3}
        infiniteGrid
      />

      <group position={[0.05, 0.5, 0.3]}>
        <RoundedBox args={[0.82, 0.06, 0.58]} radius={0.024} smoothness={4} castShadow receiveShadow>
          <meshBasicMaterial color="#b8b5ab" toneMapped={false} />
        </RoundedBox>
        {[[-0.34, -0.25, -0.23], [0.34, -0.25, -0.23], [-0.34, -0.25, 0.23], [0.34, -0.25, 0.23]].map((position, index) => (
          <mesh key={index} position={position as [number, number, number]} castShadow>
            <cylinderGeometry args={[0.025, 0.03, 0.5, 16]} />
            <meshBasicMaterial color="#555e58" toneMapped={false} />
          </mesh>
        ))}
        <RoundedBox args={[0.4, 0.04, 0.28]} radius={0.016} smoothness={3} position={[0, 0.075, 0.015]} receiveShadow>
          <meshBasicMaterial color="#929c94" toneMapped={false} />
        </RoundedBox>
      </group>

      <mesh position={[0, 1.2, -1.28]} receiveShadow>
        <planeGeometry args={[6, 2.6]} />
        <meshBasicMaterial color="#d0d2cb" toneMapped={false} />
      </mesh>
      <mesh position={[-2.2, 1.1, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[5, 2.4]} />
        <meshBasicMaterial color="#d9dbd4" toneMapped={false} />
      </mesh>
    </>
  )
}

function CameraRig({ mode, progress }: { mode: CameraMode; progress: number }) {
  const { camera } = useThree()
  const moving = useRef(true)
  const stage = progress < 0.58 ? 'pickup' : 'apply'
  const target = stage === 'pickup'
    ? new THREE.Vector3(0.05, 0.66, 0.27)
    : new THREE.Vector3(0.05, 0.9, 0.59)
  const destination = mode === 'overview'
    ? stage === 'pickup' ? new THREE.Vector3(2.9, 1.25, 2.5) : new THREE.Vector3(2.75, 1.45, -2.35)
    : stage === 'pickup' ? new THREE.Vector3(1.75, 0.93, 1.45) : new THREE.Vector3(2.05, 1.12, -1.65)

  useEffect(() => {
    moving.current = true
  }, [mode, stage])

  useFrame(() => {
    if (!moving.current) return
    camera.position.lerp(destination, 0.065)
    camera.lookAt(target)
    if (camera.position.distanceTo(destination) < 0.012) moving.current = false
  })

  return null
}

export function SceneLoader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="scene-loader" role="status">
        <span className="loader-mark"><i /><i /></span>
        <strong>OpenArm 2.0を準備中</strong>
        <small>{Math.round(progress)}%</small>
      </div>
    </Html>
  )
}

export function PatchAssistScene({ progress, cameraMode }: PatchAssistSceneProps) {
  const robotRef = useRef<URDFRobot | null>(null)

  return (
    <>
      <fog attach="fog" args={['#d2d4cd', 4.6, 8.5]} />
      <ambientLight intensity={0.72} color="#f4f1e8" />
      <directionalLight
        position={[4.5, 6, 4]}
        intensity={1.45}
        color="#fffaf0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <LabEnvironment />
      <OpenArmRobot progress={progress} robotRef={robotRef} />
      <TreatmentPatch progress={progress} robotRef={robotRef} />
      <SkinTarget progress={progress} />

      <ContactShadows position={[0, 0.02, 0]} opacity={0.28} scale={5.5} blur={2.5} far={3.2} />
      <CameraRig mode={cameraMode} progress={progress} />
      <OrbitControls
        makeDefault
        target={progress < 0.58 ? [0.05, 0.66, 0.27] : [0.05, 0.9, 0.59]}
        minDistance={1.45}
        maxDistance={6}
        minPolarAngle={0.55}
        maxPolarAngle={Math.PI / 2.05}
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
      />
    </>
  )
}

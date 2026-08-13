import { ContactShadows, Html, OrbitControls, useProgress } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { OpenArmRig } from './scene/OpenArmRig'
import { Patient, targetNormalWorld, targetWorld } from './scene/Patient'
import { type Cups, Workstation } from './scene/Workstation'
import { APPLY, type DemoState, type StageId } from '../lib/sequence'

export const ACCENTS = {
  scan: '#1183a0',
  intent: '#2f6b53',
  vac: '#4a63c8',
  force: '#ff6b45',
}

export type CameraMode = 'follow' | 'wide'

/**
 * Each stage is framed along the outward normal of the back (or of the tray)
 * with enough lateral offset that the robot's own column never blocks the view.
 */
const FRAMING: Record<StageId, { camera: [number, number, number]; target: [number, number, number] }> = {
  scan: { camera: [1.23, 1.8, -0.54], target: [-0.14, 0.96, 0.45] },
  intent: { camera: [1.3, 1.94, -0.53], target: [-0.14, 1.02, 0.44] },
  peel: { camera: [0.82, 1.38, 1.0], target: [0.04, 0.86, 0.28] },
  apply: { camera: [0.86, 1.56, -0.27], target: [-0.14, 0.95, 0.45] },
}

const WIDE = {
  camera: [2.62, 2.02, 1.46] as [number, number, number],
  target: [-0.09, 0.94, 0.3] as [number, number, number],
}

/** The framings above are authored for the 16:9 desktop canvas. */
const REFERENCE_ASPECT = 16 / 9

/**
 * A portrait canvas has far less horizontal field than 16:9, so the authored
 * camera positions would crop the scene at the sides on a phone. Back the
 * camera off along its own view vector — softened, because a tall frame can
 * afford to lose a little width — and never past the orbit limit.
 */
function aspectPull(aspect: number) {
  if (!Number.isFinite(aspect) || aspect >= REFERENCE_ASPECT) return 1
  return Math.min(1.8, (REFERENCE_ASPECT / Math.max(aspect, 0.4)) ** 0.65)
}

function SceneTag({
  position,
  label,
  detail,
  accent,
  opacity,
}: {
  position: [number, number, number]
  label: string
  detail?: string
  accent: string
  opacity: number
}) {
  if (opacity < 0.02) return null
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }} zIndexRange={[9, 0]}>
      <div className="scene-tag" style={{ '--tag': accent, opacity } as React.CSSProperties}>
        <i />
        <span>
          {label}
          {detail && <small>{detail}</small>}
        </span>
      </div>
    </Html>
  )
}

/** Contact force drawn where the cup meets the back. */
function ForceProbe({ state }: { state: DemoState }) {
  const group = useRef<THREE.Group>(null)
  const shaft = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)

  const { position, quaternion } = useMemo(() => {
    const point = targetWorld()
    const normal = targetNormalWorld()
    const zAxis = normal.clone().normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize()
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
    return {
      position: point,
      quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)),
    }
  }, [])

  useFrame((frame) => {
    if (group.current) group.current.visible = state.contactBloom > 0.02
    const load = THREE.MathUtils.clamp(state.contactForce / 4.4, 0, 1.2)
    if (shaft.current) {
      const length = 0.05 + load * 0.09
      shaft.current.scale.y = length / 0.1
      shaft.current.position.z = 0.035 + length / 2
    }
    if (ring.current) {
      const pulse = 1 + Math.sin(frame.clock.elapsedTime * 7) * 0.07
      ring.current.scale.setScalar(pulse * (0.7 + load * 0.4))
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = state.contactBloom * 0.7
    }
  })

  return (
    <group ref={group} position={position.toArray()} quaternion={quaternion}>
      <mesh ref={ring} position={[0, 0, 0.006]}>
        <ringGeometry args={[0.052, 0.058, 48]} />
        <meshBasicMaterial color={ACCENTS.force} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={shaft} position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.1, 10]} />
        <meshBasicMaterial color={ACCENTS.force} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.028]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.011, 0.024, 14]} />
        <meshBasicMaterial color={ACCENTS.force} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * Drives the framing per stage, but hands control to the viewer the moment they
 * drag; the automatic framing resumes when the stage or the view mode changes.
 */
function CameraRig({ state, mode, playing }: { state: DemoState; mode: CameraMode; playing: boolean }) {
  const { camera } = useThree()
  const size = useThree((instance) => instance.size)
  const controls = useThree((instance) => instance.controls) as unknown as
    | {
        target: THREE.Vector3
        update: () => void
        addEventListener: (type: string, listener: () => void) => void
        removeEventListener: (type: string, listener: () => void) => void
      }
    | null
  const desired = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])
  const manual = useRef(false)
  const stageId = state.stage.id

  useEffect(() => {
    manual.current = false
  }, [stageId, mode])

  useEffect(() => {
    if (!controls) return
    const onStart = () => {
      manual.current = true
    }
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [controls])

  useFrame(() => {
    if (manual.current) return
    const frame = mode === 'wide' ? WIDE : FRAMING[stageId]
    desired.set(...frame.camera)
    look.set(...frame.target)
    desired.sub(look).multiplyScalar(aspectPull(size.width / size.height)).add(look)
    // Smooth while the sequence plays; snap when the viewer scrubs or jumps to
    // a stage, so a paused frame is always the intended framing.
    const blend = playing ? 0.045 : 1
    camera.position.lerp(desired, blend)
    if (controls) {
      controls.target.lerp(look, playing ? 0.06 : 1)
      controls.update()
    } else {
      camera.lookAt(look)
    }
  })

  return null
}

/**
 * Studio surroundings for the standard materials to reflect. three builds the
 * room procedurally, so this costs no network fetch — and without it the black
 * machine has no specular at all and reads as a flat silhouette.
 */
function StudioEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((instance) => instance.gl)
  const scene = useThree((instance) => instance.scene)

  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = null
      target.dispose()
      generator.dispose()
      room.dispose()
    }
  }, [gl, scene, intensity])

  return null
}

export function SceneLoader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="scene-loader" role="status">
        <span className="loader-mark">
          <i />
          <i />
        </span>
        <strong>OpenArm 2.0 を読み込み中</strong>
        <small>{Math.round(progress)}%</small>
      </div>
    </Html>
  )
}

export function PatchAssistScene({
  state,
  cameraMode,
  playing,
}: {
  state: DemoState
  cameraMode: CameraMode
  playing: boolean
}) {
  const wristTag = useMemo(() => {
    const point = targetWorld().addScaledVector(targetNormalWorld(), 0.2)
    return [point.x, point.y + 0.06, point.z] as [number, number, number]
  }, [])

  // The consumables the arms handle are parented to the cups themselves, so
  // the rig has to hand its tool control points back up to the scene.
  const [cups, setCups] = useState<Cups>({})
  const handleCup = useCallback((side: 'left' | 'right', cup: THREE.Object3D | null) => {
    setCups((current) => (current[side] === (cup ?? undefined) ? current : { ...current, [side]: cup ?? undefined }))
  }, [])

  // There is no floor for the contact shadow to sit on, so its offscreen pass
  // has to clear to fully transparent; otherwise the unshadowed part of its
  // plane reads as a grey slab hanging under the scene.
  const gl = useThree((instance) => instance.gl)
  useEffect(() => {
    gl.setClearAlpha(0)
  }, [gl])

  // OrbitControls claims every touch gesture by setting touch-action: none,
  // which on a phone turns the canvas into a scroll trap. Hand vertical swipes
  // back to the page: horizontal drags still orbit, two fingers still pan/zoom.
  const controls = useThree((instance) => instance.controls)
  useEffect(() => {
    if (controls) gl.domElement.style.touchAction = 'pan-y'
  }, [gl, controls])

  const stage = state.stage.id
  const tagOpacity = (id: StageId) => (stage === id ? 1 : 0)

  return (
    <>
      <color attach="background" args={['#e8e8e1']} />
      {/* far enough out that the pulled-back portrait framing stays unfogged */}
      <fog attach="fog" args={['#e8e8e1', 7, 16]} />
      {/* The room map carries the soft fill, so the lights can stay directional
          and keep a real key-to-fill ratio instead of flattening everything. */}
      <StudioEnvironment intensity={0.75} />
      <ambientLight intensity={0.12} color="#f6f4ea" />
      <hemisphereLight args={['#fffdf5', '#b6bbae', 0.5]} />
      <directionalLight
        position={[2.6, 4.2, 2.2]}
        intensity={2.1}
        color="#fff8ec"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.012}
        // tight frustum: the whole cell is ~1.4 m across, so the map spends its
        // texels on the scene instead of on empty floor, and the edges stay crisp
        shadow-camera-left={-1.3}
        shadow-camera-right={1.3}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.3}
        shadow-camera-near={1.5}
        shadow-camera-far={8}
      />
      {/* fill from the far side, so the shadowed flank of the robot stays readable */}
      <directionalLight position={[-2.8, 2.2, -1.4]} intensity={0.34} color="#e6eef5" />
      <directionalLight position={[-0.4, 1.4, 3.4]} intensity={0.22} color="#fff4e8" />

      {/* the rig solves first, so anything reading a cup pose is a frame current */}
      <OpenArmRig state={state} accents={ACCENTS} onCup={handleCup} />
      <Workstation state={state} accents={ACCENTS} cups={cups} />
      <Patient state={state} accents={ACCENTS} />
      <ForceProbe state={state} />

      <SceneTag
        position={[0.13, 1.2, 0.13]}
        label="RealSense D435f"
        detail="胸部搭載 / 深度 87°×58°"
        accent={ACCENTS.scan}
        opacity={tagOpacity('scan')}
      />
      <SceneTag
        position={[targetWorld().x - 0.02, targetWorld().y + 0.11, targetWorld().z - 0.06]}
        label="貼付点を確定"
        detail="指先ランドマーク #8"
        accent={ACCENTS.intent}
        opacity={tagOpacity('intent')}
      />
      <SceneTag
        position={[-0.24, 0.9, 0.3]}
        label="ポンプ A / 固定"
        detail="湿布を押さえる"
        accent={ACCENTS.force}
        opacity={tagOpacity('peel')}
      />
      <SceneTag
        position={[0.26, 0.94, 0.28]}
        label="ポンプ B / 揺動"
        detail="フィルムを剥がす"
        accent={ACCENTS.vac}
        opacity={tagOpacity('peel')}
      />
      <SceneTag
        position={wristTag}
        label="6軸力覚センサ"
        detail={`Fz ${state.contactForce.toFixed(1)} N`}
        accent={ACCENTS.force}
        opacity={state.progress > APPLY.approach - 0.02 ? 1 : 0}
      />

      {/* tighter and darker than a soft AO puddle: it is what glues the cart to
          the floor now that there is no floor plane to catch the key light */}
      <ContactShadows position={[0, 0.008, 0]} opacity={0.5} scale={3.4} blur={1.5} far={1.6} resolution={1024} />
      <OrbitControls
        makeDefault
        enablePan
        screenSpacePanning
        enableDamping
        dampingFactor={0.08}
        minDistance={0.75}
        maxDistance={7}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.06}
      />
      <CameraRig state={state} mode={cameraMode} playing={playing} />
    </>
  )
}

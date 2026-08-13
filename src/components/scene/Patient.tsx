import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  HAND_CONNECTIONS,
  HAND_LANDMARKS,
  HAND_TIP_INDEX,
  backSurfaceNormal,
  backSurfacePoint,
  backTheta,
  createBackContours,
  createBandGeometry,
  createGarmentGeometry,
  createLimbGeometry,
  createTorsoGeometry,
  sampleBackCloud,
  solveArm,
  torsoNormal,
  torsoPoint,
} from '../../lib/anatomy'
import { createTubeGeometry, updateTubeGeometry } from '../../lib/tubing'
import type { DemoState } from '../../lib/sequence'

/**
 * The patient is generated rather than imported.
 *
 * Every redistributable stock avatar we tried is a stylised character whose
 * back is covered by clothing and hair — which is exactly the surface this demo
 * has to show. Generating the body from the same parametric surface that feeds
 * the depth cloud, the contour overlay and the conformal patch keeps all four
 * in agreement and leaves the back bare where the robot works.
 */

export const PATIENT_ROOT = new THREE.Vector3(-0.215, 0.652, 0.5525)
/** Where the patient asked for the patch, in normalised back coordinates. */
export const TARGET_UV = { u: 0.275, v: 0.606 }
const PATCH_HALF_U = 0.3
const PATCH_HALF_V = 0.105

const SKIN = '#dbaa8c'
const SKIN_SHADE = '#c9977c'
const GARMENT = '#54646f'
const GARMENT_TRIM = '#41505a'
const HAIR = '#3a3230'

/**
 * Arm skeleton, in the patient's local frame and mirrored for the other side.
 *
 * The shoulder sits outside the torso silhouette (which is 0.204 wide at chest
 * height) so both bones stay visible from every camera, and the bone lengths
 * are fixed: the elbow is solved from them, never authored, so the arm cannot
 * lose a segment when the hand moves.
 */
const SHOULDER = new THREE.Vector3(0.2, 0.455, 0)
const UPPER_ARM = 0.275
const FOREARM = 0.265
/** Wrist to index fingertip, the reach the hand itself contributes. */
const HAND_TIP = new THREE.Vector3(...HAND_LANDMARKS[HAND_TIP_INDEX])
/** How far the forearm is pushed past the wrist, to seat it inside the palm. */
const WRIST_SEAT = 0.022

/** Resting: hand draped over the thigh, elbow falling back and out. */
const REST_WRIST = new THREE.Vector3(0.145, -0.03, 0.135)
const REST_FINGERS = new THREE.Vector3(-0.16, -0.24, 0.957).normalize()
const REST_PALM = new THREE.Vector3(0, -1, 0)
const REST_POLE = new THREE.Vector3(0.62, -0.18, -0.76).normalize()
/**
 * Raised: the hand comes up behind the back and the elbow swings out. Reaching
 * over the shoulder instead would fold the elbow past its stop — the chosen
 * point is barely 0.23 from the shoulder, less than half the arm.
 */
const RAISED_POLE = new THREE.Vector3(0.85, -0.42, -0.32).normalize()

/** Biceps, elbow, wrist. */
function armRadius(t: number) {
  return t < 0.5
    ? THREE.MathUtils.lerp(0.049, 0.037, t / 0.5)
    : THREE.MathUtils.lerp(0.037, 0.024, (t - 0.5) / 0.5)
}

/** Hand frame from a finger direction and the way the palm faces. */
const _handX = new THREE.Vector3()
const _handY = new THREE.Vector3()
const _handZ = new THREE.Vector3()

function handBasis(fingers: THREE.Vector3, palm: THREE.Vector3, target: THREE.Matrix4) {
  // Landmarks are authored with the fingers along +Y and the palm facing -Z.
  _handY.copy(fingers).normalize()
  _handZ.copy(palm).addScaledVector(_handY, -palm.dot(_handY)).normalize().negate()
  _handX.crossVectors(_handY, _handZ).normalize()
  return target.makeBasis(_handX, _handY, _handZ)
}

interface HandPose {
  /** Wrist position that puts the fingertip on the chosen point. */
  wrist: THREE.Vector3
  fingers: THREE.Vector3
  palm: THREE.Vector3
}

export function targetWorld(target = new THREE.Vector3()) {
  return backSurfacePoint(TARGET_UV.u, TARGET_UV.v, target).add(PATIENT_ROOT)
}

export function targetNormalWorld(target = new THREE.Vector3()) {
  return backSurfaceNormal(TARGET_UV.u, TARGET_UV.v, target)
}

/** Depth cloud that fills in as the chest camera sweeps the back. */
function ScanCloud({
  reveal,
  presence,
  accent,
}: {
  reveal: number
  presence: number
  accent: string
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { geometry, uniforms } = useMemo(() => {
    const cloud = sampleBackCloud(11000)
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(cloud.positions.slice(0, cloud.count * 3), 3))
    buffer.setAttribute('aOrder', new THREE.BufferAttribute(cloud.order.slice(0, cloud.count), 1))
    buffer.setAttribute('aJitter', new THREE.BufferAttribute(cloud.jitter.slice(0, cloud.count), 1))
    return {
      geometry: buffer,
      uniforms: {
        uReveal: { value: 0 },
        // Point radius in metres; uScale converts it to device pixels.
        uSize: { value: 0.0036 },
        uScale: { value: 900 },
        uColor: { value: new THREE.Color(accent) },
        uHot: { value: new THREE.Color('#f2feff') },
        uOpacity: { value: 0.8 },
      },
    }
  }, [accent])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((frame) => {
    // Reach the uniforms through the material: the object handed to the JSX
    // prop is not necessarily the one the compiled program reads from.
    const active = materialRef.current?.uniforms ?? uniforms
    active.uReveal.value = reveal
    active.uOpacity.value = 0.82 * presence
    const camera = frame.camera as THREE.PerspectiveCamera
    active.uSize.value = uniforms.uSize.value
    active.uScale.value =
      (frame.size.height * frame.viewport.dpr) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov ?? 40) / 2))
  })

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={20}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`
          attribute float aOrder;
          attribute float aJitter;
          uniform float uReveal;
          uniform float uSize;
          uniform float uScale;
          varying float vAlpha;
          varying float vFront;
          void main() {
            float order = aOrder + aJitter * 0.025;
            float appear = smoothstep(order, order + 0.02, uReveal);
            vAlpha = appear;
            vFront = (1.0 - smoothstep(0.0, 0.06, uReveal - order)) * appear;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * (1.0 + vFront * 1.2) * uScale / max(-mv.z, 0.05);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform vec3 uHot;
          uniform float uOpacity;
          varying float vAlpha;
          varying float vFront;
          void main() {
            vec2 delta = gl_PointCoord - vec2(0.5);
            if (dot(delta, delta) > 0.25) discard;
            gl_FragColor = vec4(mix(uColor, uHot, vFront * 0.85), vAlpha * uOpacity);
          }
        `}
      />
    </points>
  )
}

/** The band of surface the depth sweep is resolving right now. */
function ScanLine({ reveal, accent, active }: { reveal: number; accent: string; active: number }) {
  const group = useRef<THREE.Group>(null)
  const geometry = useMemo(() => {
    const positions: number[] = []
    const point = new THREE.Vector3()
    const normal = new THREE.Vector3()
    for (let i = 0; i <= 72; i += 1) {
      const u = (i / 72) * 2.5 - 1.25
      const theta = backTheta(u, 1.32)
      torsoPoint(0.24, theta, point)
      backSurfaceNormal(u, 0.5, normal)
      positions.push(point.x + normal.x * 0.008, 0, point.z + normal.z * 0.008)
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return buffer
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    if (!group.current) return
    group.current.position.y = THREE.MathUtils.lerp(-0.13, 0.55, reveal)
    group.current.visible = active > 0.05 && reveal < 0.995
  })

  return (
    <group ref={group} renderOrder={22}>
      <line>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color={accent} transparent opacity={0.95 * active} depthWrite={false} depthTest={false} />
      </line>
    </group>
  )
}

/** 21 MediaPipe landmarks drawn over the patient's hand as an AR overlay. */
function HandOverlay({ fade, accent }: { fade: number; accent: string }) {
  const lineGeometry = useMemo(() => {
    const positions: number[] = []
    HAND_CONNECTIONS.forEach(([a, b]) => {
      positions.push(...HAND_LANDMARKS[a], ...HAND_LANDMARKS[b])
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geometry
  }, [])

  useEffect(() => () => lineGeometry.dispose(), [lineGeometry])
  if (fade < 0.01) return null

  return (
    <group renderOrder={40}>
      <lineSegments geometry={lineGeometry} renderOrder={40}>
        <lineBasicMaterial color={accent} transparent opacity={0.95 * fade} depthTest={false} depthWrite={false} />
      </lineSegments>
      {HAND_LANDMARKS.map((point, index) => (
        <mesh key={index} position={point} renderOrder={41}>
          <sphereGeometry args={[index === 8 ? 0.0075 : 0.0045, 12, 12]} />
          <meshBasicMaterial
            color={index === 8 ? '#ffffff' : accent}
            transparent
            opacity={fade}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function HandMesh() {
  const geometries = useMemo(() => {
    const chains = [
      [0, 1, 2, 3, 4],
      [0, 5, 6, 7, 8],
      [0, 9, 10, 11, 12],
      [0, 13, 14, 15, 16],
      [0, 17, 18, 19, 20],
    ]
    return chains.map((chain, chainIndex) =>
      createLimbGeometry(
        chain.map((index) => new THREE.Vector3(...HAND_LANDMARKS[index])),
        (t) => (chainIndex === 0 ? 0.0125 : 0.0102) * (1 - t * 0.4),
        24,
        12,
      ),
    )
  }, [])

  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])

  return (
    <group>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} castShadow>
          <meshStandardMaterial color={SKIN} />
        </mesh>
      ))}
      <mesh position={[-0.003, 0.048, 0.004]} rotation={[0.05, 0, 0.03]} castShadow>
        <boxGeometry args={[0.078, 0.072, 0.023]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
    </group>
  )
}

/**
 * One arm: a tube swept shoulder → solved elbow → wrist, a deltoid that closes
 * the joint into the torso, and a hand at the far end. `raise` blends the whole
 * pose from resting to `raised`; the other side is the same arm through a
 * negated X, so the patient is never left half-limbed.
 */
function PatientArm({
  raise,
  raised,
  landmarkFade,
  accent,
  mirrored,
}: {
  raise: number
  raised: HandPose
  landmarkFade: number
  accent: string
  mirrored?: boolean
}) {
  const geometry = useMemo(() => createTubeGeometry(46, 18), [])
  const points = useMemo(() => Array.from({ length: 5 }, () => new THREE.Vector3()), [])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5), [points])
  const handGroup = useRef<THREE.Group>(null)
  const scratch = useMemo(
    () => ({
      elbow: new THREE.Vector3(),
      wrist: new THREE.Vector3(),
      wristTarget: new THREE.Vector3(),
      pole: new THREE.Vector3(),
      fingers: new THREE.Vector3(),
      palm: new THREE.Vector3(),
      basis: new THREE.Matrix4(),
    }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const { elbow, wrist, wristTarget, pole, fingers, palm, basis } = scratch
    fingers.lerpVectors(REST_FINGERS, raised.fingers, raise).normalize()
    palm.lerpVectors(REST_PALM, raised.palm, raise).normalize()
    wristTarget.lerpVectors(REST_WRIST, raised.wrist, raise)
    pole.lerpVectors(REST_POLE, RAISED_POLE, raise).normalize()
    solveArm(SHOULDER, wristTarget, pole, UPPER_ARM, FOREARM, elbow, wrist)

    points[0].copy(SHOULDER)
    points[1].lerpVectors(SHOULDER, elbow, 0.55)
    points[2].copy(elbow)
    points[3].lerpVectors(elbow, wrist, 0.45)
    // Run the forearm a little past the wrist so it is seated in the palm.
    points[4].copy(wrist).addScaledVector(fingers, WRIST_SEAT)
    updateTubeGeometry(geometry, curve, armRadius)

    if (handGroup.current) {
      handGroup.current.position.copy(wrist)
      handGroup.current.quaternion.setFromRotationMatrix(handBasis(fingers, palm, basis))
    }
  })

  return (
    <group scale={mirrored ? [-1, 1, 1] : [1, 1, 1]}>
      <mesh geometry={geometry} castShadow frustumCulled={false}>
        <meshStandardMaterial color={SKIN} />
      </mesh>
      {/* deltoid, filling the armpit so the arm reads as joined rather than stuck on */}
      <mesh position={[0.188, 0.452, -0.004]} scale={[0.061, 0.072, 0.065]} castShadow>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <group ref={handGroup}>
        <HandMesh />
        {!mirrored && <HandOverlay fade={landmarkFade} accent={accent} />}
      </group>
    </group>
  )
}

/** The patch itself, generated on the scanned surface so it wraps the back. */
function AppliedPatch({ reveal, accent }: { reveal: number; accent: string }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const columns = 34
    const rows = 26
    const positions: number[] = []
    const normals: number[] = []
    const params: number[] = []
    const indices: number[] = []
    const point = new THREE.Vector3()
    const normal = new THREE.Vector3()
    for (let row = 0; row <= rows; row += 1) {
      const fy = row / rows
      const v = TARGET_UV.v + (fy * 2 - 1) * PATCH_HALF_V
      for (let column = 0; column <= columns; column += 1) {
        const fx = column / columns
        const u = TARGET_UV.u + (fx * 2 - 1) * PATCH_HALF_U
        backSurfacePoint(u, v, point)
        backSurfaceNormal(u, v, normal)
        point.addScaledVector(normal, 0.0026)
        positions.push(point.x, point.y, point.z)
        normals.push(normal.x, normal.y, normal.z)
        const corner = Math.abs(fx * 2 - 1) ** 6 + Math.abs(fy * 2 - 1) ** 6
        params.push(fy, corner)
      }
    }
    const stride = columns + 1
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = row * stride + column
        const b = a + stride
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    buffer.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    buffer.setAttribute('aParam', new THREE.Float32BufferAttribute(params, 2))
    buffer.setIndex(indices)
    return buffer
  }, [])

  const uniforms = useMemo(
    () => ({
      uReveal: { value: 0 },
      uColor: { value: new THREE.Color('#f3f4ee') },
      uEdge: { value: new THREE.Color(accent) },
    }),
    [accent],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    if (material.current) material.current.uniforms.uReveal.value = reveal
  })

  if (reveal < 0.005) return null

  return (
    <mesh geometry={geometry} renderOrder={14}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        vertexShader={`
          attribute vec2 aParam;
          varying vec2 vParam;
          varying vec3 vNormal;
          void main() {
            vParam = aParam;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uReveal;
          uniform vec3 uColor;
          uniform vec3 uEdge;
          varying vec2 vParam;
          varying vec3 vNormal;
          void main() {
            if (vParam.y > 1.0) discard;
            float pressed = smoothstep(vParam.x - 0.06, vParam.x + 0.02, uReveal);
            if (pressed < 0.02) discard;
            float shade = 0.74 + 0.26 * clamp(dot(normalize(vNormal), vec3(0.36, 0.58, -0.72)), 0.0, 1.0);
            float front = 1.0 - smoothstep(0.0, 0.09, uReveal - vParam.x);
            gl_FragColor = vec4(mix(uColor * shade, uEdge, front * 0.45), pressed);
          }
        `}
      />
    </mesh>
  )
}

interface PatientProps {
  state: DemoState
  accents: { scan: string; intent: string; force: string }
}

export function Patient({ state, accents }: PatientProps) {
  const torso = useMemo(() => createTorsoGeometry(), [])
  const garment = useMemo(() => createGarmentGeometry(0.14), [])
  const straps = useStraps()
  const contours = useMemo(() => createBackContours(), [])

  const targetGroup = useRef<THREE.Group>(null)
  const contourMaterial = useRef<THREE.LineBasicMaterial>(null)

  const anchors = useMemo(() => {
    const tip = backSurfacePoint(TARGET_UV.u, TARGET_UV.v, new THREE.Vector3())
    const normal = backSurfaceNormal(TARGET_UV.u, TARGET_UV.v, new THREE.Vector3())
    // Fingers run up the back towards the spine and press in, palm on the skin;
    // the wrist is then wherever it has to be for the index fingertip to land
    // on the point.
    const fingers = new THREE.Vector3(-0.3, 0.78, 0).addScaledVector(normal, -0.5).normalize()
    const palm = normal.clone().negate()
    const wrist = tip.clone().sub(HAND_TIP.clone().applyMatrix4(handBasis(fingers, palm, new THREE.Matrix4())))
    return { tip, normal, raised: { wrist, fingers, palm } satisfies HandPose }
  }, [])

  useEffect(
    () => () => {
      torso.dispose()
      garment.dispose()
      contours.dispose()
    },
    [torso, garment, contours],
  )

  useFrame(() => {
    if (targetGroup.current) {
      targetGroup.current.visible = state.targetLock > 0.02
      targetGroup.current.scale.setScalar(0.6 + 0.4 * state.targetLock)
    }
    if (contourMaterial.current) contourMaterial.current.opacity = state.meshFade * 0.4
  })

  const targetQuaternion = useMemo(() => {
    const zAxis = anchors.normal.clone().normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize()
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))
  }, [anchors])

  return (
    <group position={PATIENT_ROOT.toArray()}>
      <mesh geometry={torso} castShadow receiveShadow>
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <mesh geometry={garment} castShadow receiveShadow>
        <meshStandardMaterial color={GARMENT} side={THREE.DoubleSide} />
      </mesh>

      {/* shoulder straps, so the bare back reads as a top rather than nudity */}
      {straps.map((geometry, index) => (
        <mesh key={index} geometry={geometry} castShadow>
          <meshStandardMaterial color={GARMENT_TRIM} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* neck and head */}
      <mesh position={[0, 0.618, 0.016]} rotation={[0.06, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.062, 0.1, 28]} />
        <meshStandardMaterial color={SKIN_SHADE} />
      </mesh>
      <mesh position={[0, 0.735, 0.022]} scale={[0.094, 0.115, 0.104]} castShadow>
        <sphereGeometry args={[1, 36, 26]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <mesh position={[0, 0.752, 0.012]} scale={[0.101, 0.114, 0.109]} castShadow>
        <sphereGeometry args={[1, 36, 26, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color={HAIR} />
      </mesh>
      <mesh position={[0, 0.7, -0.058]} scale={[0.082, 0.078, 0.062]} castShadow>
        <sphereGeometry args={[1, 26, 20]} />
        <meshStandardMaterial color={HAIR} />
      </mesh>
      <mesh position={[0, 0.648, -0.07]} scale={[0.055, 0.05, 0.045]} castShadow>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={HAIR} />
      </mesh>

      <PatientArm
        raise={state.handRaise}
        raised={anchors.raised}
        landmarkFade={state.landmarkFade}
        accent={accents.intent}
      />
      <PatientArm raise={0} raised={anchors.raised} landmarkFade={0} accent={accents.intent} mirrored />

      <ScanCloud reveal={state.scanReveal} presence={state.cloudPresence} accent={accents.scan} />
      <ScanLine reveal={state.scanReveal} accent={accents.scan} active={state.stage.id === 'scan' ? 1 : 0} />

      <lineSegments geometry={contours} renderOrder={19}>
        <lineBasicMaterial ref={contourMaterial} color={accents.scan} transparent opacity={0} depthWrite={false} />
      </lineSegments>

      <group ref={targetGroup} position={anchors.tip.toArray()} quaternion={targetQuaternion}>
        <mesh position={[0, 0, 0.005]}>
          <ringGeometry args={[0.03, 0.034, 48]} />
          <meshBasicMaterial color={accents.intent} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <circleGeometry args={[0.005, 20]} />
          <meshBasicMaterial color={accents.intent} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      <AppliedPatch reveal={state.patchApplied} accent={accents.force} />

      {/* thighs and lower legs, so the seated pose reads from any angle */}
      {[-0.088, 0.088].map((x) => (
        <group key={x}>
          <mesh position={[x, -0.152, 0.15]} rotation={[Math.PI / 2 - 0.08, 0, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.2, 8, 20]} />
            <meshStandardMaterial color={GARMENT} />
          </mesh>
          <mesh position={[x, -0.34, 0.255]} rotation={[0.12, 0, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.2, 8, 20]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
          <mesh position={[x, -0.462, 0.288]} rotation={[0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.085, 0.05, 0.19]} />
            <meshStandardMaterial color="#454e4a" />
          </mesh>
        </group>
      ))}

      {/* treatment stool */}
      <group position={[0, -0.176, 0.02]}>
        <mesh position={[0, -0.026, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.185, 0.18, 0.05, 36]} />
          <meshStandardMaterial color="#8b8478" />
        </mesh>
        <mesh position={[0, -0.28, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.036, 0.46, 20]} />
          <meshStandardMaterial color="#5d665f" />
        </mesh>
        <mesh position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.14, 0.01, 10, 36]} />
          <meshStandardMaterial color="#5d665f" />
        </mesh>
        <mesh position={[0, -0.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.022, 36]} />
          <meshStandardMaterial color="#4f5852" />
        </mesh>
      </group>
    </group>
  )
}

/** どちらの端も上着の中へ入る高さ。裾から生えているように見せない。 */
const STRAP_BACK_HEM = 0.06
const STRAP_FRONT_HEM = 0.09
/** 肩の上を越える高さ。三角筋の膨らみ（〜0.50）より上を通す。 */
const STRAP_CREST = 0.535
/** 背中側・前側それぞれの取り付け角。0 が患者の左側面＝肩の頂点。 */
const STRAP_SWEEP = 1.16

/**
 * Shoulder straps of the patient's top.
 *
 * The strap is walked around the torso ring — up out of the garment at the
 * back, across the crest of the shoulder, and back down into the garment at the
 * front — so both ends disappear under the cloth instead of stopping in mid
 * air, and every sample sits on the body surface rather than beside it.
 */
function useStraps() {
  return useMemo(
    () =>
      [1, -1].map((side) => {
        const points: THREE.Vector3[] = []
        const normals: THREE.Vector3[] = []
        const samples = 18
        for (let i = 0; i <= samples; i += 1) {
          const t = i / samples
          const sweep = THREE.MathUtils.lerp(-STRAP_SWEEP, STRAP_SWEEP, t)
          // Mirroring in x is theta -> pi - theta, not -theta.
          const theta = side === 1 ? sweep : Math.PI - sweep
          const y =
            t < 0.5
              ? THREE.MathUtils.lerp(STRAP_BACK_HEM, STRAP_CREST, THREE.MathUtils.smoothstep(t, 0, 0.5))
              : THREE.MathUtils.lerp(STRAP_CREST, STRAP_FRONT_HEM, THREE.MathUtils.smoothstep(t, 0.5, 1))
          const normal = torsoNormal(y, theta, new THREE.Vector3())
          // Under the garment where they overlap, proud of the skin elsewhere.
          points.push(torsoPoint(y, theta, new THREE.Vector3()).addScaledVector(normal, 0.008))
          normals.push(normal)
        }
        return createBandGeometry(points, normals, 0.026)
      }),
    [],
  )
}

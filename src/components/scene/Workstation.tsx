import { createPortal, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { createRibbonGeometry, updateRibbonGeometry } from '../../lib/anatomy'
import { toolOrientation } from '../../lib/ik'
import { APPLY, LAYOUT, PEEL, type DemoState, ease, sampleTool, type ToolTarget } from '../../lib/sequence'

/** Tool control points published by the two suction heads. */
export type Cups = Partial<Record<'left' | 'right', THREE.Object3D>>

const TRAY = new THREE.Vector3(...(LAYOUT.trayCentre as [number, number, number]))
const BIN = new THREE.Vector3(...(LAYOUT.binCentre as [number, number, number]))
const TRAY_TOP = TRAY.y + 0.02
const PATCH_LENGTH = LAYOUT.patchSize[0]
const PATCH_WIDTH = LAYOUT.patchSize[1]
const PATCH_THICKNESS = 0.003
const FILM_Y = TRAY_TOP + PATCH_THICKNESS + 0.0006

const REFERENCE = new THREE.Vector3(0, 0, 1)

/**
 * The cart. The robot pedestal and the two uprights that carry the tray and the
 * waste bin all stand on one deck plate, so nothing in the workstation floats:
 * every part of it can be traced back down to the floor.
 */
const FRAME = '#79837c'
/** 塗装した鋼材。環境マップの映り込みで稜線が出る程度に金属寄りにする。 */
const STEEL = { metalness: 0.42, roughness: 0.42 }
const PLASTIC = { metalness: 0.08, roughness: 0.68 }
const TRAY_POST_Z = 0.235
const DECK = { x: 0.11, z: 0.1, width: 0.72, depth: 0.56, thickness: 0.055, top: 0.055 }
const POST_BASE = DECK.top - 0.012
const TRAY_PLATE_Y = TRAY.y - 0.026
const TRAY_POST_TOP = TRAY_PLATE_Y - 0.008
const BIN_PLATE_Y = BIN.y - 0.066
const BIN_POST_TOP = BIN_PLATE_Y - 0.008

/** Pose of a suction cup face at the current instant. */
function cupPose(side: 'left' | 'right', progress: number, target: ToolTarget) {
  sampleTool(side, progress, target)
  return {
    position: target.position,
    quaternion: toolOrientation(target.approach, REFERENCE),
  }
}

/**
 * The release liner. While it is still on the patch it lies flat; as cup B
 * lifts and wiggles, the free length is swept along a curve that always ends
 * exactly at the cup, so the film reads as one continuous sheet being peeled.
 */
function ReleaseLiner({ state, accent, cup }: { state: DemoState; accent: string; cup?: THREE.Object3D }) {
  const geometry = useMemo(() => createRibbonGeometry(56), [])
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const points = useMemo(() => Array.from({ length: 6 }, () => new THREE.Vector3()), [])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25), [points])
  const target = useMemo<ToolTarget>(
    () => ({ position: new THREE.Vector3(), approach: new THREE.Vector3(), vacuum: 0 }),
    [],
  )
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const held = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    if (!state.filmVisible) {
      mesh.visible = false
      return
    }
    mesh.visible = true

    // The free end hangs off the cup that is actually there, not off the pose
    // the solver was asked for — otherwise the film floats beside the tool.
    if (cup) cup.getWorldPosition(held)
    else held.copy(cupPose('right', state.progress, target).position)
    const leftEnd = TRAY.x - PATCH_LENGTH / 2
    const rightEnd = TRAY.x + PATCH_LENGTH / 2
    const frontX = THREE.MathUtils.lerp(rightEnd, leftEnd - 0.006, state.peelFront)

    // Once the liner is free it hangs from the cup instead of lying on the patch.
    const freed = ease(state.progress, PEEL.frontEnd - 0.01, PEEL.frontEnd + 0.03)
    const dropped = ease(state.progress, PEEL.discard, PEEL.discard + 0.016)

    points[0].set(leftEnd, FILM_Y, TRAY.z)
    points[1].set(THREE.MathUtils.lerp(leftEnd, frontX, 0.55), FILM_Y, TRAY.z)
    points[2].set(frontX, FILM_Y, TRAY.z)

    const freeLength = Math.max(0.01, rightEnd - frontX)
    points[3].set(
      frontX + Math.min(freeLength * 0.5, 0.03),
      FILM_Y + Math.min(freeLength * 0.62, 0.05),
      TRAY.z + 0.002,
    )
    points[4].lerpVectors(points[3], held, 0.62).addScaledVector(up, 0.012)
    points[5].copy(held)

    if (freed > 0.001) {
      // Hanging: the whole sheet trails below the cup.
      const hangA = held.clone().add(new THREE.Vector3(0.012, -0.13, 0.006))
      const hangB = held.clone().add(new THREE.Vector3(0.004, -0.075, 0.004))
      points[0].lerp(hangA, freed)
      points[1].lerp(hangB, freed)
      points[2].lerp(held.clone().add(new THREE.Vector3(0.002, -0.036, 0.002)), freed)
      points[3].lerp(held.clone().add(new THREE.Vector3(0.001, -0.018, 0.001)), freed)
      points[4].lerp(held, freed)
    }
    if (dropped > 0.001) {
      const rest = new THREE.Vector3(BIN.x - 0.01, BIN.y + 0.03, BIN.z)
      points.forEach((point, index) => {
        point.lerp(rest.clone().add(new THREE.Vector3(index * 0.012 - 0.03, 0, 0.008 * Math.sin(index))), dropped)
      })
    }

    updateRibbonGeometry(geometry, curve, PATCH_WIDTH * 0.99, up)
    if (materialRef.current) {
      materialRef.current.opacity = 0.9 * (1 - ease(state.progress, PEEL.discard + 0.006, PEEL.discard + 0.022))
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false} renderOrder={6}>
      <meshStandardMaterial
        ref={materialRef}
        color="#e7ecef"
        emissive={new THREE.Color(accent)}
        emissiveIntensity={0.06}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * A material that stops drawing the part of the patch the roller has
 * already laid onto the back, so the sheet transfers off the cup progressively
 * instead of vanishing in one frame. Local +Y runs up the back, matching the
 * direction the conformal patch on the patient reveals in.
 */
function usePatchMaterial(color: string) {
  return useMemo(() => {
    const uLaid = { value: 0 }
    const material = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uLaid = uLaid
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying float vAlong;\nvoid main() {')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vAlong = position.y / ${PATCH_WIDTH.toFixed(4)} + 0.5;`)
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uLaid;\nvarying float vAlong;\nvoid main() {')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (vAlong < uLaid) discard;')
    }
    return { material, uLaid }
  }, [color])
}

/**
 * The patch: waiting in the tray, then carried on cup A.
 *
 * The carried copy is parented to the cup rather than posed from the authored
 * trajectory. The solver always leaves some residual, so a patch placed at the
 * pose the arm was *asked* for drifts off the pad it is supposed to be stuck
 * to; as a child of the tool control point it cannot come loose.
 */
function Patch({ state, cup }: { state: DemoState; cup?: THREE.Object3D }) {
  const carried = state.progress > APPLY.pick
  const group = useRef<THREE.Group>(null)
  const body = usePatchMaterial('#f4f5ef')
  const adhesive = usePatchMaterial('#dfe8dc')

  useFrame(() => {
    body.uLaid.value = state.patchApplied
    adhesive.uLaid.value = state.patchApplied
    // The shadow pass does not run the cut, so drop the sheet outright once
    // the last of it has been laid down rather than leaving a stray shadow.
    if (group.current) group.current.visible = state.patchApplied < 0.995
  })

  useEffect(
    () => () => {
      body.material.dispose()
      adhesive.material.dispose()
    },
    [body, adhesive],
  )

  const sheet = (
    <>
      <mesh castShadow material={body.material}>
        <boxGeometry args={[PATCH_LENGTH, PATCH_WIDTH, PATCH_THICKNESS]} />
      </mesh>
      <mesh position={[0, 0, -PATCH_THICKNESS / 2 - 0.0004]} material={adhesive.material}>
        <planeGeometry args={[PATCH_LENGTH * 0.94, PATCH_WIDTH * 0.9]} />
      </mesh>
    </>
  )

  if (carried) {
    if (!cup) return null
    // The cup frame's -Z is the approach direction, so the patch sits just
    // beyond the sealing face with its adhesive side towards the back.
    return createPortal(
      <group ref={group} position={[0, 0, -PATCH_THICKNESS / 2]}>
        {sheet}
      </group>,
      cup,
    )
  }

  return (
    <group ref={group} position={[TRAY.x, TRAY_TOP + PATCH_THICKNESS / 2, TRAY.z]} rotation={[-Math.PI / 2, 0, 0]}>
      {sheet}
    </group>
  )
}

interface WorkstationProps {
  state: DemoState
  accents: { scan: string; intent: string; vac: string; force: string }
  cups: Cups
}

export function Workstation({ state, accents, cups }: WorkstationProps) {
  return (
    <group>
      {/* pedestal under the robot */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.5, 28]} />
        <meshStandardMaterial color="#4c574f" {...STEEL} />
      </mesh>
      {/* the deck: one base plate the pedestal and both uprights stand on */}
      <RoundedBox
        args={[DECK.width, DECK.thickness, DECK.depth]}
        radius={0.018}
        smoothness={3}
        position={[DECK.x, DECK.top - DECK.thickness / 2, DECK.z]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#8a938c" metalness={0.3} roughness={0.55} />
      </RoundedBox>

      {/* upright under the consumables tray, capped with its mounting plate */}
      <mesh position={[TRAY.x, (POST_BASE + TRAY_POST_TOP) / 2, TRAY_POST_Z]} castShadow receiveShadow>
        <boxGeometry args={[0.058, TRAY_POST_TOP - POST_BASE, 0.058]} />
        <meshStandardMaterial color={FRAME} {...STEEL} />
      </mesh>
      <mesh position={[TRAY.x, TRAY_PLATE_Y, TRAY_POST_Z]} castShadow receiveShadow>
        <boxGeometry args={[0.17, 0.016, 0.15]} />
        <meshStandardMaterial color="#8d968f" metalness={0.5} roughness={0.36} />
      </mesh>

      <group position={[TRAY.x, TRAY.y, TRAY.z]}>
        <RoundedBox args={[0.32, 0.04, 0.24]} radius={0.01} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color="#cfcdc2" {...PLASTIC} />
        </RoundedBox>
        <mesh position={[0, 0.0201, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.29, 0.21]} />
          <meshStandardMaterial color="#b9b7ac" {...PLASTIC} />
        </mesh>
        {/* low-tack pad that keeps the patch put while the liner is peeled */}
        <mesh position={[0, 0.0205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PATCH_LENGTH + 0.014, PATCH_WIDTH + 0.014]} />
          <meshStandardMaterial color="#9aa39c" {...PLASTIC} />
        </mesh>
      </group>

      {/* upright under the liner waste bin */}
      <mesh position={[BIN.x, (POST_BASE + BIN_POST_TOP) / 2, BIN.z]} castShadow receiveShadow>
        <boxGeometry args={[0.05, BIN_POST_TOP - POST_BASE, 0.05]} />
        <meshStandardMaterial color={FRAME} {...STEEL} />
      </mesh>
      <mesh position={[BIN.x, BIN_PLATE_Y, BIN.z]} castShadow receiveShadow>
        <cylinderGeometry args={[0.062, 0.062, 0.016, 24]} />
        <meshStandardMaterial color="#8d968f" metalness={0.5} roughness={0.36} />
      </mesh>

      {/* liner waste bin */}
      <group position={[BIN.x, BIN.y, BIN.z]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.062, 0.052, 0.12, 24, 1, true]} />
          <meshStandardMaterial color="#7c857e" side={THREE.DoubleSide} {...STEEL} />
        </mesh>
        {/* the floor of the bin — flat, so it reads as a container from above */}
        <mesh position={[0, -0.0575, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[0.053, 24]} />
          <meshStandardMaterial color="#4c554f" {...STEEL} />
        </mesh>
      </group>

      <Patch state={state} cup={cups.left} />
      <ReleaseLiner state={state} accent={accents.vac} cup={cups.right} />
    </group>
  )
}

import { useGLTF } from '@react-three/drei'
import { createPortal, useFrame, useLoader } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import URDFLoader, { type URDFRobot } from 'urdf-loader'
import { ArmChain, toolOrientation } from '../../lib/ik'
import { LAYOUT, type DemoState, sampleTool, type ToolTarget } from '../../lib/sequence'
import { SuctionHead, TOOL_LENGTH } from './EndEffector'

const PACKAGE_ROOT = '/models/openarm'
/**
 * Intel の realsense-ros が配っている D435 の Collada（231k 面・15.7 MB）を
 * 二次誤差で 12.5k 面へ落として GLB に固め直したもの。D435f は
 * 筐体が D435 と同一で、差分は撮像素子側の 750 nm IR パスフィルタだけ。
 */
const D435_URL = '/models/realsense/d435.glb'

class OpenArmLoader extends THREE.Loader<URDFRobot> {
  load(
    url: string,
    onLoad: (robot: URDFRobot) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    const loader = new URDFLoader(this.manager)
    loader.packages = { openarm_description: PACKAGE_ROOT }
    loader.parseCollision = false
    loader.load(url, onLoad, onProgress, onError)
  }
}

/**
 * 実機の OpenArm 2.0 は黒一色に近い。工程ごとの色分けはしないで、
 * つや消しの黒〜グラファイトの幅だけで面を分ける。
 */
const SHELL = '#33383b'
const DEEP = '#191c1e'
const TRIM = '#3f4548'

function linkColor(name: string) {
  if (name.includes('body_link0')) return '#2b2f31'
  if (name.includes('base_link')) return DEEP
  const number = Number(name.match(/link(\d+)/)?.[1] ?? 0)
  if (number === 1) return DEEP
  if (number === 4) return TRIM
  return SHELL
}

/**
 * 胸板の前面を body_link0 にレイを飛ばして実測した値。y = 1.10 より下は
 * z = 0.030 の垂直な平面で、その上は前へ張り出す。座面は下の平面に取る。
 */
const CHEST_Z = 0.03
const PLATE_AT = [0, 1.055, CHEST_Z] as const
const PLATE_THICKNESS = 0.009
/** 座面の上端。ここから支柱を伸ばしてカメラ裏面につなぐ。 */
const STRUT_FROM = [0, 1.07, CHEST_Z + PLATE_THICKNESS] as const

/** カメラ本体の据え付け位置と俯角。背中の貼付点をまっすぐ見下ろす。 */
const CAMERA_AT = [0, 1.082, 0.068] as const
const CAMERA_PITCH = -0.32

/**
 * Chest-mounted depth camera — RealSense D435f. Static, so it lives in world
 * coordinates. The mesh's own origin sits on the front face, so the body is
 * pushed forward by half its depth to straddle the mount like the bracket does.
 *
 * 実機はアルミ筐体なので、機体の黒とは対照的に金属で置く。取り付けは
 * 胸板に密着するベースプレートと、そこからカメラ裏面まで伸ばした支柱の
 * 2 部品で、宙に浮かせない。
 */
function DepthCamera({ accent, active }: { accent: string; active: number }) {
  const lens = useRef<THREE.Mesh>(null)
  const { nodes } = useGLTF(D435_URL) as unknown as { nodes: Record<string, THREE.Mesh> }

  useFrame((state) => {
    if (!lens.current) return
    const material = lens.current.material as THREE.MeshBasicMaterial
    material.opacity = 0.35 + active * (0.4 + 0.25 * Math.sin(state.clock.elapsedTime * 5))
  })

  // 座面からカメラ裏面までを 1 本の支柱で結ぶ。長さも向きも両端から出す。
  const strut = useMemo(() => {
    const from = new THREE.Vector3(...STRUT_FROM)
    const to = new THREE.Vector3(...CAMERA_AT)
    const span = to.clone().sub(from)
    return {
      position: from.clone().addScaledVector(span, 0.5).toArray() as [number, number, number],
      pitch: -Math.atan2(span.y, span.z),
      length: span.length() + 0.012,
    }
  }, [])

  return (
    <group>
      {/* 胸板の平面に伏せて当たるベースプレート */}
      <group position={PLATE_AT as unknown as [number, number, number]}>
        <mesh position={[0, 0, PLATE_THICKNESS / 2]} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.062, PLATE_THICKNESS]} />
          <meshStandardMaterial color="#aeb4b7" metalness={0.55} roughness={0.4} />
        </mesh>
        {/* 四隅の締結ボルト */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sy) => (
            <mesh
              key={`${sx}${sy}`}
              position={[sx * 0.026, sy * 0.022, PLATE_THICKNESS + 0.001]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.0032, 0.0032, 0.004, 10]} />
              <meshStandardMaterial color="#6b7275" metalness={0.7} roughness={0.35} />
            </mesh>
          )),
        )}
      </group>

      {/* 座面とカメラ裏面をつなぐ支柱 */}
      <mesh position={strut.position} rotation={[strut.pitch, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.03, 0.024, strut.length]} />
        <meshStandardMaterial color="#9ba1a4" metalness={0.55} roughness={0.42} />
      </mesh>

      <group position={CAMERA_AT as unknown as [number, number, number]} rotation={[CAMERA_PITCH, 0, 0]}>
        {/* カメラ裏の取り付け座 */}
        <mesh position={[0, 0, -0.006]} castShadow>
          <boxGeometry args={[0.05, 0.032, 0.012]} />
          <meshStandardMaterial color="#aeb4b7" metalness={0.55} roughness={0.4} />
        </mesh>
        <group position={[0, 0, 0.0125]}>
          <mesh geometry={nodes.body.geometry} castShadow>
            <meshStandardMaterial color="#d3d7d9" metalness={0.72} roughness={0.29} />
          </mesh>
          {/* 前面はレンズ窓のガラス。金属の筐体と質感を分ける */}
          <mesh geometry={nodes.detail.geometry}>
            <meshStandardMaterial color="#23282c" metalness={0.45} roughness={0.2} />
          </mesh>
        </group>
        {/* IR プロジェクタが投げているパターンの当たりを 1 枚で示す */}
        <mesh ref={lens} position={[0, 0, 0.0135]}>
          <planeGeometry args={[0.014, 0.008]} />
          <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload(D435_URL)

interface OpenArmRigProps {
  state: DemoState
  accents: { scan: string; vac: string; force: string }
  /** Publishes the tool control point of each cup once the head exists. */
  onCup: (side: 'left' | 'right', cup: THREE.Object3D | null) => void
}

export function OpenArmRig({ state, accents, onCup }: OpenArmRigProps) {
  const robot = useLoader(OpenArmLoader, `${PACKAGE_ROOT}/urdf/openarm-v2.urdf`)
  const [chains, setChains] = useState<{ left: ArmChain; right: ArmChain } | null>(null)
  const groupRef = useRef<THREE.Group>(null)

  const targets = useMemo(
    () => ({
      left: { position: new THREE.Vector3(), approach: new THREE.Vector3(), vacuum: 0 } as ToolTarget,
      right: { position: new THREE.Vector3(), approach: new THREE.Vector3(), vacuum: 0 } as ToolTarget,
    }),
    [],
  )
  const reference = useMemo(() => new THREE.Vector3(0, 0, 1), [])

  useEffect(() => {
    // Every visual .dae in the OpenArm package was exported from Blender with
    // its default scene, so each one ships a point light of colour 1000/1000/1000
    // and a camera. Left in place they blow the whole room out to white.
    const strays: THREE.Object3D[] = []
    robot.traverse((child) => {
      if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera) strays.push(child)
    })
    strays.forEach((stray) => stray.removeFromParent())

    robot.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      // The retrofit tool is parented into the wrist link, so it would be
      // caught by this pass and flattened to one link colour. It arrives with
      // its own materials; leave everything under it alone.
      for (let node = child.parent; node && node !== robot; node = node.parent) {
        if (node.userData.retrofit) return
      }
      let link: THREE.Object3D | null = child.parent
      while (link && link !== robot && !link.name.startsWith('openarm_')) link = link.parent
      const name = link?.name ?? ''
      // The whole pinch gripper — housing and fingers — comes off; the suction
      // head bolts onto the joint 7 flange in its place.
      if (name.includes('ee_link') || name.includes('ee_base_link')) {
        child.visible = false
        return
      }
      child.castShadow = true
      child.receiveShadow = true
      const color = linkColor(name)
      // Standard, not Lambert: a matte black body has no shading cue under
      // diffuse-only light. The environment map's specular is what draws the
      // edges of every link.
      const sources = Array.isArray(child.material) ? child.material : [child.material]
      const replacement = sources.map(
        () => new THREE.MeshStandardMaterial({ color, metalness: 0.34, roughness: 0.46 }),
      )
      child.material = Array.isArray(child.material) ? replacement : replacement[0]
    })
    if (import.meta.env.DEV) {
      ;(window as unknown as { __rig?: URDFRobot }).__rig = robot
    }
  }, [robot])

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.updateWorldMatrix(true, true)
    robot.updateMatrixWorld(true)
    const left = new ArmChain(robot, 'left', { toolOffset: new THREE.Vector3(0, 0, -TOOL_LENGTH) })
    const right = new ArmChain(robot, 'right', { toolOffset: new THREE.Vector3(0, 0, -TOOL_LENGTH) })
    left.setJoints((LAYOUT.homeJointsLeft as number[]).map(THREE.MathUtils.degToRad))
    right.setJoints((LAYOUT.homeJointsRight as number[]).map(THREE.MathUtils.degToRad))
    left.setRestPose(left.q.slice())
    right.setRestPose(right.q.slice())
    left.apply()
    right.apply()
    setChains({ left, right })
  }, [robot])

  const lastProgress = useRef(-1)

  useFrame(() => {
    if (!chains) return
    // A scrub or a jump to another stage moves the tool much further than one
    // frame of tracking can cover, so spend extra iterations to land on pose.
    const jumped = Math.abs(state.progress - lastProgress.current) > 0.01
    lastProgress.current = state.progress
    const iterations = jumped ? 90 : 14
    for (const side of ['left', 'right'] as const) {
      const target = sampleTool(side, state.progress, targets[side])
      const chain = chains[side]
      chain.solve(target.position, toolOrientation(target.approach, reference), iterations)
      chain.apply()
    }
  })

  const eeLeft = robot.links.openarm_left_ee_base_link
  const eeRight = robot.links.openarm_right_ee_base_link

  return (
    <>
      <group ref={groupRef} position={LAYOUT.robotBase as [number, number, number]} rotation-y={Math.PI / 2}>
        <primitive object={robot} rotation-x={-Math.PI / 2} />
      </group>

      {/* The applicator arm carries the press roller; the peeling arm does not. */}
      {eeLeft &&
        createPortal(
          <SuctionHead
            vacuum={state.vacuumA}
            accent={accents.force}
            side="left"
            onCup={onCup}
            roller={{ deploy: state.rollerDeploy, load: state.rollerLoad }}
          />,
          eeLeft,
        )}
      {eeRight &&
        createPortal(
          <SuctionHead
            vacuum={state.vacuumB}
            accent={accents.vac}
            side="right"
            onCup={onCup}
          />,
          eeRight,
        )}

      <DepthCamera accent={accents.scan} active={state.stage.id === 'scan' ? 1 : 0.15} />
    </>
  )
}

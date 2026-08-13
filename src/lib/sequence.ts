import * as THREE from 'three'
import trajectory from './trajectory.json'

/**
 * Single source of truth for the demo timeline.
 *
 * Everything the UI shows — stage copy, telemetry numbers, camera framing — is
 * derived from one normalised progress value, so the 3D scene and the HUD can
 * never disagree about what the robot is doing.
 */

export const DEMO_SECONDS = trajectory.duration
export const LAYOUT = trajectory.layout

export type StageId = 'scan' | 'intent' | 'peel' | 'apply'

export interface Stage {
  id: StageId
  index: number
  number: string
  start: number
  end: number
  kicker: string
  title: string
  summary: string
  method: string
  accent: string
}

export const STAGES: Stage[] = [
  {
    id: 'scan',
    index: 0,
    number: '01',
    start: 0,
    end: 0.2,
    kicker: 'Depth scan',
    title: '背中を3Dスキャンする',
    summary: '胸部のRealSenseで背中と肩を撮り、cm精度の3Dモデルを起こす。',
    method: 'RealSense D435f / TSDF統合',
    accent: '#1183a0',
  },
  {
    id: 'intent',
    index: 1,
    number: '02',
    start: 0.2,
    end: 0.34,
    kicker: 'Intent capture',
    title: '本人に貼る位置を聞く',
    summary: '貼ってほしい場所を手で押さえてもらい、指先を貼付点として確定する。',
    method: 'MediaPipe Hand Landmarker + 点群',
    accent: '#2f6b53',
  },
  {
    id: 'peel',
    index: 2,
    number: '03',
    start: 0.34,
    end: 0.7,
    kicker: 'Vacuum peel',
    title: '両端を吸って、フィルムを剥がす',
    summary: '12V真空ポンプ2台。片方は湿布を押さえたまま固定、もう片方が揺すって剥離を進める。',
    method: '12V DCダイアフラムポンプ × 2',
    accent: '#4a63c8',
  },
  {
    id: 'apply',
    index: 3,
    number: '04',
    start: 0.7,
    end: 1,
    kicker: 'Force control',
    title: '接触を検知して、押し当てる',
    summary: '接触した瞬間を力で捉え、目標押付力を保ったまま端から圧着する。',
    method: '6軸力覚センサ / 電流トルク推定',
    accent: '#ff6b45',
  },
]

export function stageAt(progress: number) {
  for (let index = STAGES.length - 1; index >= 0; index -= 1) {
    if (progress >= STAGES[index].start) return STAGES[index]
  }
  return STAGES[0]
}

export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

export function ramp(value: number, start: number, end: number) {
  return clamp01((value - start) / (end - start))
}

export function smoother(value: number) {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function ease(value: number, start: number, end: number) {
  return smoother(ramp(value, start, end))
}

/** Trapezoid: rises over [a,b], holds, falls over [c,d]. */
export function window4(value: number, a: number, b: number, c: number, d: number) {
  return smoother(ramp(value, a, b)) * (1 - smoother(ramp(value, c, d)))
}

export interface Waypoint {
  t: number
  p: [number, number, number]
  a: [number, number, number]
  v: number
}

const WAYPOINTS: Record<'left' | 'right', Waypoint[]> = {
  left: trajectory.left as Waypoint[],
  right: trajectory.right as Waypoint[],
}

const _p = new THREE.Vector3()
const _a = new THREE.Vector3()

export interface ToolTarget {
  position: THREE.Vector3
  approach: THREE.Vector3
  vacuum: number
}

/** The wiggle that walks the peel front along the liner. */
export function peelWiggle(progress: number, target = new THREE.Vector3()) {
  if (progress < PEEL.wiggleStart || progress > PEEL.wiggleEnd) return target.set(0, 0, 0)
  const u = (progress - PEEL.wiggleStart) / (PEEL.wiggleEnd - PEEL.wiggleStart)
  const amplitude = Math.sin(clamp01(u) * Math.PI) ** 0.6
  return target.set(
    0.011 * Math.sin(2 * Math.PI * 6.5 * u),
    0.006 * Math.sin(2 * Math.PI * 6.5 * u + 1.9),
    0.008 * Math.sin(2 * Math.PI * 5.5 * u + 0.7),
  ).multiplyScalar(amplitude)
}

export function sampleTool(side: 'left' | 'right', progress: number, out: ToolTarget) {
  const keys = WAYPOINTS[side]
  let from = keys[0]
  let to = keys[keys.length - 1]
  let amount = 0

  if (progress <= keys[0].t) {
    from = to = keys[0]
  } else {
    for (let index = 0; index < keys.length - 1; index += 1) {
      if (progress <= keys[index + 1].t) {
        from = keys[index]
        to = keys[index + 1]
        amount = smoother((progress - from.t) / (to.t - from.t))
        break
      }
      if (index === keys.length - 2) {
        from = to = keys[keys.length - 1]
      }
    }
  }

  out.position.set(from.p[0], from.p[1], from.p[2]).lerp(_p.set(to.p[0], to.p[1], to.p[2]), amount)
  out.approach.set(from.a[0], from.a[1], from.a[2]).lerp(_a.set(to.a[0], to.a[1], to.a[2]), amount).normalize()
  out.vacuum = amount < 0.5 ? from.v : to.v

  if (side === 'right') out.position.add(peelWiggle(progress, _p))
  return out
}

/** Key instants inside the peel stage, shared by the scene and the readouts. */
export const PEEL = {
  seatA: 0.41,
  seatB: 0.415,
  wiggleStart: 0.44,
  wiggleEnd: 0.63,
  frontStart: 0.45,
  frontEnd: 0.628,
  releaseA: 0.625,
  discard: 0.782,
}

export const APPLY = {
  pick: 0.785,
  approach: 0.885,
  contact: 0.905,
  press: 0.925,
  rollEnd: 0.972,
  release: 0.972,
}

export interface DemoState {
  progress: number
  stage: Stage
  /** 0..1 fraction of the depth cloud that has been captured. */
  scanReveal: number
  /** How present the captured cloud stays once the scan is done. */
  cloudPresence: number
  /** Fade of the reconstructed surface overlay. */
  meshFade: number
  /** Patient raises a hand to point at the spot. */
  handRaise: number
  landmarkFade: number
  targetLock: number
  /** 0..1 fraction of the liner already separated from the patch. */
  peelFront: number
  vacuumA: number
  vacuumB: number
  filmVisible: boolean
  filmHeld: boolean
  patchCarried: number
  patchApplied: number
  /** Press roller: 0 folded against the tool, 1 swung out over the back. */
  rollerDeploy: number
  /** How hard the roller is pressed into the back, so its springs compress. */
  rollerLoad: number
  contactForce: number
  contactBloom: number
}

export function demoState(progress: number): DemoState {
  const stage = stageAt(progress)

  const scanReveal = ease(progress, 0.02, 0.16)
  // The captured cloud stays up while the patient chooses a spot, drops away
  // during the peel, and returns faintly as the patch is pressed on.
  const cloudPresence =
    1 -
    0.62 * smoother(ramp(progress, 0.2, 0.26)) -
    0.38 * smoother(ramp(progress, 0.34, 0.4)) +
    0.34 * smoother(ramp(progress, 0.84, 0.9))
  const meshFade = window4(progress, 0.13, 0.19, 0.9, 0.97)

  const handRaise = window4(progress, 0.2, 0.26, 0.33, 0.38)
  const landmarkFade = window4(progress, 0.225, 0.265, 0.335, 0.37)
  const targetLock = ease(progress, 0.285, 0.315)

  const peelFront = ease(progress, PEEL.frontStart, PEEL.frontEnd)
  const holdLiner = window4(progress, PEEL.seatA, PEEL.seatA + 0.012, PEEL.releaseA, PEEL.releaseA + 0.012)
  const carryPatch = window4(progress, APPLY.pick, APPLY.pick + 0.012, APPLY.release, APPLY.release + 0.014)
  const vacuumA = Math.max(holdLiner, carryPatch)
  const vacuumB = window4(progress, PEEL.seatB, PEEL.seatB + 0.012, PEEL.discard, PEEL.discard + 0.012)

  // The roller swings out while the arm is still on approach, so it is already
  // trailing the cup by the time the first edge of the patch touches down.
  const rollerDeploy = window4(progress, APPLY.approach - 0.05, APPLY.approach - 0.005, APPLY.release + 0.004, APPLY.release + 0.03)
  const rollerLoad = window4(progress, APPLY.contact, APPLY.press, APPLY.rollEnd, APPLY.rollEnd + 0.008)

  // Contact force ramps as the cup presses, holds through the roll, then drops.
  const press = window4(progress, APPLY.contact, APPLY.press, APPLY.rollEnd, APPLY.rollEnd + 0.012)
  const jitter = Math.sin(progress * 620) * 0.06 + Math.sin(progress * 211) * 0.04
  const contactForce = press * (4.1 + jitter) + (1 - press) * 0.05

  return {
    progress,
    stage,
    scanReveal,
    cloudPresence: clamp01(cloudPresence),
    meshFade,
    handRaise,
    landmarkFade,
    targetLock,
    peelFront,
    vacuumA,
    vacuumB,
    filmVisible: progress > 0.34 && progress < PEEL.discard + 0.02,
    filmHeld: progress > PEEL.seatB,
    patchCarried: carryPatch,
    patchApplied: ease(progress, APPLY.contact, APPLY.rollEnd),
    rollerDeploy,
    rollerLoad,
    contactForce,
    contactBloom: window4(progress, APPLY.contact - 0.004, APPLY.contact + 0.01, APPLY.rollEnd, APPLY.rollEnd + 0.02),
  }
}

/** Numbers shown in the telemetry rail, one set per stage. */
export function telemetry(state: DemoState) {
  const { progress } = state
  const wobble = (amount: number, speed: number) => Math.sin(progress * speed) * amount

  switch (state.stage.id) {
    case 'scan':
      return {
        heading: 'Depth pipeline',
        rows: [
          { label: '取得点群', value: Math.round(state.scanReveal * 47800).toLocaleString('en-US'), unit: 'pts' },
          { label: 'ボクセル', value: '4.0', unit: 'mm' },
          { label: '面残差 RMS', value: (9.4 - state.scanReveal * 3.1 + wobble(0.15, 40)).toFixed(1), unit: 'mm' },
        ],
        state: state.scanReveal > 0.98 ? { label: 'Reconstruction', value: 'モデル生成完了' } : { label: 'Reconstruction', value: 'スキャン中' },
      }
    case 'intent':
      return {
        heading: 'Intent capture',
        rows: [
          { label: 'ランドマーク', value: state.landmarkFade > 0.4 ? '21 / 21' : '—', unit: '' },
          { label: '検出信頼度', value: (0.93 + state.landmarkFade * 0.05 + wobble(0.006, 33)).toFixed(2), unit: '' },
          { label: '貼付点 深度', value: (438 + wobble(1.4, 27)).toFixed(0), unit: 'mm' },
        ],
        state: state.targetLock > 0.9
          ? { label: 'Target', value: '左肩甲骨下部で確定' }
          : { label: 'Target', value: '指先を追跡中' },
      }
    case 'peel': {
      const kpaA = -62 * state.vacuumA + wobble(0.5, 60) * state.vacuumA
      const kpaB = -61 * state.vacuumB + wobble(0.6, 71) * state.vacuumB
      return {
        heading: 'Vacuum peel',
        rows: [
          { label: 'ポンプ A 固定側', value: kpaA.toFixed(1), unit: 'kPa' },
          { label: 'ポンプ B 剥離側', value: kpaB.toFixed(1), unit: 'kPa' },
          { label: '剥離進捗', value: (state.peelFront * 100).toFixed(0), unit: '%' },
        ],
        state: state.peelFront > 0.99
          ? { label: 'Liner', value: '剥離完了・廃棄へ' }
          : { label: 'Liner', value: '揺動剥離 6.5 Hz' },
      }
    }
    default:
      return {
        heading: 'Force control',
        rows: [
          { label: '押付力 Fz', value: state.contactForce.toFixed(2), unit: 'N' },
          { label: '横力 |Fxy|', value: (state.contactForce * 0.14 + Math.abs(wobble(0.05, 90))).toFixed(2), unit: 'N' },
          { label: '目標力', value: '4.00', unit: 'N' },
        ],
        state: state.contactForce > 0.4
          ? { label: 'Contact', value: '接触検知・力制御中' }
          : { label: 'Contact', value: '非接触' },
      }
  }
}

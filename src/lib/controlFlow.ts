import { APPLY, PEEL, type DemoState } from './sequence'

/**
 * 制御フローを SFC（IEC 61131-3 Sequential Function Chart）の語彙で書き下したもの。
 *
 * ステップの区間は動作シーケンスと同じ progress 軸に載せてあるので、
 * 図は再生位置からそのまま「いまどのステップにいるか」を出せる。
 * 数値も同じ state から引くため、3D・テレメトリ・この図が食い違うことはない。
 */

/** SFC のアクション修飾子。N=非保持、S=セット、R=リセット、P=パルス。 */
export type Qualifier = 'N' | 'S' | 'R' | 'P'

export interface SfcAction {
  qualifier: Qualifier
  label: string
  /** 実行中に出す実測値。テレメトリと同じ state から作る。 */
  readout?: (state: DemoState) => string
}

export interface SfcStep {
  id: string
  name: string
  /** このステップが占める progress 区間 [from, to)。 */
  from: number
  to: number
  /** 初期ステップは二重枠で描く。 */
  initial?: boolean
  actions: SfcAction[]
}

export type SfcRow =
  | { kind: 'step'; step: SfcStep }
  | { kind: 'transition'; at: number; condition: string }
  /** 同時に走る枝。上下を二重線で挟む。 */
  | { kind: 'parallel'; branches: SfcStep[] }
  | { kind: 'jump'; to: string }

const kPa = (value: number) => `${value.toFixed(1)} kPa`

export const CONTROL_FLOW: SfcRow[] = [
  {
    kind: 'step',
    step: {
      id: 'S0',
      name: '待機・初期姿勢',
      from: 0,
      to: 0.02,
      initial: true,
      actions: [
        { qualifier: 'N', label: 'ホームポーズ保持' },
        { qualifier: 'R', label: '真空 2 系統を大気開放' },
      ],
    },
  },
  { kind: 'transition', at: 0.02, condition: '開始指令' },
  {
    kind: 'step',
    step: {
      id: 'S1',
      name: '背中を深度スキャン',
      from: 0.02,
      to: 0.2,
      actions: [
        {
          qualifier: 'N',
          label: 'RealSense D435f で深度取得',
          readout: (state) => `${Math.round(state.scanReveal * 47800).toLocaleString('en-US')} pts`,
        },
        { qualifier: 'N', label: 'TSDF 統合 voxel 4.0 mm' },
      ],
    },
  },
  { kind: 'transition', at: 0.2, condition: '面残差 RMS ≤ 6.3 mm' },
  {
    kind: 'step',
    step: {
      id: 'S2',
      name: '本人に貼付位置を聞く',
      from: 0.2,
      to: 0.34,
      actions: [
        { qualifier: 'N', label: 'MediaPipe Hand Landmarker' },
        {
          qualifier: 'S',
          label: '指先ランドマーク #8 を貼付点にロック',
          readout: (state) => (state.targetLock > 0.9 ? 'locked' : 'tracking'),
        },
      ],
    },
  },
  { kind: 'transition', at: 0.34, condition: '貼付点の深度が 3 フレーム安定' },
  {
    kind: 'step',
    step: {
      id: 'S3',
      name: '双腕の軌道を生成',
      from: 0.34,
      to: PEEL.seatA,
      actions: [
        { qualifier: 'N', label: '7 DoF × 2 の逆運動学' },
        { qualifier: 'N', label: '自己干渉・可達性チェック' },
      ],
    },
  },
  { kind: 'transition', at: PEEL.seatA, condition: 'IK 解あり・両腕とも可達' },
  {
    kind: 'parallel',
    branches: [
      {
        id: 'S4A',
        name: 'パッド A：湿布を押さえる',
        from: PEEL.seatA,
        to: PEEL.wiggleStart,
        actions: [
          {
            qualifier: 'S',
            label: 'ポンプ A ON（固定側）',
            readout: (state) => kPa(-62 * state.vacuumA),
          },
        ],
      },
      {
        id: 'S4B',
        name: 'パッド B：ライナー端を吸う',
        from: PEEL.seatB,
        to: PEEL.wiggleStart,
        actions: [
          {
            qualifier: 'S',
            label: 'ポンプ B ON（剥離側）',
            readout: (state) => kPa(-61 * state.vacuumB),
          },
        ],
      },
    ],
  },
  { kind: 'transition', at: PEEL.wiggleStart, condition: '両系統とも −55 kPa 以下' },
  {
    kind: 'step',
    step: {
      id: 'S5',
      name: '揺動してフィルムを剥がす',
      from: PEEL.wiggleStart,
      to: PEEL.frontEnd,
      actions: [
        { qualifier: 'N', label: 'パッド B を 6.5 Hz で揺動' },
        {
          qualifier: 'N',
          label: '剥離フロントを追従',
          readout: (state) => `${(state.peelFront * 100).toFixed(0)} %`,
        },
      ],
    },
  },
  { kind: 'transition', at: PEEL.frontEnd, condition: '剥離進捗 = 100 %' },
  {
    kind: 'step',
    step: {
      id: 'S6',
      name: 'ライナーを廃棄',
      from: PEEL.frontEnd,
      to: APPLY.pick,
      actions: [
        { qualifier: 'N', label: '廃棄ボックス上へ移送' },
        { qualifier: 'R', label: 'ポンプ B OFF・大気開放' },
      ],
    },
  },
  { kind: 'transition', at: APPLY.pick, condition: 'パッド B 大気開放を確認' },
  {
    kind: 'step',
    step: {
      id: 'S7',
      name: '貼付点へ接近',
      from: APPLY.pick,
      to: APPLY.contact,
      actions: [
        { qualifier: 'N', label: '法線方向に 20 mm/s で接近' },
        {
          qualifier: 'N',
          label: '6 軸力覚センサを監視',
          readout: (state) => `Fz ${state.contactForce.toFixed(2)} N`,
        },
        { qualifier: 'P', label: '圧着ローラを展開' },
      ],
    },
  },
  { kind: 'transition', at: APPLY.contact, condition: 'Fz ≥ 0.4 N（接触検知）' },
  {
    kind: 'step',
    step: {
      id: 'S8',
      name: '力を保ったまま圧着',
      from: APPLY.contact,
      to: APPLY.rollEnd,
      actions: [
        {
          qualifier: 'N',
          label: '力制御 目標 Fz = 4.0 N',
          readout: (state) => `Fz ${state.contactForce.toFixed(2)} N`,
        },
        {
          qualifier: 'N',
          label: 'ローラで端から走査',
          readout: (state) => `${(state.patchApplied * 100).toFixed(0)} %`,
        },
      ],
    },
  },
  { kind: 'transition', at: APPLY.rollEnd, condition: 'ローラ走査が端まで到達' },
  {
    kind: 'step',
    step: {
      id: 'S9',
      name: 'パッド解放・退避',
      from: APPLY.rollEnd,
      to: 1,
      actions: [
        { qualifier: 'R', label: 'ポンプ A OFF・大気開放' },
        { qualifier: 'N', label: 'ホームポーズへ退避' },
      ],
    },
  },
  { kind: 'jump', to: 'S0' },
]

export type StepStatus = 'done' | 'active' | 'todo'

export function stepStatus(step: SfcStep, progress: number): StepStatus {
  if (progress >= step.to) return 'done'
  if (progress >= step.from) return 'active'
  return 'todo'
}

/** 全ステップを平らに並べたもの。キーボード操作と件数表示に使う。 */
export const FLOW_STEPS: SfcStep[] = CONTROL_FLOW.flatMap((row) =>
  row.kind === 'step' ? [row.step] : row.kind === 'parallel' ? row.branches : [],
)

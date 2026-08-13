import { CONTROL_FLOW, type SfcStep, stepStatus } from '../lib/controlFlow'
import type { DemoState } from '../lib/sequence'

/**
 * 制御フローを SFC（Sequential Function Chart）で描く。
 *
 * ステップの縦連鎖・遷移条件の横バー・同時実行の二重線という SFC の書式を
 * そのまま守りつつ、いま通過しているステップを再生位置から塗る。図は
 * lib/controlFlow.ts のデータだけで決まり、描画側は状態を持たない。
 */

function StepBox({
  step,
  state,
  onSelect,
}: {
  step: SfcStep
  state: DemoState
  onSelect: (progress: number) => void
}) {
  const status = stepStatus(step, state.progress)

  return (
    <div className={`sfc-step is-${status}`}>
      <button
        type="button"
        className="sfc-step-box"
        onClick={() => onSelect(step.from + 0.001)}
        aria-current={status === 'active' ? 'step' : undefined}
      >
        <span className="sfc-step-id">{step.id}</span>
        <span className="sfc-step-name">{step.name}</span>
      </button>
      <ul className="sfc-actions">
        {step.actions.map((action) => (
          <li key={action.label}>
            <span className="sfc-qualifier">{action.qualifier}</span>
            <span className="sfc-action-label">{action.label}</span>
            {action.readout && (
              <span className="sfc-readout">{status === 'todo' ? '—' : action.readout(state)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ControlChart({
  state,
  onSelect,
}: {
  state: DemoState
  onSelect: (progress: number) => void
}) {
  return (
    <div className="sfc" role="list" aria-label="制御フロー（SFC）">
      {CONTROL_FLOW.map((row, index) => {
        if (row.kind === 'step') {
          return (
            <div className="sfc-row" role="listitem" key={row.step.id}>
              <StepBox step={row.step} state={state} onSelect={onSelect} />
            </div>
          )
        }

        if (row.kind === 'transition') {
          const fired = state.progress >= row.at
          return (
            <div className={`sfc-row sfc-transition${fired ? ' is-fired' : ''}`} key={`t${index}`}>
              <span className="sfc-bar" aria-hidden="true" />
              <span className="sfc-condition">{row.condition}</span>
            </div>
          )
        }

        if (row.kind === 'parallel') {
          const open = state.progress >= Math.min(...row.branches.map((branch) => branch.from))
          return (
            <div className={`sfc-row sfc-parallel${open ? ' is-open' : ''}`} key={`p${index}`}>
              <span className="sfc-rail" aria-hidden="true" />
              <div className="sfc-branches">
                {row.branches.map((branch) => (
                  <div className="sfc-branch" role="listitem" key={branch.id}>
                    <StepBox step={branch} state={state} onSelect={onSelect} />
                  </div>
                ))}
              </div>
              <span className="sfc-rail" aria-hidden="true" />
            </div>
          )
        }

        return (
          <div className="sfc-row sfc-jump" key={`j${index}`}>
            <span className="sfc-jump-mark" aria-hidden="true" />
            {row.to} へ戻る
          </div>
        )
      })}
    </div>
  )
}

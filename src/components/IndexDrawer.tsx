import { useEffect, useRef } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { STAGES } from '../lib/sequence'

/**
 * 右から出るインデックス。ヘッダーのナビは幅の狭い画面で畳まれるので、
 * 工程へのジャンプとドシエへの移動はここに集約している。
 * 中身はすべてページ上に既にある見出しで、新しい文言は持たせない。
 */

const DOSSIER_LINKS = [
  { id: 'control-flow', title: '制御フロー（SFC）' },
  { id: 'dsr-architecture', title: 'システム構成' },
  { id: 'dsr-pipeline', title: '4 工程の技術詳細' },
  { id: 'dsr-bom', title: 'ハードウェア構成とコスト' },
  { id: 'dsr-decision', title: '力覚センサをどうするか' },
  { id: 'dsr-open-questions', title: 'リスクと検証計画' },
  { id: 'dsr-references', title: '出典' },
]

export default function IndexDrawer({
  open,
  onClose,
  activeIndex,
  progress,
  onSelectStage,
}: {
  open: boolean
  onClose: () => void
  activeIndex: number
  progress: number
  onSelectStage: (index: number) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const goTo = (id: string) => {
    onClose()
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="fixed inset-0 z-50 lg:z-50">
      <button
        type="button"
        aria-label="閉じる"
        className="absolute inset-0 w-full cursor-default bg-black/20 backdrop-blur-xs"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="インデックス"
        className="drawer-panel"
        style={{ maxWidth: 'var(--drawer-max)', padding: 'var(--drawer-pad)' }}
      >
        <header className="flex items-start justify-between gap-4">
          <h2 className="drawer-title font-orbitron">INDEX</h2>
          <button ref={closeRef} type="button" className="drawer-close" onClick={onClose} aria-label="閉じる">
            <X strokeWidth={1.5} style={{ width: 'var(--icon)', height: 'var(--icon)' }} />
          </button>
        </header>

        <div className="drawer-body">
          <p className="drawer-section-label">動作シーケンス</p>
          <ul className="drawer-list">
            {STAGES.map((stage, index) => {
              const done = progress > stage.end - 0.001
              const active = index === activeIndex
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    className={`drawer-stage${active ? ' is-active' : ''}`}
                    onClick={() => {
                      onSelectStage(index)
                      onClose()
                    }}
                  >
                    <span className="drawer-stage-num">
                      {done ? <Check strokeWidth={2} className="drawer-check" /> : stage.number}
                    </span>
                    <span className="drawer-stage-copy">
                      <strong>{stage.title}</strong>
                      <em>{stage.method}</em>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <p className="drawer-section-label">技術ドシエ</p>
          <ul className="drawer-list">
            {DOSSIER_LINKS.map((link) => (
              <li key={link.id}>
                <button type="button" className="drawer-link" onClick={() => goTo(link.id)}>
                  <span className="drawer-link-copy">
                    <strong>{link.title}</strong>
                  </span>
                  <ChevronRight strokeWidth={1.5} className="drawer-chevron" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="drawer-foot">PatchAssist — Challenge ATOM / Kyoto</p>
      </aside>
    </div>
  )
}

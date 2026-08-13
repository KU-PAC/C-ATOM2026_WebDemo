import { useEffect, useRef } from 'react'

/**
 * ヒーローの全面背景。2 枚の静止画を重ね、カーソル位置に追従する
 * 柔らかいスポットライトの内側だけ 2 枚目を出す。
 *
 * 2 枚は同じ写真（背中に手を回す高齢者）から起こした同一構図で、
 *   BASE   … 白へ寄せて沈めた版（紙面を明るく保ち、黒い見出しを立たせる）
 *   REVEAL … 同じフレームの素の階調
 * なので、カーソルの下だけ写真が起き上がる。
 */

export const BG_IMAGE_BASE = '/hero-photo.jpg'
export const BG_IMAGE_REVEAL = '/hero-photo-full.jpg'

/**
 * マスク用キャンバスの解像度倍率。半径・座標を同じ率で縮めているので
 * CSS 上のスポットライト寸法は変わらず、毎フレームの toDataURL だけが軽くなる。
 * 中身は緩い放射グラデーションだけなので、拡大しても段差は出ない。
 */
const MASK_SCALE = 0.5

export default function ImageRevealBackground() {
  const hostRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)
  const patternRef = useRef<SVGPatternElement>(null)
  const pathRef = useRef<SVGPathElement>(null)

  const mouseRef = useRef({ x: -9999, y: -9999 })
  const smoothRef = useRef({ x: -9999, y: -9999 })
  const gridRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const host = hostRef.current
    const reveal = revealRef.current
    if (!host || !reveal) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cell = 48
    let radius = 320
    let frame = 0
    let lastSent = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }

    const measure = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      radius = Math.round(Math.min(420, Math.max(160, w * 0.16)))
      cell = Math.round(Math.min(64, Math.max(36, w * 0.028)))
      canvas.width = Math.max(1, Math.round(w * MASK_SCALE))
      canvas.height = Math.max(1, Math.round(h * MASK_SCALE))
      patternRef.current?.setAttribute('width', String(cell))
      patternRef.current?.setAttribute('height', String(cell))
      pathRef.current?.setAttribute('d', `M ${cell} 0 L 0 0 0 ${cell}`)
      // 次のフレームで必ず一度描かせる（NaN だと比較が常に false になる）
      lastSent = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }
    }

    const onMouseMove = (event: MouseEvent) => {
      mouseRef.current = { x: event.clientX, y: event.clientY }
      if (smoothRef.current.x < -9000) smoothRef.current = { ...mouseRef.current }
    }

    const tick = () => {
      // lg 未満ではこの層ごと display:none にしてある。幅 0 なら何も計算しない。
      if (host.clientWidth === 0) {
        frame = requestAnimationFrame(tick)
        return
      }
      const mouse = mouseRef.current
      const smooth = smoothRef.current

      if (mouse.x > -9000) {
        smooth.x += (mouse.x - smooth.x) * 0.1
        smooth.y += (mouse.y - smooth.y) * 0.1

        // 位置がほぼ止まったら描き直さない（見た目は同じで、静止中は無コスト）
        if (Math.abs(smooth.x - lastSent.x) > 0.15 || Math.abs(smooth.y - lastSent.y) > 0.15) {
          const cx = smooth.x * MASK_SCALE
          const cy = smooth.y * MASK_SCALE
          const r = radius * MASK_SCALE

          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
          gradient.addColorStop(0, 'rgba(255,255,255,1)')
          gradient.addColorStop(0.4, 'rgba(255,255,255,1)')
          gradient.addColorStop(0.6, 'rgba(255,255,255,0.75)')
          gradient.addColorStop(0.75, 'rgba(255,255,255,0.4)')
          gradient.addColorStop(0.88, 'rgba(255,255,255,0.12)')
          gradient.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          const url = canvas.toDataURL()
          reveal.style.maskImage = `url(${url})`
          reveal.style.webkitMaskImage = `url(${url})`
          lastSent = { x: smooth.x, y: smooth.y }
        }

        // グリッドは同じスムージング位置から、さらに緩い係数で引きずらせる
        const rect = host.getBoundingClientRect()
        const nx = rect.width ? (smooth.x - rect.left) / rect.width - 0.5 : 0
        const ny = rect.height ? (smooth.y - rect.top) / rect.height - 0.5 : 0
        const grid = gridRef.current
        grid.x += (nx * 16 - grid.x) * 0.06
        grid.y += (ny * 16 - grid.y) * 0.06
        patternRef.current?.setAttribute('x', grid.x.toFixed(2))
        patternRef.current?.setAttribute('y', grid.y.toFixed(2))
      }

      frame = requestAnimationFrame(tick)
    }

    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('mousemove', onMouseMove)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="hidden lg:block fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      <div className="reveal-layer" style={{ backgroundImage: `url(${BG_IMAGE_BASE})` }} />
      <div
        ref={revealRef}
        className="reveal-layer reveal-layer--top"
        style={{ backgroundImage: `url(${BG_IMAGE_REVEAL})` }}
      />
      <svg className="reveal-grid" width="100%" height="100%">
        <defs>
          <pattern ref={patternRef} id="reveal-grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
            <path ref={pathRef} d="M 48 0 L 0 0 0 48" fill="none" stroke="#64748b" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#reveal-grid-pattern)" />
      </svg>
    </div>
  )
}

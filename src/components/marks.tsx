import type { SVGProps } from 'react'

/**
 * 罫だけで構成した装飾マーク。塗りも影も持たせない。
 * ページ全体の規則（白地・黒インク・グレーの罫）から外れないよう、
 * 色はすべて currentColor に寄せている。
 */

type Corner = 'tl' | 'tr' | 'bl' | 'br'

const CORNER_PATH: Record<Corner, string> = {
  tl: 'M0 11.5V0.5H11.5',
  tr: 'M0.5 0.5H11.5V11.5',
  bl: 'M0 0.5V11.5H11.5',
  br: 'M0.5 11.5H11.5V0.5',
}

export function CornerBracket({
  variant,
  className,
  ...props
}: { variant: Corner } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className={className}
      style={{ width: 'var(--corner)', height: 'var(--corner)' }}
      {...props}
    >
      <path d={CORNER_PATH[variant]} />
    </svg>
  )
}

/**
 * 見出し末尾に置く市松。36 × 18 の中に 3.8 角を 4 段、
 * 偶数段だけ半セル（2.25）ずらして噛み合わせる。
 */
export function Checkerboard({ className }: { className?: string }) {
  const squares: { x: number; y: number }[] = []
  const cell = 4.5
  const size = 3.8
  const inset = (cell - size) / 2
  for (let row = 0; row < 4; row += 1) {
    const shift = row % 2 === 1 ? 2.25 : 0
    for (let col = 0; col < 8; col += 1) {
      const x = col * cell + inset + shift
      if (x + size > 36) continue
      squares.push({ x, y: row * cell + inset })
    }
  }
  return (
    <svg
      viewBox="0 0 36 18"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
      style={{ width: 'var(--checker-w)', height: 'var(--checker-h)' }}
    >
      {squares.map((s) => (
        <rect key={`${s.x}-${s.y}`} x={s.x} y={s.y} width={size} height={size} fill="currentColor" />
      ))}
    </svg>
  )
}

/** ワイヤーフレームの地球儀。経線・緯線とも罫のみで、面は持たない。 */
export function GlobeWire({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden="true"
      className={className}
      style={{ width: 'var(--globe)', height: 'var(--globe)' }}
    >
      <circle cx="32" cy="32" r="28" />
      <line x1="4" y1="32" x2="60" y2="32" />
      <ellipse cx="32" cy="32" rx="28" ry="10.5" />
      <ellipse cx="32" cy="32" rx="28" ry="20" />
      <line x1="32" y1="4" x2="32" y2="60" />
      <ellipse cx="32" cy="32" rx="10.5" ry="28" />
      <ellipse cx="32" cy="32" rx="20" ry="28" />
    </svg>
  )
}

/** 4 隅のブラケットだけで箱を示す枠。塗りつぶした面は作らない。 */
export function BracketFrame({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <CornerBracket variant="tl" className="bracket-frame-mark bracket-frame-mark--tl" />
      <CornerBracket variant="tr" className="bracket-frame-mark bracket-frame-mark--tr" />
      <CornerBracket variant="bl" className="bracket-frame-mark bracket-frame-mark--bl" />
      <CornerBracket variant="br" className="bracket-frame-mark bracket-frame-mark--br" />
    </span>
  )
}

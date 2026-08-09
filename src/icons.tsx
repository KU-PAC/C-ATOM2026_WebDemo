import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const baseProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  )
}

export function ResetIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 4v6h6" />
      <path d="M5.5 15a7 7 0 1 0 .7-7.4L4 10" />
    </svg>
  )
}

export function ExpandIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  )
}

export function OrbitIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="4.5" />
      <path d="M7.5 4.2c2.2 1.3 4.5 4 5.8 7.2 1.4 3.4 1.3 6.6.1 8.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3v10H4V8Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}


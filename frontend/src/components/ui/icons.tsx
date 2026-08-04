import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
      <circle cx="14.5" cy="7" r="2" />
      <path d="M13 12.2c1.9.3 3.5 1.6 3.5 3.8" />
    </svg>
  )
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 3.5h2.7l1 3.3-1.6 1.4a9 9 0 0 0 4.2 4.2l1.4-1.6 3.3 1v2.7c0 .8-.7 1.5-1.6 1.4-6-.6-10.5-5.1-11.1-11.1-.1-.9.6-1.6 1.4-1.6z" />
    </svg>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 17V9" />
      <path d="M8.5 17V4" />
      <path d="M14 17v-6.5" />
      <path d="M17.5 17V7" />
    </svg>
  )
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 17V3" />
      <path d="M4 3.5c2-1 4-1 6 0s4 1 6 0v7c-2 1-4 1-6 0s-4-1-6 0" />
    </svg>
  )
}

export function LogIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="2.5" width="13" height="15" rx="1.5" />
      <path d="M7 7h6" />
      <path d="M7 10.3h6" />
      <path d="M7 13.6h3.5" />
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.4 4.6l-1.4 1.4M6 14l-1.4 1.4M15.4 15.4L14 14M6 6 4.6 4.6" />
    </svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8z" />
    </svg>
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 17H4.8A1.8 1.8 0 0 1 3 15.2V4.8C3 3.8 3.8 3 4.8 3H8" />
      <path d="M13.5 13.5 17 10l-3.5-3.5" />
      <path d="M17 10H7.5" />
    </svg>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  )
}

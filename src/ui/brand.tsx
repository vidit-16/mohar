import { useId } from "react"
import { CLOCK, CLOCK_SMALL, scallopPath } from "./geometry"

// half the top arc (r=66) plus half the letter-spacing that trails the last letter
const TOP_MID = (Math.PI * 66) / 2 + 2.5

function Clock({ size, color, width = 2.6, small }: { size: number; color: string; width?: number; small?: boolean }) {
  const s = size / 64
  return (
    <g transform={`scale(${s})`} fill="none" stroke={color} strokeWidth={width / s} strokeLinecap="round">
      {(small ? CLOCK_SMALL : CLOCK).map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  )
}

export function Emblem({ size = 200, className, animate }: { size?: number; className?: string; animate?: boolean }) {
  const id = useId().replace(/:/g, "")
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`${className ?? ""} ${animate ? "stamp-in" : ""}`}
      role="img"
      aria-label="Mohar seal"
    >
      <defs>
        {/* a rubber stamp never prints a perfect edge: a faint, fixed wobble so it reads as ink, not a vector */}
        <filter id={`ink${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <path id={`top${id}`} d="M34 100 A66 66 0 0 1 166 100" />
        <path id={`bot${id}`} d="M21 100 A79 79 0 0 0 179 100" />
      </defs>
      <g filter={`url(#ink${id})`}>
        <path d={scallopPath(100, 100, 92, 26)} fill="var(--seal)" />
        <circle cx="100" cy="100" r="84" fill="none" stroke="var(--seal-lo)" strokeWidth="1.5" opacity="0.6" />
        <circle cx="100" cy="100" r="58" fill="var(--seal-lo)" opacity="0.35" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="var(--seal-ink)" strokeOpacity="0.35" strokeWidth="1.2" />
        <text fontSize="14.5" fontWeight="700" letterSpacing="5" fill="var(--seal-ink)" fontFamily="Geist, sans-serif" textAnchor="middle">
          <textPath href={`#top${id}`} startOffset={TOP_MID}>
            MOHAR
          </textPath>
        </text>
        <text fontSize="20" fontWeight="600" fill="var(--seal-ink)" fontFamily="'Mohar Deva', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif" textAnchor="middle">
          <textPath href={`#bot${id}`} startOffset="50%">
            मोहर
          </textPath>
        </text>
        <circle cx="29" cy="100" r="3" fill="var(--seal-ink)" />
        <circle cx="171" cy="100" r="3" fill="var(--seal-ink)" />
        <g transform="translate(100 100)">
          <Clock size={70} color="var(--seal-ink)" width={3.4} />
        </g>
      </g>
    </svg>
  )
}

export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-1 -1 66 66" width={size} height={size} className={className} aria-hidden>
      <path d={scallopPath(32, 32, 29, 16)} fill="var(--seal)" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="var(--seal-ink)" strokeOpacity="0.35" strokeWidth="1" />
      <g transform="translate(32 32)">
        <Clock size={38} color="var(--seal-ink)" width={3.4} small />
      </g>
    </svg>
  )
}

// Mohar's seal on a caught leak, in lac. Height is drawn as opacity (a thin pool of wax, a thick pressed disc with a
// raised lip, the clock and मोहर pressed into it) and the filter lights that like satin wax: deep red where it is
// thick, lighter where it thins out, a fine grain and a soft sheen. It appears only where a leak was caught.
export function LacSeal({ size = 160, className, label = "Mohar seal: leak caught" }: { size?: number; className?: string; label?: string }) {
  const id = useId().replace(/:/g, "")
  return (
    <svg viewBox="-150 -150 300 300" width={size} height={size} className={`lac ${className ?? ""}`} role="img" aria-label={label}>
      <defs>
        <filter id={`pool${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="14" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
        <filter id={`wax${id}`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="h0" />
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="5" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.022 0 0 0 0" result="grainA" />
          <feComposite in="h0" in2="grainA" operator="arithmetic" k2="1" k3="1" result="h" />
          <feDiffuseLighting in="h" surfaceScale="13" diffuseConstant="1.05" lightingColor="#ffffff" result="diffuse">
            <feDistantLight azimuth="230" elevation="42" />
          </feDiffuseLighting>
          <feComponentTransfer in="diffuse" result="shade">
            <feFuncR type="linear" slope="0.62" intercept="0.42" />
            <feFuncG type="linear" slope="0.62" intercept="0.42" />
            <feFuncB type="linear" slope="0.62" intercept="0.42" />
          </feComponentTransfer>
          <feSpecularLighting in="h" surfaceScale="13" specularConstant="0.5" specularExponent="16" lightingColor="#ffd8cc" result="spec">
            <feDistantLight azimuth="230" elevation="50" />
          </feSpecularLighting>
          <feComponentTransfer in="SourceAlpha" result="solid">
            <feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1 1 1" />
          </feComponentTransfer>
          <feFlood floodColor="#b8321f" result="thin" />
          <feComposite in="thin" in2="solid" operator="in" result="thinShape" />
          <feFlood floodColor="#8a1610" result="thick" />
          <feComponentTransfer in="SourceAlpha" result="thickness">
            <feFuncA type="linear" slope="1.55" intercept="-0.18" />
          </feComponentTransfer>
          <feComposite in="thick" in2="thickness" operator="in" result="thickShape" />
          <feMerge result="base">
            <feMergeNode in="thinShape" />
            <feMergeNode in="thickShape" />
          </feMerge>
          <feBlend in="base" in2="shade" mode="multiply" result="lit" />
          <feComposite in="spec" in2="solid" operator="in" result="sheen" />
          <feComposite in="lit" in2="sheen" operator="arithmetic" k2="1" k3="0.3" result="satin" />
          <feComposite in="satin" in2="solid" operator="in" />
        </filter>
        <mask id={`press${id}`}>
          <rect x="-200" y="-200" width="400" height="400" fill="#fff" />
          <g fill="none" stroke="#2a2a2a" strokeLinecap="round">
            <circle r="70" strokeWidth="3" />
            <circle r="36" cy="-4" strokeWidth="9" />
            <line x1="0" y1="-4" x2="-21" y2="-19" strokeWidth="10" />
            <line x1="0" y1="-4" x2="-5" y2="-35" strokeWidth="9" />
          </g>
          <circle cy="-4" r="5" fill="#2a2a2a" />
          <text y="62" textAnchor="middle" fontFamily="'Mohar Deva', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif" fontWeight="700" fontSize="24" fill="#2a2a2a">
            मोहर
          </text>
        </mask>
      </defs>
      <g filter={`url(#wax${id})`}>
        <g filter={`url(#pool${id})`}>
          <circle r="112" fill="#000" opacity="0.4" />
        </g>
        <circle r="88" fill="#000" opacity="0.62" mask={`url(#press${id})`} />
        <circle r="88" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="7" />
      </g>
    </svg>
  )
}

// The seal drawn as a faint outline, for backgrounds: the scalloped edge, two rings and the clock hands at 9:58.
export function SealOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g fill="none" stroke="var(--seal-line)" strokeLinecap="round">
        <path d={scallopPath(32, 32, 29, 16)} strokeWidth="0.22" />
        <circle cx="32" cy="32" r="19" strokeWidth="0.18" />
        <circle cx="32" cy="32" r="9" strokeWidth="0.5" />
        <path d="M32 32 L26.8 28.2 M32 32 L30.6 23.6" strokeWidth="0.5" />
      </g>
    </svg>
  )
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="wordmark">
      <Mark size={size} />
      <span className="wm-text" translate="no">
        Mohar <span className="wm-hi">मोहर</span>
      </span>
    </span>
  )
}

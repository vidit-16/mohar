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
        <text fontSize="14.5" fontWeight="700" letterSpacing="5" fill="var(--seal-ink)" fontFamily="Inter, sans-serif" textAnchor="middle">
          <textPath href={`#top${id}`} startOffset={TOP_MID}>
            MOHAR
          </textPath>
        </text>
        <text fontSize="20" fontWeight="600" fill="var(--seal-ink)" fontFamily="'Noto Sans Devanagari', 'Nirmala UI', sans-serif" textAnchor="middle">
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

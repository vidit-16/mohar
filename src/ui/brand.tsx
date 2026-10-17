import { useId } from "react"
import { FINGERPRINT, scallopPath } from "./geometry"

// half the top arc (r=66) plus half the letter-spacing that trails the last letter
const TOP_MID = (Math.PI * 66) / 2 + 2.5

function Print({ size, color, width = 2.6 }: { size: number; color: string; width?: number }) {
  const s = size / 64
  return (
    <g transform={`scale(${s})`} fill="none" stroke={color} strokeWidth={width / s} strokeLinecap="round">
      {FINGERPRINT.map((d) => (
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
        <radialGradient id={`wax${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="var(--seal-hi)" />
          <stop offset="1" stopColor="var(--seal)" />
        </radialGradient>
        <path id={`top${id}`} d="M34 100 A66 66 0 0 1 166 100" />
        <path id={`bot${id}`} d="M21 100 A79 79 0 0 0 179 100" />
      </defs>
      <path d={scallopPath(100, 100, 92, 26)} fill={`url(#wax${id})`} />
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
      <g transform="translate(100 102)">
        <Print size={70} color="var(--seal-ink)" width={3.2} />
      </g>
    </svg>
  )
}

export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "")
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={`m${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="var(--seal-hi)" />
          <stop offset="1" stopColor="var(--seal)" />
        </radialGradient>
      </defs>
      <path d={scallopPath(32, 32, 29, 16)} fill={`url(#m${id})`} />
      <circle cx="32" cy="32" r="20" fill="none" stroke="var(--seal-ink)" strokeOpacity="0.35" strokeWidth="1" />
      <g transform="translate(32 33)">
        <Print size={34} color="var(--seal-ink)" width={2.6} />
      </g>
    </svg>
  )
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="wordmark">
      <Mark size={size} />
      <span className="wm-text">
        Mohar <span className="wm-hi">मोहर</span>
      </span>
    </span>
  )
}

export function scallopPath(cx: number, cy: number, r: number, bumps: number) {
  const pts = Array.from({ length: bumps }, (_, i) => {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
  })
  const chord = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
  const br = (chord / 2) * 1.08
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
  for (let i = 1; i <= bumps; i++) {
    const [x, y] = pts[i % bumps]
    d += ` A${br.toFixed(2)} ${br.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return `${d} Z`
}

// Hand-drawn ridges so the print reads as a fingerprint at any size.
export const FINGERPRINT = [
  "M-22 6c0-14 10-25 22-25s22 11 22 25",
  "M-15 18c-2-4-3-8-3-12 0-10 8-18 18-18s18 8 18 18c0 6-1 11-3 16",
  "M-8 24c-2-5-4-11-4-18 0-6.6 5.4-12 12-12s12 5.4 12 12c0 9-2 17-6 23",
  "M0 28c-3-7-5-14-5-22 0-2.8 2.2-5 5-5s5 2.2 5 5c0 10-1.5 18-4 25",
  "M-27 -4c3-7 8-13 15-17",
  "M12 -21c8 3 14 9 17 17",
]

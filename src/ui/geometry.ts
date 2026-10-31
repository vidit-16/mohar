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

// The seal's centre is a clock at 9:58, two minutes before a 10 o'clock bell: Mohar is a clock nobody controls.
// Strokes in a 64-unit box centred on 0,0, so it scales from the favicon to the stage.
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180
  return `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`
}
export const CLOCK = [
  "M-22 0a22 22 0 1 0 44 0a22 22 0 1 0 -44 0",
  ...Array.from({ length: 12 }, (_, i) => `M${polar(i * 30, i % 3 === 0 ? 13.5 : 16.5)} L${polar(i * 30, 18.5)}`),
  `M0 0 L${polar((9 + 58 / 60) * 30, 10)}`,
  `M0 0 L${polar(58 * 6, 15)}`,
]

// The edge of a pool of wax: a circle that swells and dips a little, fixed so every mark is the same pour.
export function waxPath(cx: number, cy: number, r: number) {
  const n = 72
  let d = ""
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (1 + 0.035 * Math.sin(3 * a + 0.5) + 0.022 * Math.sin(5 * a + 1.7) + 0.012 * Math.sin(9 * a + 0.3))
    d += `${i ? "L" : "M"}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`
  }
  return `${d}Z`
}

// The same mark as a standalone SVG, for the favicon and the share card, which can't read the page's colour tokens.
export const markSvg = (seal = "#c4281a", lo = "#8a1610", ink = "#fff4f1") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${waxPath(32, 32, 30)}" fill="${seal}"/>` +
  `<circle cx="32" cy="32" r="21.5" fill="${lo}" opacity="0.32"/><g fill="none" stroke="${ink}" stroke-linecap="round">` +
  `<circle cx="32" cy="31" r="10.5" stroke-width="3"/><path d="M32 31 L26 26.6 M32 31 L30.6 22" stroke-width="3"/></g></svg>`

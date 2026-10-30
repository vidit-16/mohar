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
// At favicon and nav sizes twelve ticks turn to noise, so the small mark keeps only the face and the two hands.
export const CLOCK_SMALL = [CLOCK[0], ...CLOCK.slice(-2)]

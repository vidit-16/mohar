// The rim of a pool of wax: a circle that swells and dips a little, fixed so it is the same pour every time.
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

/*
 * The mark: a polygon tower, n = 6, levels 2 and 3.
 *
 * The construction comes from the tserouf project (src/lib/pancake-render/
 * mandala.ts, `starCurves`). An n-gon holds n (n−1)-gons; each of those holds
 * (n−1) (n−2)-gons; and so on down the ladder n, n−1, n−2 — the same ladder the
 * app counts on. Here the hexagon at the head is built but not drawn, so what
 * shows is the six pentagons it carries and the five squares inside each.
 *
 * The children touch. Each is turned so an EDGE faces the centre; for a parent
 * of m sides and children of p = m−1, putting a child's centre at
 *
 *   d = ρ·[cos(π/p) + sin(π/p)/tan(π/m)]
 *
 * lands the ends of two neighbours' inward edges on the same point, and their m
 * inward edges close on a regular m-gon. ρ is then set so the children's outward
 * extent reaches the parent's own inradius: they touch the parent's edges too,
 * and nothing floats.
 */
const TWO_PI = Math.PI * 2

// A regular m-gon, turned by `turn`.
function polygon(cx, cy, r, sides, turn) {
  return Array.from({ length: sides }, (_, j) => {
    const a = turn + (TWO_PI * j) / sides
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  })
}

/*
 * Every polygon of the tower, each tagged with the level it sits at. `from` is
 * the shallowest level drawn, 1-based: the levels above it are built and walked
 * through, so the sizing stays true, but they are not returned.
 */
function tower({ sides, from, to }) {
  const out = []
  const walk = (cx, cy, R, m, turn, level) => {
    if (level >= from) out.push({ points: polygon(cx, cy, R, m, turn), level })
    if (level >= to || m <= 3) return

    const p = m - 1
    const cosP = Math.cos(Math.PI / p)
    const sinP = Math.sin(Math.PI / p)
    const K = cosP + sinP / Math.tan(Math.PI / m)
    // Outward, a child shows a vertex when p is odd and an edge midpoint when it
    // is even — that is what has to land on the parent's inradius.
    const reach = p % 2 === 1 ? 1 : cosP
    const rho = (R * Math.cos(Math.PI / m)) / (K + reach)
    const ring = rho * K

    for (let k = 0; k < m; k += 1) {
      const a = turn + (TWO_PI * (k + 0.5)) / m
      walk(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring, rho, p, a + Math.PI - Math.PI / p, level + 1)
    }
  }
  // A vertex points up, so the mark stands on an edge.
  walk(0, 0, 1, sides, -Math.PI / 2, 1)
  return out
}

// Built once: the same six pentagons and thirty squares every time it is drawn.
const POLYGONS = tower({ sides: 6, from: 2, to: 3 })

// The tower fines down as it descends, so the levels read as a hierarchy.
const WIDTH = { 2: 1, 3: 0.62 }

export default function TowerMark({ size = 34 }) {
  return (
    <svg
      className="tower-mark"
      width={size}
      height={size}
      viewBox="-0.9 -0.9 1.8 1.8"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {POLYGONS.map((shape, i) => (
        <polygon
          key={i}
          points={shape.points.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}
          strokeWidth={WIDTH[shape.level]}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

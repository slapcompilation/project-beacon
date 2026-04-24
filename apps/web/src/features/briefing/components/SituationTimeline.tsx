import { format, formatDistanceToNow } from 'date-fns'
import { useIntelligenceHistory } from '@/features/briefing/hooks'
import { LEVEL_COLOR } from './constants'

export function SituationTimeline() {
  const { data: rows = [], isLoading } = useIntelligenceHistory(30)

  if (isLoading || rows.length < 2) return null

  const W = 320
  const H = 48
  const PAD = 6

  const scores  = rows.map((r) => r.situation_score)
  const maxScore = Math.max(...scores, 1)
  const pts = rows.map((r, i) => {
    const x = PAD + (i / (rows.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((r.situation_score / maxScore) * (H - PAD * 2))
    return { x, y, row: r }
  })

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const latest = rows[rows.length - 1]
  const latestDate = new Date(latest.captured_at)
  const today = new Date()
  const isToday = latestDate.toDateString() === today.toDateString()
  const freshnessLabel = isToday
    ? `Analyzed today at ${format(latestDate, 'HH:mm')}`
    : `Last analyzed ${formatDistanceToNow(latestDate, { addSuffix: true })}`

  return (
    <div className="rounded-lg border bg-muted/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          30-day situation history
        </p>
        <p className="text-[10px] text-muted-foreground">{freshnessLabel}</p>
      </div>
      <svg viewBox={`0 0 ${String(W)} ${String(H)}`} className="w-full h-10 overflow-visible">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L${pts[pts.length - 1].x.toFixed(1)},${String(H)} L${pts[0].x.toFixed(1)},${String(H)} Z`}
          fill="url(#sparkGrad)"
        />
        <path d={path} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill={LEVEL_COLOR[p.row.situation_level]}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="flex items-center gap-3 mt-1">
        {(['critical', 'elevated', 'nominal'] as const).map((lvl) => (
          <span key={lvl} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: LEVEL_COLOR[lvl] }} />
            {lvl}
          </span>
        ))}
        <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
          {rows.length} snapshot{rows.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

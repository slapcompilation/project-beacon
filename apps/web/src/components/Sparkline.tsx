// Layer: Eye / Mind — inline SVG sparkline for metric trend visualisation.

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  width?: number
}

export function Sparkline({ data, color = '#3b82f6', height = 32, width = 120 }: SparklineProps) {
  if (data.length < 2) return null
  const max   = Math.max(...data, 0.01)
  const min   = 0
  const range = max - min || 1
  const pad   = 2
  const w     = width  - pad * 2
  const h     = height - pad * 2

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * w
      const y = pad + h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

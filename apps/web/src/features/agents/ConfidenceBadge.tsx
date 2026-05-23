// Confidence-coded badge per AIP review-queue rules:
//   green   ≥ 0.85
//   yellow  0.6 – 0.85
//   red     < 0.6 (operator should not trust without scrutiny)

import { Intent, Tag } from '@blueprintjs/core'

interface Props {
  confidence: number
  /** Optional override; defaults to 'Confidence'. */
  label?: string
  className?: string
}

export function ConfidenceBadge({ confidence, label = 'Confidence', className }: Props) {
  const intent =
    confidence >= 0.85 ? Intent.SUCCESS :
    confidence >= 0.6  ? Intent.WARNING :
    Intent.DANGER

  const pct = Math.round(confidence * 100)
  return (
    <Tag minimal intent={intent} className={className}>
      {label} {String(pct)}%
    </Tag>
  )
}

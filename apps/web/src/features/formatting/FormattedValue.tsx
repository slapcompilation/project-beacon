// One property value, rendered the way the ontology says to render it.
//
// This replaces four hand-written `unknown -> string` printers that disagreed
// with each other about null — ExplorationPage's `cell`, ObjectViewPage's
// `fmt`, the Workshop widgets' `cell`, and ExportMenu's `csvField`. The base
// formatter turns the value into a readable string and the rule set binding
// colours it, and both come from the property, not from the caller.
//
//   "the formatting rules will apply in Object Explorer, Object Views, Quiver,
//    and Workshop."
//   — object-link-types/conditional-formatting.md

import { formatValue, matchingRule } from '@beacon/ontology'
import type { FormatRule, ValueFormatting } from '@beacon/ontology'

/** Either spelling: the Explorer holds database rows, the Object View holds
 *  PropertyDefs, and both know the same two things. */
export interface FormattableProperty {
  format_rules?: FormatRule[] | null
  value_formatting?: ValueFormatting | null
  formatRules?: FormatRule[] | null
  valueFormatting?: ValueFormatting | null
}

const rulesOf = (p?: FormattableProperty): FormatRule[] | null =>
  p?.format_rules ?? p?.formatRules ?? null
const formatterOf = (p?: FormattableProperty): ValueFormatting | null =>
  p?.value_formatting ?? p?.valueFormatting ?? null

/** The value as text, with the base formatter applied when there is one.
 *  `empty` is what an absent value looks like — the four printers each had
 *  their own answer, so the caller states it once. */
export function valueText(
  value: unknown,
  property: FormattableProperty | undefined,
  row: Record<string, unknown> = {},
  empty = '—',
): string {
  if (value === null || value === undefined) return empty
  const formatted = formatValue(value, formatterOf(property), { row })
  if (formatted !== null) return formatted
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value as string | number | boolean)
}

/** The tint a matching rule paints. Blueprint's intents through our tokens, or
 *  the rule's own colour — "Use Blueprint colors and intents or add your own
 *  custom color. You can also switch alignment." */
const INTENT_VAR: Record<string, string> = {
  primary: 'var(--bp-intent-primary)',
  success: 'var(--bp-intent-success)',
  warning: 'var(--bp-intent-warning)',
  danger: 'var(--bp-intent-danger)',
}

export function ruleStyle(rule: FormatRule | null): React.CSSProperties | undefined {
  if (!rule) return undefined
  const colour = rule.formatting.type === 'intent'
    ? INTENT_VAR[rule.formatting.intent ?? 'primary']
    : rule.formatting.color
  if (!colour) return undefined
  return {
    color: colour,
    borderColor: colour,
    textAlign: rule.formatting.alignment,
  }
}

/** A cell or a field. A matched rule draws the value as a tinted chip, which is
 *  how the Explorer table renders one in `conditional-formatting-cond-form-
 *  example.png`; an unmatched value is plain text. */
export function FormattedValue({ value, property, row, empty }: {
  value: unknown
  property?: FormattableProperty
  row?: Record<string, unknown>
  empty?: string
}) {
  const text = valueText(value, property, row ?? {}, empty)
  const rule = matchingRule(value, rulesOf(property), { row: row ?? {} })
  if (!rule) return <>{text}</>
  return <span className="format-chip" style={ruleStyle(rule)}>{text}</span>
}

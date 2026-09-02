// Property formatting: how a raw value becomes the thing a user reads.
//
// Two independent mechanisms on one property, and the docs name them
// separately — a "base formatter" turns the value into a readable string, a
// "rule set binding" colours it. Both are stored per property (736, 738); this
// module is the single place that applies them, because before it there were
// four hand-written `String(v)` printers that disagreed with each other about
// null.
//
//   "Value formatting refers to applying a special formatter to the value of a
//    property, transforming the raw value to a more readable version."
//   — object-link-types/value-formatting.md
//
//   "Conditional formatting enables the configuration of rules for any property
//    and dictates how that property's values will be rendered (e.g. coloring,
//    alignment, etc.) in user facing applications."
//   — object-link-types/conditional-formatting.md

// ── the value formatter, as the api publishes it ────────────────────────────

/** "Localized date/time format types." Seven; the prose table lists six. */
export type LocalizedDateFormat =
  | 'DATE_FORMAT_RELATIVE_TO_NOW'
  | 'DATE_FORMAT_DATE'
  | 'DATE_FORMAT_YEAR_AND_MONTH'
  | 'DATE_FORMAT_DATE_TIME'
  | 'DATE_FORMAT_DATE_TIME_SHORT'
  | 'DATE_FORMAT_TIME'
  | 'DATE_FORMAT_ISO_INSTANT'

export type DateFormat =
  | { stringFormat: { pattern: string } }
  | { localizedFormat: { format: LocalizedDateFormat } }

/** The api's constant-or-property operand, reused for affixes, currency codes,
 *  units and timezone ids. */
export type Operand =
  | { constant: { value: string } }
  | { propertyType: { propertyApiName: string } }

/** "Consistent with JavaScript's Intl.NumberFormat." */
export interface NumberFormatOptions {
  useGrouping?: boolean
  convertNegativeToParenthesis?: boolean
  minimumIntegerDigits?: number
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  minimumSignificantDigits?: number
  maximumSignificantDigits?: number
  notation?: 'STANDARD' | 'SCIENTIFIC' | 'ENGINEERING' | 'COMPACT'
  roundingMode?: 'CEIL' | 'FLOOR' | 'ROUND_CLOSEST'
}

export type NumberType =
  | { standard: { baseFormatOptions: NumberFormatOptions } }
  | { duration: {
      formatStyle: { humanReadable: { showFullUnits?: boolean } } | { timecode: Record<string, never> }
      precision?: 'DAYS' | 'HOURS' | 'MINUTES' | 'SECONDS' | 'AUTO'
      baseValue: 'SECONDS' | 'MILLISECONDS'
    } }
  | { fixedValues: { values: Record<string, string> } }
  | { affix: { baseFormatOptions: NumberFormatOptions; affix: { prefix?: Operand; postfix?: Operand } } }
  | { scale: { scaleType: 'THOUSANDS' | 'MILLIONS' | 'BILLIONS'; baseFormatOptions: NumberFormatOptions } }
  | { currency: { style: 'STANDARD' | 'COMPACT'; currencyCode: Operand; baseFormatOptions: NumberFormatOptions } }
  | { standardUnit: { unit: Operand; baseFormatOptions: NumberFormatOptions } }
  | { customUnit: { unit: Operand; baseFormatOptions: NumberFormatOptions } }
  | { ratio: { ratioType: 'PERCENTAGE' | 'PER_MILLE' | 'BASIS_POINTS'; baseFormatOptions: NumberFormatOptions } }

export type ValueFormatting =
  | { date: { format: DateFormat } }
  | { timestamp: { format: DateFormat; displayTimezone: { user: Record<string, never> } | { static: { zoneId: Operand } } } }
  | { number: { numberType: NumberType } }
  | { boolean: { valueIfTrue: string; valueIfFalse: string } }
  | { knownType: { knownType: 'USER_OR_GROUP_ID' | 'RESOURCE_RID' | 'ARTIFACT_GID' } }

// ── the conditional rule ────────────────────────────────────────────────────

export type RuleComparison = 'string' | 'exact_numeric' | 'numeric_range' | 'boolean' | 'is_null'
export type StringOperator = 'is_exactly' | 'contains' | 'starts_with'

export interface RuleCondition {
  /** The property the condition READS, which may not be the one it colours. */
  property: string
  comparison: RuleComparison
  operator?: StringOperator
  caseSensitive?: boolean
  /** Absent only for is_null; a range carries its own two ends. */
  value?: Operand | { min?: number; max?: number }
}

export interface RuleFormatting {
  type: 'intent' | 'custom'
  intent?: 'primary' | 'success' | 'warning' | 'danger'
  /** hex or rgb(); a Blueprint colour name is the scoped divergence in 738. */
  color?: string
  alignment?: 'left' | 'right'
}

export interface FormatRule {
  kind: 'standard' | 'always_true'
  /** "Toggle between a True or False rule." Absent is a True rule. */
  isTrue?: boolean
  formatting: RuleFormatting
  condition?: RuleCondition
}

// ── applying a formatter ────────────────────────────────────────────────────

const isOperandConstant = (o: unknown): o is { constant: { value: string } } =>
  typeof o === 'object' && o !== null && 'constant' in o

/** An operand resolved against the object being rendered: a constant, or
 *  another property's value on the same object. */
const operandValue = (o: Operand | undefined, row: Record<string, unknown>): unknown => {
  if (!o) return undefined
  if (isOperandConstant(o)) return o.constant.value
  return row[(o as { propertyType: { propertyApiName: string } }).propertyType.propertyApiName]
}

const numberOptions = (o: NumberFormatOptions): Intl.NumberFormatOptions => ({
  // "Toggle this on to go from 123456 to 123,456" — the page presents grouping
  // as a switch you turn ON, so absent is off. Intl's own default is the
  // opposite, which would have added separators nobody asked for.
  useGrouping: o.useGrouping ?? false,
  minimumIntegerDigits: o.minimumIntegerDigits,
  minimumFractionDigits: o.minimumFractionDigits,
  maximumFractionDigits: o.maximumFractionDigits,
  minimumSignificantDigits: o.minimumSignificantDigits,
  maximumSignificantDigits: o.maximumSignificantDigits,
  notation: o.notation === undefined ? undefined
    : o.notation.toLowerCase() as Intl.NumberFormatOptions['notation'],
})

const withParens = (text: string, n: number, o: NumberFormatOptions): string =>
  o.convertNegativeToParenthesis && n < 0 ? `(${text.replace('-', '')})` : text

const plain = (n: number, o: NumberFormatOptions, locale?: string): string =>
  withParens(new Intl.NumberFormat(locale, numberOptions(o)).format(n), n, o)

const SCALE: Record<string, [number, string]> = {
  THOUSANDS: [1e3, 'K'], MILLIONS: [1e6, 'M'], BILLIONS: [1e9, 'B'],
}
const RATIO: Record<string, [number, string]> = {
  PERCENTAGE: [100, '%'], PER_MILLE: [1000, '‰'], BASIS_POINTS: [10000, 'bps'],
}
const DURATION_UNITS: [number, string, string][] = [
  [86400, 'd', 'day'], [3600, 'h', 'hour'], [60, 'm', 'minute'], [1, 's', 'second'],
]

const formatDuration = (seconds: number, d: Extract<NumberType, { duration: unknown }>['duration']): string => {
  const total = Math.abs(Math.trunc(d.baseValue === 'MILLISECONDS' ? seconds / 1000 : seconds))
  if ('timecode' in d.formatStyle) {
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':')
  }
  const cut = { DAYS: 86400, HOURS: 3600, MINUTES: 60, SECONDS: 1, AUTO: 1 }[d.precision ?? 'AUTO']
  const full = d.formatStyle.humanReadable.showFullUnits
  const parts: string[] = []
  let rest = total
  for (const [size, short, long] of DURATION_UNITS) {
    if (size < cut) break
    const n = Math.floor(rest / size)
    rest -= n * size
    if (n > 0) parts.push(full ? `${n} ${long}${n === 1 ? '' : 's'}` : `${n}${short}`)
  }
  return parts.length > 0 ? parts.join(' ') : (full ? '0 seconds' : '0s')
}

const formatNumber = (n: number, t: NumberType, row: Record<string, unknown>, locale?: string): string => {
  if ('standard' in t) return plain(n, t.standard.baseFormatOptions, locale)
  if ('duration' in t) return formatDuration(n, t.duration)
  if ('fixedValues' in t) return t.fixedValues.values[String(n)] ?? String(n)
  if ('affix' in t) {
    const pre = operandValue(t.affix.affix.prefix, row)
    const post = operandValue(t.affix.affix.postfix, row)
    return `${pre ?? ''}${plain(n, t.affix.baseFormatOptions, locale)}${post ?? ''}`
  }
  if ('scale' in t) {
    const [by, suffix] = SCALE[t.scale.scaleType]
    return `${plain(n / by, t.scale.baseFormatOptions, locale)}${suffix}`
  }
  if ('ratio' in t) {
    const [by, suffix] = RATIO[t.ratio.ratioType]
    return `${plain(n * by, t.ratio.baseFormatOptions, locale)}${suffix}`
  }
  if ('currency' in t) {
    const code = operandValue(t.currency.currencyCode, row)
    const scaled = t.currency.style === 'COMPACT'
      ? plain(n, { ...t.currency.baseFormatOptions, notation: 'COMPACT' }, locale)
      : plain(n, t.currency.baseFormatOptions, locale)
    return code === undefined ? scaled : `${String(code)} ${scaled}`
  }
  const unitBearing = 'standardUnit' in t ? t.standardUnit : t.customUnit
  const unit = operandValue(unitBearing.unit, row)
  const text = plain(n, unitBearing.baseFormatOptions, locale)
  return unit === undefined ? text : `${text} ${String(unit)}`
}

const DATE_OPTIONS: Record<Exclude<LocalizedDateFormat, 'DATE_FORMAT_RELATIVE_TO_NOW' | 'DATE_FORMAT_ISO_INSTANT'>,
  Intl.DateTimeFormatOptions> = {
  DATE_FORMAT_DATE: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
  DATE_FORMAT_YEAR_AND_MONTH: { year: 'numeric', month: 'long' },
  DATE_FORMAT_DATE_TIME: { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' },
  DATE_FORMAT_DATE_TIME_SHORT: { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  DATE_FORMAT_TIME: { hour: 'numeric', minute: '2-digit' },
}

/** "applications will only format in relative terms up to 24 hours ago. After
 *  this, it will render in Date and time (short) form with the day of the
 *  week." */
const relativeToNow = (d: Date, now: Date, tz?: string, locale?: string): string => {
  const secs = Math.round((now.getTime() - d.getTime()) / 1000)
  if (Math.abs(secs) >= 86400) {
    return new Intl.DateTimeFormat(locale,
      { ...DATE_OPTIONS.DATE_FORMAT_DATE_TIME_SHORT, weekday: 'short', timeZone: tz }).format(d)
  }
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [size, unit] of [[3600, 'hour'], [60, 'minute'], [1, 'second']] as const) {
    if (Math.abs(secs) >= size || unit === 'second') {
      return rtf.format(-Math.trunc(secs / size), unit)
    }
  }
  return rtf.format(0, 'second')
}

const applyPattern = (d: Date, pattern: string, tz?: string): string => {
  // Every field is asked for AT ONCE: requesting `second: '2-digit'` alone lets
  // Intl drop the padding, which printed 13:0:0 for HH:mm:ss.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const at = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  const named = (opt: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat('en-GB', { ...opt, timeZone: tz })
      .formatToParts(d).find((p) => p.type === 'month')?.value ?? ''
  const map: Record<string, () => string> = {
    yyyy: () => at('year'),
    MMMM: () => named({ month: 'long' }),
    MMM: () => named({ month: 'short' }),
    MM: () => at('month'),
    dd: () => at('day'),
    HH: () => at('hour'),
    mm: () => at('minute'),
    ss: () => at('second'),
  }
  return pattern.replace(/yyyy|MMMM|MMM|MM|dd|HH|mm|ss/g, (t) => map[t]())
}

const formatDate = (value: unknown, f: DateFormat, tz: string | undefined, now: Date, locale?: string): string => {
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  if ('stringFormat' in f) return applyPattern(d, f.stringFormat.pattern, tz)
  const style = f.localizedFormat.format
  if (style === 'DATE_FORMAT_ISO_INSTANT') return d.toISOString()
  if (style === 'DATE_FORMAT_RELATIVE_TO_NOW') return relativeToNow(d, now, tz, locale)
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTIONS[style], timeZone: tz }).format(d)
}

export interface FormatContext {
  /** The whole object, so an operand or a condition can read another property. */
  row?: Record<string, unknown>
  /** "Adds locale-aware comma separator" — so the viewer's locale is the
   *  default, and a caller pins one only to compare against a printed example. */
  locale?: string
  /** Injected so a relative date is testable. */
  now?: Date
  /** Resolves a user or group id to a display name, when one is known. */
  displayName?: (id: string) => string | undefined
}

/** The base formatter, applied. Returns null when there is no formatter or the
 *  value is null — the caller decides what an absent value looks like, because
 *  the four printers this replaces each had their own answer. */
export function formatValue(
  value: unknown,
  formatting: ValueFormatting | null | undefined,
  ctx: FormatContext = {},
): string | null {
  if (value === null || value === undefined) return null
  if (!formatting) return null
  const row = ctx.row ?? {}
  const now = ctx.now ?? new Date()

  if ('number' in formatting) {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(n) ? null : formatNumber(n, formatting.number.numberType, row, ctx.locale)
  }
  if ('boolean' in formatting) {
    if (typeof value !== 'boolean') return null
    return value ? formatting.boolean.valueIfTrue : formatting.boolean.valueIfFalse
  }
  if ('date' in formatting) return formatDate(value, formatting.date.format, undefined, now, ctx.locale)
  if ('timestamp' in formatting) {
    const zone = formatting.timestamp.displayTimezone
    const tz = 'static' in zone
      ? (operandValue(zone.static.zoneId, row) as string | undefined)
      : undefined
    return formatDate(value, formatting.timestamp.format, tz, now, ctx.locale)
  }
  // "Display a Foundry ID as a user's first and last name or group name."
  if (formatting.knownType.knownType === 'USER_OR_GROUP_ID') {
    return ctx.displayName?.(String(value)) ?? String(value)
  }
  // A resource RID and an artifact GID render as a name and a link, which is
  // the surface's job; the trailing segment is the readable part of a RID.
  const parts = String(value).split('.')
  return parts.length > 1 ? parts[parts.length - 1] : String(value)
}

// ── choosing a rule ─────────────────────────────────────────────────────────

const compare = (left: unknown, c: RuleCondition, row: Record<string, unknown>): boolean => {
  if (c.comparison === 'is_null') return left === null || left === undefined
  if (c.comparison === 'numeric_range') {
    const range = (c.value ?? {}) as { min?: number; max?: number }
    const n = Number(left)
    if (Number.isNaN(n)) return false
    return (range.min === undefined || n >= range.min) && (range.max === undefined || n <= range.max)
  }
  const right = operandValue(c.value as Operand | undefined, row)
  if (c.comparison === 'boolean') return left === right
  if (c.comparison === 'exact_numeric') return Number(left) === Number(right)
  // string comparison, with the editor's case-sensitivity switch
  const a0 = left === null || left === undefined ? '' : String(left)
  const b0 = right === null || right === undefined ? '' : String(right)
  const [a, b] = c.caseSensitive === false ? [a0.toLowerCase(), b0.toLowerCase()] : [a0, b0]
  if (c.operator === 'contains') return a.includes(b)
  if (c.operator === 'starts_with') return a.startsWith(b)
  return a === b
}

/** "Rules (evaluated from top to bottom)" — and the page's own advice to use an
 *  Always true rule "as a fallback in case your other rules do not match" only
 *  works if the FIRST match wins. */
export function matchingRule(
  value: unknown,
  rules: FormatRule[] | null | undefined,
  ctx: FormatContext = {},
): FormatRule | null {
  const row = ctx.row ?? {}
  for (const rule of rules ?? []) {
    let holds: boolean
    if (rule.kind === 'always_true') holds = true
    else if (!rule.condition) continue
    else {
      // The condition may read a different property than the one it colours.
      const read = rule.condition.property in row ? row[rule.condition.property] : value
      holds = compare(read, rule.condition, row)
    }
    if (rule.isTrue === false) holds = !holds
    if (holds) return rule
  }
  return null
}

/** The sentence the property pane prints under the swatch — 'Type is "A320".' */
export function ruleSummary(rule: FormatRule, propertyLabel?: string): string {
  if (rule.kind === 'always_true') return 'Always true.'
  const c = rule.condition
  if (!c) return 'Incomplete rule.'
  const subject = propertyLabel ?? c.property
  const negated = rule.isTrue === false
  if (c.comparison === 'is_null') return `${subject} is ${negated ? 'not ' : ''}empty.`
  if (c.comparison === 'numeric_range') {
    const r = (c.value ?? {}) as { min?: number; max?: number }
    const bounds = [r.min !== undefined ? `≥ ${r.min}` : null, r.max !== undefined ? `≤ ${r.max}` : null]
      .filter(Boolean).join(' and ')
    return `${subject} is ${negated ? 'not ' : ''}${bounds || 'in range'}.`
  }
  const v = c.value as Operand | undefined
  const shown = v === undefined ? '…'
    : isOperandConstant(v) ? `"${v.constant.value}"`
      : v.propertyType.propertyApiName
  const verb = c.comparison === 'string' && c.operator === 'contains' ? 'contains'
    : c.comparison === 'string' && c.operator === 'starts_with' ? 'starts with'
      : 'is'
  return `${subject} ${negated ? `does not ${verb === 'is' ? 'equal' : verb}` : verb} ${shown}.`
}

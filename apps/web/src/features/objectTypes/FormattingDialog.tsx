// The property pane's two formatting cards, and the rule editor behind them.
//
// The shapes are the captures': the card is "CONDITIONAL FORMATTING — Rules
// (evaluated from top to bottom)", one row per rule with a colour swatch, a
// sentence summary, a delete ×, and a reorder gutter beside the row — ▼ alone
// on the first, ▲▼ between, ▲ alone on the last — under "+ Add a rule"
// (conditional-formatting-type-rules.png). The editor is two halves, RULE and
// FORMATTING with a live PREVIEW (conditional-formatting-rule-editor-
// string.png). The value formatter card is typed by the base type — "you will
// see a type of formatting depending on the base type of the property
// (value formatting, numeric formatting, date and time formatting, etc.).
// Toggle on the formatting." (value-formatting.md)
//
// Everything staged here rides the ordinary save: the dialog patches the
// property draft, propertyToRow sends both columns, and the database's own
// validators (736/738) are the arbiter of shape.

import { useState } from 'react'
import {
  Button, Dialog, DialogBody, DialogFooter, HTMLSelect, InputGroup, Intent,
  NumericInput, SegmentedControl, Switch, Tag,
} from '@blueprintjs/core'
import type {
  FormatRule, NumberFormatOptions, NumberType, PropertyDef, RuleCondition,
  ValueFormatting,
} from '@beacon/ontology'
import { formatValue, matchingRule, ruleSummary } from '@beacon/ontology'
import { ruleStyle } from '@/features/formatting/FormattedValue'

const CARD_TITLE: Record<string, string> = {
  numeric: 'Numeric formatting', datetime: 'Date and time formatting',
}
const NUMERIC = new Set(['integer', 'long', 'short', 'double', 'float', 'decimal', 'byte'])

const cardTitle = (base: string): string =>
  NUMERIC.has(base) ? CARD_TITLE.numeric
    : base === 'date' || base === 'timestamp' ? CARD_TITLE.datetime
      : 'Value formatting'

/** A formatter a freshly-toggled card starts from, per base type. */
const defaultFormatter = (base: string): ValueFormatting | null => {
  if (NUMERIC.has(base)) return { number: { numberType: { standard: { baseFormatOptions: {} } } } }
  if (base === 'date') return { date: { format: { localizedFormat: { format: 'DATE_FORMAT_DATE' } } } }
  if (base === 'timestamp') {
    return { timestamp: { format: { localizedFormat: { format: 'DATE_FORMAT_DATE_TIME' } }, displayTimezone: { user: {} } } }
  }
  if (base === 'boolean') return { boolean: { valueIfTrue: 'True', valueIfFalse: 'False' } }
  if (base === 'string') return { knownType: { knownType: 'USER_OR_GROUP_ID' } }
  return null
}

export function FormattingDialog({ property, properties, onChange, onClose }: {
  property: PropertyDef
  /** Every property of the type — a rule may read a different one. */
  properties: PropertyDef[]
  onChange: (patch: Partial<PropertyDef>) => void
  onClose: () => void
}) {
  const rules = property.formatRules ?? []
  const [editing, setEditing] = useState<number | null>(null)

  const setRules = (next: FormatRule[]) => { onChange({ formatRules: next }) }
  const move = (i: number, by: -1 | 1) => {
    const next = [...rules]
    const [r] = next.splice(i, 1)
    next.splice(i + by, 0, r)
    setRules(next)
  }

  return (
    <Dialog isOpen onClose={onClose} title={`Formatting — ${property.label || 'property'}`} style={{ width: 560 }}>
      <DialogBody>
        <ValueFormattingCard property={property} onChange={onChange} />

        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Conditional formatting</p>
          <p className="text-xs text-muted-foreground">Rules (evaluated from top to bottom)</p>
          {rules.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {/* The x is a SIBLING of the open-the-editor button: a button may
                  not contain a button, and nested ones fire both handlers. */}
              <div className="rule-row flex-1">
                <button type="button" className="rule-open"
                  onClick={() => { setEditing(i) }}>
                  <span className="rule-swatch" style={{
                    background: r.formatting.type === 'intent'
                      ? `var(--bp-intent-${r.formatting.intent ?? 'primary'})`
                      : r.formatting.color,
                  }} />
                  <span className="flex-1 text-left">{ruleSummary(r,
                    properties.find((p) => p.key === r.condition?.property)?.label)}</span>
                </button>
                <Button variant="minimal" size="small" icon="cross"
                  onClick={() => { setRules(rules.filter((_, x) => x !== i)); if (editing === i) setEditing(null) }} />
              </div>
              {/* The reorder gutter sits beside the row: ▼ alone on the first,
                  ▲▼ between, ▲ alone on the last. Order IS the semantics. */}
              <div className="flex flex-col">
                {i > 0 && <Button variant="minimal" size="small" icon="caret-up" onClick={() => { move(i, -1) }} />}
                {i < rules.length - 1 && <Button variant="minimal" size="small" icon="caret-down" onClick={() => { move(i, 1) }} />}
              </div>
            </div>
          ))}
          {/* "select the Add a rule button... Click on the newly created
              default rule to open the Edit conditional formatting rule editor"
              — Add creates the row; the editor only ever edits. */}
          <Button fill variant="outlined" icon="add" onClick={() => {
            onChange({ formatRules: [...rules, freshRule(property)] })
            setEditing(rules.length)
          }}>Add a rule</Button>
        </div>

        {editing !== null && rules[editing] && (
          <RuleEditorDialog
            rule={rules[editing]}
            property={property} properties={properties}
            onClose={() => { setEditing(null) }}
            onCommit={(r) => {
              setRules(rules.map((x, i) => (i === editing ? r : x)))
              setEditing(null)
            }} />
        )}
      </DialogBody>
      <DialogFooter actions={<Button onClick={onClose}>Done</Button>} />
    </Dialog>
  )
}

// ── the base formatter card, typed by the base type ─────────────────────────

function ValueFormattingCard({ property, onChange }: {
  property: PropertyDef
  onChange: (patch: Partial<PropertyDef>) => void
}) {
  const base = property.type
  const vf = property.valueFormatting ?? null
  const starter = defaultFormatter(base)
  const [preview, setPreview] = useState(NUMERIC.has(base) ? '123456' : '')
  if (!starter) {
    return (
      <p className="text-xs text-muted-foreground">
        No value formatter applies to a {base} property.
      </p>
    )
  }
  const set = (next: ValueFormatting | null) => { onChange({ valueFormatting: next }) }

  const previewValue = NUMERIC.has(base) ? Number(preview)
    : base === 'boolean' ? preview !== 'false'
      : preview
  const previewText = preview === '' ? null : formatValue(previewValue, vf)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{cardTitle(base)}</p>
        <Switch checked={vf !== null} className="!mb-0"
          onChange={(e) => { set(e.currentTarget.checked ? starter : null) }} />
      </div>
      {vf !== null && (
        <>
          {'number' in vf && <NumberOptions vf={vf} set={set} />}
          {('date' in vf || 'timestamp' in vf) && <DateOptions vf={vf} set={set} />}
          {'boolean' in vf && (
            <div className="flex items-center gap-2">
              <InputGroup size="small" value={vf.boolean.valueIfTrue} placeholder="If true"
                onChange={(e) => { set({ boolean: { ...vf.boolean, valueIfTrue: e.currentTarget.value } }) }} />
              <InputGroup size="small" value={vf.boolean.valueIfFalse} placeholder="If false"
                onChange={(e) => { set({ boolean: { ...vf.boolean, valueIfFalse: e.currentTarget.value } }) }} />
            </div>
          )}
          {'knownType' in vf && (
            <HTMLSelect value={vf.knownType.knownType}
              onChange={(e) => { set({ knownType: { knownType: e.currentTarget.value as 'USER_OR_GROUP_ID' } }) }}>
              {/* "by selecting the Multipass username option" */}
              <option value="USER_OR_GROUP_ID">Multipass username</option>
              <option value="RESOURCE_RID">Resource RID</option>
              <option value="ARTIFACT_GID">Artifact GID</option>
            </HTMLSelect>
          )}
          {(NUMERIC.has(base) || base === 'boolean') && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Preview result</span>
              <InputGroup size="small" value={preview}
                onChange={(e) => { setPreview(e.currentTarget.value) }} style={{ width: 110 }} />
              {previewText !== null && <Tag minimal>{previewText}</Tag>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const NUMBER_KINDS: [string, string][] = [
  ['standard', 'Standard'], ['currency', 'Currency'], ['standardUnit', 'Standard unit'],
  ['customUnit', 'Custom unit'], ['ratio', 'Percentage / ratio'], ['affix', 'Prefix/Suffix'],
  ['scale', 'Scale'], ['duration', 'Duration'], ['fixedValues', 'Fixed values'],
]

const memberOf = (nt: NumberType): string => Object.keys(nt)[0]
const optionsOf = (nt: NumberType): NumberFormatOptions =>
  (nt as Record<string, { baseFormatOptions?: NumberFormatOptions }>)[memberOf(nt)].baseFormatOptions ?? {}

/** A fresh member when the kind dropdown changes, carrying the options over. */
const memberFor = (kind: string, o: NumberFormatOptions): NumberType => {
  switch (kind) {
    case 'currency': return { currency: { style: 'STANDARD', currencyCode: { constant: { value: 'USD' } }, baseFormatOptions: o } }
    case 'standardUnit': return { standardUnit: { unit: { constant: { value: '' } }, baseFormatOptions: o } }
    case 'customUnit': return { customUnit: { unit: { constant: { value: '' } }, baseFormatOptions: o } }
    case 'ratio': return { ratio: { ratioType: 'PERCENTAGE', baseFormatOptions: o } }
    case 'affix': return { affix: { baseFormatOptions: o, affix: {} } }
    case 'scale': return { scale: { scaleType: 'THOUSANDS', baseFormatOptions: o } }
    case 'duration': return { duration: { formatStyle: { humanReadable: {} }, baseValue: 'SECONDS' } }
    case 'fixedValues': return { fixedValues: { values: {} } }
    default: return { standard: { baseFormatOptions: o } }
  }
}

function NumberOptions({ vf, set }: {
  vf: Extract<ValueFormatting, { number: unknown }>
  set: (next: ValueFormatting) => void
}) {
  const nt = vf.number.numberType
  const kind = memberOf(nt)
  const o = optionsOf(nt)
  const setNt = (next: NumberType) => { set({ number: { numberType: next } }) }
  const patchOptions = (patch: Partial<NumberFormatOptions>) => {
    const body = (nt as Record<string, object>)[kind]
    setNt({ [kind]: { ...body, baseFormatOptions: { ...o, ...patch } } } as unknown as NumberType)
  }
  const patchBody = (patch: object) => {
    const body = (nt as Record<string, object>)[kind]
    setNt({ [kind]: { ...body, ...patch } } as unknown as NumberType)
  }
  const constantOf = (op?: { constant?: { value: string } }): string => op?.constant?.value ?? ''
  // The engine admits a property REFERENCE anywhere an operand goes; the card
  // only authors constants, so a reference is shown as one rather than
  // misread as an empty constant a keystroke would silently replace.
  const refOf = (op?: unknown): string | null =>
    typeof op === 'object' && op !== null && 'propertyType' in op
      ? (op as { propertyType: { propertyApiName: string } }).propertyType.propertyApiName
      : null

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-28">Base type</span>
        <HTMLSelect value={kind} onChange={(e) => { setNt(memberFor(e.currentTarget.value, o)) }}>
          {NUMBER_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </HTMLSelect>
      </div>

      {'currency' in nt && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Currency</span>
          {refOf(nt.currency.currencyCode) !== null
            ? <Tag minimal icon="link">{refOf(nt.currency.currencyCode)}</Tag>
            : <InputGroup size="small" value={constantOf(nt.currency.currencyCode as { constant?: { value: string } })}
                placeholder="USD" style={{ width: 70 }}
                onChange={(e) => { patchBody({ currencyCode: { constant: { value: e.currentTarget.value } } }) }} />}
          <HTMLSelect value={nt.currency.style}
            onChange={(e) => { patchBody({ style: e.currentTarget.value }) }}>
            <option value="STANDARD">Standard</option>
            <option value="COMPACT">Compact</option>
          </HTMLSelect>
        </div>
      )}
      {('standardUnit' in nt || 'customUnit' in nt) && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Unit</span>
          {refOf('standardUnit' in nt ? nt.standardUnit.unit : nt.customUnit.unit) !== null
            ? <Tag minimal icon="link">{refOf('standardUnit' in nt ? nt.standardUnit.unit : nt.customUnit.unit)}</Tag>
            : <InputGroup size="small" placeholder={'standardUnit' in nt ? 'celsius' : 'widgets'}
                value={constantOf(('standardUnit' in nt ? nt.standardUnit.unit : nt.customUnit.unit) as { constant?: { value: string } })}
                onChange={(e) => { patchBody({ unit: { constant: { value: e.currentTarget.value } } }) }} />}
        </div>
      )}
      {'ratio' in nt && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Ratio</span>
          <HTMLSelect value={nt.ratio.ratioType} onChange={(e) => { patchBody({ ratioType: e.currentTarget.value }) }}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="PER_MILLE">Per mille</option>
            <option value="BASIS_POINTS">Basis points</option>
          </HTMLSelect>
        </div>
      )}
      {'scale' in nt && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Scale</span>
          <HTMLSelect value={nt.scale.scaleType} onChange={(e) => { patchBody({ scaleType: e.currentTarget.value }) }}>
            <option value="THOUSANDS">Thousands (K)</option>
            <option value="MILLIONS">Millions (M)</option>
            <option value="BILLIONS">Billions (B)</option>
          </HTMLSelect>
        </div>
      )}
      {'affix' in nt && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Prefix / suffix</span>
          <InputGroup size="small" placeholder="Prefix" value={constantOf(nt.affix.affix.prefix as { constant?: { value: string } })}
            onChange={(e) => { patchBody({ affix: { ...nt.affix.affix, prefix: e.currentTarget.value ? { constant: { value: e.currentTarget.value } } : undefined } }) }} />
          <InputGroup size="small" placeholder="Suffix" value={constantOf(nt.affix.affix.postfix as { constant?: { value: string } })}
            onChange={(e) => { patchBody({ affix: { ...nt.affix.affix, postfix: e.currentTarget.value ? { constant: { value: e.currentTarget.value } } : undefined } }) }} />
        </div>
      )}
      {'duration' in nt && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Duration</span>
          <HTMLSelect value={'timecode' in nt.duration.formatStyle ? 'timecode' : 'humanReadable'}
            onChange={(e) => {
              patchBody({ formatStyle: e.currentTarget.value === 'timecode' ? { timecode: {} } : { humanReadable: {} } })
            }}>
            <option value="humanReadable">Human readable</option>
            <option value="timecode">Timecode</option>
          </HTMLSelect>
          <HTMLSelect value={nt.duration.baseValue} onChange={(e) => { patchBody({ baseValue: e.currentTarget.value }) }}>
            <option value="SECONDS">of seconds</option>
            <option value="MILLISECONDS">of milliseconds</option>
          </HTMLSelect>
        </div>
      )}
      {'fixedValues' in nt && (
        <FixedValuesEditor values={nt.fixedValues.values}
          onChange={(values) => { patchBody({ values }) }} />
      )}

      {/* baseFormatOptions, shared by every member that carries one. */}
      {kind !== 'fixedValues' && kind !== 'duration' && (
        <>
          <div className="flex items-center gap-4">
            <Switch checked={o.useGrouping ?? false} label="Use grouping" className="!mb-0"
              onChange={(e) => { patchOptions({ useGrouping: e.currentTarget.checked }) }} />
            <Switch checked={o.convertNegativeToParenthesis ?? false} label="Negative to parenthesis" className="!mb-0"
              onChange={(e) => { patchOptions({ convertNegativeToParenthesis: e.currentTarget.checked }) }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-28">Notation</span>
            <HTMLSelect value={o.notation ?? 'STANDARD'}
              onChange={(e) => { patchOptions({ notation: e.currentTarget.value as NumberFormatOptions['notation'] }) }}>
              <option value="STANDARD">Standard</option>
              <option value="COMPACT">Compact</option>
              <option value="SCIENTIFIC">Scientific</option>
              <option value="ENGINEERING">Engineering</option>
            </HTMLSelect>
            <span className="text-muted-foreground">Max fraction digits</span>
            <NumericInput min={0} max={20} value={o.maximumFractionDigits ?? ''} style={{ width: 56 }}
              onValueChange={(v) => { patchOptions({ maximumFractionDigits: Number.isFinite(v) ? v : undefined }) }} />
          </div>
        </>
      )}
    </div>
  )
}

function FixedValuesEditor({ values, onChange }: {
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  return (
    <div className="space-y-1">
      {Object.entries(values).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <Tag minimal>{k}</Tag><span>→ {v}</span>
          <Button variant="minimal" size="small" icon="cross" onClick={() => {
            onChange(Object.fromEntries(Object.entries(values).filter(([x]) => x !== k)))
          }} />
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <InputGroup size="small" placeholder="1" value={key} style={{ width: 56 }}
          onChange={(e) => { setKey(e.currentTarget.value) }} />
        <InputGroup size="small" placeholder="First" value={label}
          onChange={(e) => { setLabel(e.currentTarget.value) }} />
        <Button size="small" icon="add" disabled={!/^-?[0-9]+$/.test(key) || !label}
          onClick={() => { onChange({ ...values, [key]: label }); setKey(''); setLabel('') }} />
      </div>
    </div>
  )
}

const DATE_STYLES: [string, string][] = [
  ['DATE_FORMAT_DATE', 'Date'],
  ['DATE_FORMAT_DATE_TIME', 'Date and time (long)'],
  ['DATE_FORMAT_DATE_TIME_SHORT', 'Date and time (short)'],
  ['DATE_FORMAT_YEAR_AND_MONTH', 'Year and month'],
  ['DATE_FORMAT_ISO_INSTANT', 'ISO instant'],
  ['DATE_FORMAT_RELATIVE_TO_NOW', 'Relative to now'],
  ['DATE_FORMAT_TIME', 'Time'],
]

function DateOptions({ vf, set }: {
  vf: Extract<ValueFormatting, { date: unknown } | { timestamp: unknown }>
  set: (next: ValueFormatting) => void
}) {
  const isTs = 'timestamp' in vf
  const format = isTs ? vf.timestamp.format : vf.date.format
  const style = 'localizedFormat' in format ? format.localizedFormat.format : 'custom'
  const zone = isTs ? vf.timestamp.displayTimezone : null

  const withFormat = (f: typeof format): ValueFormatting =>
    isTs ? { timestamp: { ...vf.timestamp, format: f } } : { date: { format: f } }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-28">Format</span>
        <HTMLSelect value={style} onChange={(e) => {
          const v = e.currentTarget.value
          set(withFormat(v === 'custom'
            ? { stringFormat: { pattern: 'yyyy-MM-dd' } }
            : { localizedFormat: { format: v as 'DATE_FORMAT_DATE' } }))
        }}>
          {DATE_STYLES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          <option value="custom">Custom pattern…</option>
        </HTMLSelect>
        {'stringFormat' in format && (
          <InputGroup size="small" value={format.stringFormat.pattern} className="font-mono"
            onChange={(e) => { set(withFormat({ stringFormat: { pattern: e.currentTarget.value } })) }} />
        )}
      </div>
      {isTs && zone && (
        <div className="flex items-center gap-2">
          {/* "either as a static timezone that you input, or as the application
              user's current timezone" */}
          <span className="text-muted-foreground w-28">Timezone</span>
          <HTMLSelect value={'user' in zone ? 'user' : 'static'} onChange={(e) => {
            set({ timestamp: { ...vf.timestamp,
              displayTimezone: e.currentTarget.value === 'user'
                ? { user: {} }
                : { static: { zoneId: { constant: { value: 'UTC' } } } } } })
          }}>
            <option value="user">User&apos;s timezone</option>
            <option value="static">Static</option>
          </HTMLSelect>
          {'static' in zone && (
            <InputGroup size="small" placeholder="Europe/Athens"
              value={'constant' in zone.static.zoneId ? zone.static.zoneId.constant.value : ''}
              onChange={(e) => {
                set({ timestamp: { ...vf.timestamp,
                  displayTimezone: { static: { zoneId: { constant: { value: e.currentTarget.value } } } } } })
              }} />
          )}
        </div>
      )}
    </div>
  )
}

// ── the rule editor ─────────────────────────────────────────────────────────

/** Which comparisons the picked property offers — "Types of comparisons
 *  available are based on the type of the property." The page's list is
 *  by-example; is_null on every type is the one inference. */
const comparisonsFor = (base: string | undefined): [string, string][] => {
  if (base !== undefined && NUMERIC.has(base)) {
    return [['exact_numeric', 'Exact numeric match'], ['numeric_range', 'Numeric range'], ['is_null', 'Is null']]
  }
  if (base === 'boolean') return [['boolean', 'Exact boolean match'], ['is_null', 'Is null']]
  return [['string', 'String comparison'], ['is_null', 'Is null']]
}

/** The condition a comparison starts from — used by the fresh rule, the
 *  property switch and the comparison switch, so all three seed the same
 *  well-typed shape. */
const seedCondition = (propertyKey: string, base: string | undefined): RuleCondition => {
  const [first] = comparisonsFor(base)
  const comparison = first[0] as RuleCondition['comparison']
  return {
    property: propertyKey, comparison,
    operator: comparison === 'string' ? 'is_exactly' : undefined,
    value: comparison === 'boolean' ? { constant: { value: true } }
      : comparison === 'string' || comparison === 'exact_numeric' ? { constant: { value: '' } }
        : comparison === 'numeric_range' ? {}
          : undefined,
  }
}

const freshRule = (property: PropertyDef): FormatRule => ({
  kind: 'standard',
  formatting: { type: 'intent', intent: 'primary' },
  condition: seedCondition(property.key, property.type),
})

/** min/max as text, parsed on the way out: a controlled NumericInput that
 *  echoes '' back cannot type a minus sign or a decimal point — the keystroke
 *  parses as NaN or a truncation and the display snaps back. */
function RangeInputs({ range, onChange }: {
  range: { min?: number; max?: number }
  onChange: (next: { min?: number; max?: number }) => void
}) {
  const [minText, setMinText] = useState(range.min !== undefined ? String(range.min) : '')
  const [maxText, setMaxText] = useState(range.max !== undefined ? String(range.max) : '')
  const commit = (minT: string, maxT: string) => {
    const parse = (t: string): number | undefined => {
      const n = Number(t)
      return t.trim() !== '' && Number.isFinite(n) ? n : undefined
    }
    onChange({ min: parse(minT), max: parse(maxT) })
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">between</span>
      <InputGroup size="small" value={minText} placeholder="min" style={{ width: 80 }}
        onChange={(e) => { setMinText(e.currentTarget.value); commit(e.currentTarget.value, maxText) }} />
      <span className="text-muted-foreground">and</span>
      <InputGroup size="small" value={maxText} placeholder="max" style={{ width: 80 }}
        onChange={(e) => { setMaxText(e.currentTarget.value); commit(minText, e.currentTarget.value) }} />
    </div>
  )
}

function RuleEditorDialog({ rule, property, properties, onClose, onCommit }: {
  rule: FormatRule
  property: PropertyDef
  properties: PropertyDef[]
  onClose: () => void
  onCommit: (r: FormatRule) => void
}) {
  const [draft, setDraft] = useState<FormatRule>(rule)
  const [context, setContext] = useState<'table' | 'card'>('table')
  const cond = draft.condition
  const read = properties.find((p) => p.key === cond?.property)
  const patchCondition = (patch: Partial<RuleCondition>) => {
    setDraft({ ...draft, condition: { ...(cond ?? { property: property.key, comparison: 'string' }), ...patch } })
  }
  const constantValue = cond?.value !== undefined && 'constant' in cond.value
    ? cond.value.constant.value : undefined
  const referenceKey = cond?.value !== undefined && 'propertyType' in cond.value
    ? cond.value.propertyType.propertyApiName : undefined
  const range = (cond?.comparison === 'numeric_range' ? cond.value ?? {} : {}) as { min?: number; max?: number }

  // The preview cell: the rule applied to a sample TYPED like the read
  // property — a string sample against a boolean rule would colour the
  // preview while the real table never matches.
  const sample: string | number | boolean | null =
    cond?.comparison === 'is_null' ? null
      : cond?.comparison === 'numeric_range' ? range.min ?? range.max ?? 0
        : constantValue !== undefined && constantValue !== '' ? constantValue : 'Example'
  const sampleText = sample === null ? '—' : String(sample)
  const previewRule = matchingRule(sample, [draft], { row: { [cond?.property ?? '']: sample } })
  const colourOk = draft.formatting.type !== 'custom'
    || /^#[0-9a-fA-F]{6}$/.test(draft.formatting.color ?? '')
    || /^#[0-9a-fA-F]{3}$/.test(draft.formatting.color ?? '')
    || /^rgba?\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*(,\s*(0|1|0?\.[0-9]+)\s*)?\)$/.test(draft.formatting.color ?? '')

  return (
    <Dialog isOpen onClose={onClose} icon="edit" title="Edit conditional formatting rule" style={{ width: 700 }}>
      <DialogBody>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rule</p>
            {/* "Switch between a Standard rule, an Always true rule, or a Math
                rule." Math is shown and refused — its expression grammar is one
                sentence on one page, the divergence 738 scopes. */}
            <SegmentedControl value={draft.kind} size="small"
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'always_true', label: 'Always true' },
                { value: 'math', label: 'Math', disabled: true },
              ]}
              onValueChange={(v) => {
                // Only the kind and its condition move; the formatting the user
                // chose and the True/False polarity survive the switch.
                setDraft(v === 'always_true'
                  ? { ...draft, kind: 'always_true', condition: undefined }
                  : { ...draft, kind: 'standard',
                      condition: draft.condition ?? seedCondition(property.key, property.type) })
              }} />
            {draft.kind === 'standard' && cond && (
              <>
                <p className="text-xs text-muted-foreground">Apply formatting if…</p>
                <HTMLSelect fill value={cond.property} onChange={(e) => {
                  const key = e.currentTarget.value
                  const target = properties.find((p) => p.key === key)
                  setDraft({ ...draft, condition: seedCondition(key, target?.type) })
                }}>
                  {properties.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}{p.key === property.key ? ' (this property)' : ''}
                    </option>
                  ))}
                </HTMLSelect>
                <HTMLSelect fill value={cond.comparison} onChange={(e) => {
                  const c = e.currentTarget.value as RuleCondition['comparison']
                  setDraft({ ...draft, condition: { ...seedCondition(cond.property, read?.type), comparison: c,
                    operator: c === 'string' ? cond.operator ?? 'is_exactly' : undefined,
                    value: c === 'is_null' ? undefined
                      : c === 'numeric_range' ? {}
                        : c === 'boolean' ? { constant: { value: true } }
                          : { constant: { value: '' } } } })
                }}>
                  {comparisonsFor(read?.type).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </HTMLSelect>
                {cond.comparison === 'string' && (
                  <HTMLSelect fill value={cond.operator ?? 'is_exactly'}
                    onChange={(e) => { patchCondition({ operator: e.currentTarget.value as RuleCondition['operator'] }) }}>
                    <option value="is_exactly">is exactly</option>
                    <option value="contains">contains</option>
                    <option value="starts_with">starts with</option>
                  </HTMLSelect>
                )}
                {cond.comparison === 'numeric_range' && (
                  <RangeInputs range={range}
                    onChange={(next) => { patchCondition({ value: next }) }} />
                )}
                {(cond.comparison === 'string' || cond.comparison === 'exact_numeric') && (
                  <>
                    {referenceKey === undefined ? (
                      <InputGroup size="small" value={String(constantValue ?? '')} placeholder="A320"
                        onChange={(e) => { patchCondition({ value: { constant: { value: e.currentTarget.value } } }) }} />
                    ) : (
                      <HTMLSelect fill value={referenceKey} onChange={(e) => {
                        patchCondition({ value: { propertyType: { propertyApiName: e.currentTarget.value } } })
                      }}>
                        {properties.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </HTMLSelect>
                    )}
                    {/* "Compare against a constant or a property reference." */}
                    <div className="flex gap-3 text-xs">
                      <button type="button" className="link-quiet" onClick={() => {
                        patchCondition({ value: { constant: { value: '' } } })
                      }}>Add constant</button>
                      <button type="button" className="link-quiet" onClick={() => {
                        patchCondition({ value: { propertyType: { propertyApiName: property.key } } })
                      }}>Add reference</button>
                    </div>
                  </>
                )}
                {cond.comparison === 'boolean' && (
                  // A boolean column holds booleans, so the rule stores one —
                  // a string 'true' can never match a typed column.
                  <HTMLSelect fill value={constantValue === false ? 'false' : 'true'} onChange={(e) => {
                    patchCondition({ value: { constant: { value: e.currentTarget.value === 'true' } } })
                  }}>
                    <option value="true">Is true</option>
                    <option value="false">Is false</option>
                  </HTMLSelect>
                )}
                {cond.comparison === 'string' && (
                  <Switch checked={cond.case_sensitive ?? true} label="Case sensitive" className="!mb-0"
                    onChange={(e) => { patchCondition({ case_sensitive: e.currentTarget.checked }) }} />
                )}
                {/* "Toggle between a True or False rule." */}
                <p className="text-xs">
                  is <button type="button" className="link-quiet"
                    onClick={() => { setDraft({ ...draft, is_true: draft.is_true === false ? undefined : false }) }}>
                    {draft.is_true === false ? 'False' : 'True'}
                  </button>
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Formatting</p>
            <HTMLSelect fill value={draft.formatting.type} onChange={(e) => {
              const t = e.currentTarget.value as 'intent' | 'custom'
              setDraft({ ...draft, formatting: t === 'intent'
                ? { type: 'intent', intent: draft.formatting.intent ?? 'primary', alignment: draft.formatting.alignment }
                : { type: 'custom', color: draft.formatting.color ?? '#137cbd', alignment: draft.formatting.alignment } })
            }}>
              <option value="intent">Intent</option>
              <option value="custom">Custom color</option>
            </HTMLSelect>
            {draft.formatting.type === 'intent' ? (
              <HTMLSelect fill value={draft.formatting.intent ?? 'primary'} onChange={(e) => {
                setDraft({ ...draft, formatting: { ...draft.formatting, intent: e.currentTarget.value as 'primary' } })
              }}>
                <option value="primary">Primary</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
              </HTMLSelect>
            ) : (
              <div className="flex items-center gap-2">
                <span className="rule-swatch" style={{ background: draft.formatting.color }} />
                <InputGroup size="small" value={draft.formatting.color ?? ''} className="font-mono"
                  placeholder="#137cbd or rgb(19,124,189)"
                  onChange={(e) => { setDraft({ ...draft, formatting: { ...draft.formatting, color: e.currentTarget.value } }) }} />
              </div>
            )}
            <HTMLSelect fill value={draft.formatting.alignment ?? ''} onChange={(e) => {
              const a = e.currentTarget.value
              setDraft({ ...draft, formatting: { ...draft.formatting,
                alignment: a === '' ? undefined : a as 'left' | 'right' } })
            }}>
              <option value="">Default alignment</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </HTMLSelect>

            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground pt-2">Preview</p>
            {/* "Preview an Objects table or a Property card." */}
            <p className="text-xs text-muted-foreground">in display context…</p>
            <HTMLSelect value={context} onChange={(e) => { setContext(e.currentTarget.value as 'table' | 'card') }}>
              <option value="table">Table</option>
              <option value="card">Property card</option>
            </HTMLSelect>
            <div className={context === 'table' ? 'rule-preview rule-preview-table' : 'rule-preview'}>
              {context === 'table' && (
                <p className="rule-preview-head">#&ensp;{(read?.label ?? property.label).toUpperCase()}</p>
              )}
              {context === 'card' && (
                <p className="rule-preview-head">{read?.label ?? property.label}</p>
              )}
              {previewRule
                ? <span className="format-chip" style={ruleStyle(previewRule)}>{sampleText}</span>
                : <span className="text-muted-foreground">{sampleText}</span>}
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!colourOk}
            title={colourOk ? undefined : 'A custom colour is hex (#137cbd) or rgb(19,124,189)'}
            onClick={() => { onCommit(draft) }}>
            Update rule
          </Button>
        </>
      } />
    </Dialog>
  )
}

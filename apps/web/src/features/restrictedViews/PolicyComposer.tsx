// The rule-based policy editor from restricted-views-1.png / -4.png: a
// "Match any|all of these rules" header over rows of
// <left term> <comparison> <right term>. Left is a user attribute or a
// column; right is a column or a specific value ("A string, Boolean, number,
// or array"). The database validates the grammar, the arity and the weights —
// this component only builds the JSON.

import { Button, HTMLSelect, Icon, InputGroup, Tag } from '@blueprintjs/core'
import {
  COMPARISONS, USER_ATTRIBUTES,
  type DatasetField, type Policy, type PolicyComparison, type PolicyTerm,
} from './api'

function termKey(t: PolicyTerm): string {
  if ('user_attribute' in t) return `a:${t.user_attribute}`
  if ('column' in t) return `c:${t.column}`
  return 'v'
}

function parseValue(raw: string, list: boolean): unknown {
  const scalar = (s: string): unknown => {
    const trimmed = s.trim()
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed)
    return trimmed
  }
  return list ? raw.split(',').map(scalar) : scalar(raw)
}

function valueText(v: unknown): { text: string; list: boolean } {
  if (Array.isArray(v)) return { text: v.map(String).join(', '), list: true }
  if (typeof v === 'string') return { text: v, list: false }
  if (typeof v === 'number' || typeof v === 'boolean') return { text: String(v), list: false }
  return { text: '', list: false }
}

export function PolicyComposer({ policy, columns, onChange }: {
  policy: Policy
  columns: DatasetField[]
  onChange: (next: Policy) => void
}) {
  const setRule = (i: number, rule: PolicyComparison) => {
    onChange({ ...policy, rules: policy.rules.map((r, j) => j === i ? rule : r) })
  }

  const setLeft = (i: number, key: string) => {
    const rule = policy.rules[i]
    const left: PolicyTerm = key.startsWith('a:')
      ? { user_attribute: key.slice(2) }
      : { column: key.slice(2) }
    setRule(i, { ...rule, left })
  }

  const setRight = (i: number, key: string) => {
    const rule = policy.rules[i]
    const right: PolicyTerm = key === 'v' ? { value: '' } : { column: key.slice(2) }
    setRule(i, { ...rule, right })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span>Match</span>
        <HTMLSelect minimal value={policy.match}
          onChange={(e) => { onChange({ ...policy, match: e.currentTarget.value as 'all' | 'any' }) }}>
          <option value="all">all</option>
          <option value="any">any</option>
        </HTMLSelect>
        <span>of these {policy.rules.length} rules</span>
      </div>

      {policy.rules.map((rule, i) => {
        const rightIsValue = 'value' in rule.right
        const { text, list } = rightIsValue ? valueText((rule.right as { value: unknown }).value) : { text: '', list: false }
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 border border-border rounded px-2 py-2">
            <Tag minimal className="!text-[9px] uppercase">{policy.match === 'any' ? 'or' : 'and'}</Tag>
            <HTMLSelect value={termKey(rule.left)} onChange={(e) => { setLeft(i, e.currentTarget.value) }}>
              <optgroup label="The user's…">
                {USER_ATTRIBUTES.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.label}</option>)}
              </optgroup>
              <optgroup label="Columns">
                {columns.map((c) => <option key={c.name} value={`c:${c.name}`}>{c.name}</option>)}
              </optgroup>
            </HTMLSelect>
            <HTMLSelect value={rule.comparison}
              onChange={(e) => { setRule(i, { ...rule, comparison: e.currentTarget.value }) }}>
              {COMPARISONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </HTMLSelect>
            <HTMLSelect value={termKey(rule.right)} onChange={(e) => { setRight(i, e.currentTarget.value) }}>
              <option value="v">Specific value…</option>
              <optgroup label="Columns">
                {columns.map((c) => <option key={c.name} value={`c:${c.name}`}>{c.name}</option>)}
              </optgroup>
            </HTMLSelect>
            {rightIsValue && (
              <>
                <InputGroup size="small" className="flex-1 min-w-32" value={text}
                  placeholder={list ? 'a, b, c' : 'value'}
                  onChange={(e) => { setRule(i, { ...rule, right: { value: parseValue(e.currentTarget.value, list) } }) }} />
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={list}
                    onChange={(e) => { setRule(i, { ...rule, right: { value: parseValue(text, e.currentTarget.checked) } }) }} />
                  list
                </label>
              </>
            )}
            <Button variant="minimal" size="small" icon="cross" className="ml-auto"
              onClick={() => { onChange({ ...policy, rules: policy.rules.filter((_, j) => j !== i) }) }} />
          </div>
        )
      })}

      <Button size="small" icon="add" variant="outlined"
        onClick={() => {
          onChange({ ...policy, rules: [...policy.rules, {
            left: { user_attribute: 'user_id' }, comparison: 'equal',
            right: columns.length > 0 ? { column: columns[0].name } : { value: '' },
          }] })
        }}>
        Add rule
      </Button>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Icon icon="info-sign" size={11} />
        At least one rule must compare a user attribute. NOT conditions are not supported.
      </p>
    </div>
  )
}

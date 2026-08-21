// The submission criteria editor, drawn as submission_criteria_overview.png
// draws it: a card titled Execution, a root row reading "Match All conditions
// below:" whose operator word IS the control, a vertical rule per nesting level,
// and "+ Add a condition or a logical operator" at every level.
//
// A condition reads as a sentence rather than a row of form fields — tile,
// parameter, the property, the operator in italic, the value — which is how the
// overview and all three picker screenshots render one.
//
// See readings/submission-criteria-surface.md. The evaluator is 421 + 602; this
// is the half that was missing.
import { Button, HTMLSelect, Icon, InputGroup, Tag } from '@blueprintjs/core'
import {
  useAddCriterion, useCanEditActionType, useCriteria, useDeleteCriterion,
  useSubmissionOperators, useUpdateCriterion, childrenOf,
  type CriterionRow, type LogicalOperator, type Template, type UserField, type ValueSource,
} from '@/features/actionTypes/criteria'

interface Param { id: string; api_name: string; display_name: string; base_type: string }

/** "operators are pre-filtered to only show a selection of operators valid for
 *  the parameter". A group list and a multi-valued parameter take the page's
 *  multi-value operators; everything else takes the single-value five. */
const arityOf = (c: CriterionRow, params: Param[]): 'single' | 'multi' => {
  if (c.template === 'current_user') return c.user_field === 'user_id' ? 'single' : 'multi'
  const p = params.find((x) => x.id === c.parameter_id)
  return p?.base_type === 'array' ? 'multi' : 'single'
}

const LOGICAL_LABEL: Record<LogicalOperator, string> = { all: 'All', any: 'Any', none: 'None' }

export function CriteriaEditor(
  { actionTypeId, params: all }: { actionTypeId: string; params: Param[] },
) {
  // "These parameter types are removed from the selection panel." We have no
  // object set parameter; attachment is the half of that sentence we can honour.
  const params = all.filter((p) => p.base_type !== 'attachment')
  const { data: canEdit, isLoading: askingEdit } = useCanEditActionType(actionTypeId)
  const { data: rows = [], isLoading } = useCriteria(actionTypeId)
  const { data: operators = [] } = useSubmissionOperators()
  const add = useAddCriterion(actionTypeId)
  const update = useUpdateCriterion(actionTypeId)
  const del = useDeleteCriterion(actionTypeId)

  if (isLoading || askingEdit) return null
  if (canEdit === false) {
    return (
      <div className="oma-config">
        <h3 className="text-sm font-semibold">Execution</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Submission criteria are hidden from users who cannot edit this action type. They still
          apply — a submission that does not meet them is refused with the criterion's message.
        </p>
      </div>
    )
  }
  const roots = childrenOf(rows, null)

  const addAt = (parent: string | null, node: 'condition' | 'logical') => {
    add.mutate(node === 'logical'
      ? { node_type: 'logical', parent_id: parent, logical_operator: 'all' }
      : {
          node_type: 'condition', parent_id: parent, template: 'current_user',
          user_field: 'group_ids', operator: 'includes', value_source: 'static',
        })
  }

  const Row = ({ c }: { c: CriterionRow }) => (
    <div className="oma-crit-row">
      {/* The overview gives every row a drag handle, logical operators included.
          Reordering is not built; the handle would promise it. */}
      <Icon icon="drag-handle-vertical" size={12} className="text-muted-foreground shrink-0" />
      {c.node_type === 'logical'
        ? <LogicalRow c={c} />
        : <ConditionRow c={c} />}
      <Button variant="minimal" size="small" icon="cross" className="ml-auto"
        title="Remove" onClick={() => { del.mutate(c.id) }} />
    </div>
  )

  const LogicalRow = ({ c }: { c: CriterionRow }) => (
    <span className="flex items-center gap-1.5 text-xs">
      Match
      {/* The operator word is the control — the screenshot renders it in amber. */}
      <HTMLSelect minimal value={c.logical_operator ?? 'all'} className="oma-crit-op"
        onChange={(e) => {
          update.mutate({ id: c.id, logical_operator: e.currentTarget.value as LogicalOperator })
        }}>
        {(['all', 'any', 'none'] as LogicalOperator[]).map((o) => (
          <option key={o} value={o}>{LOGICAL_LABEL[o]}</option>
        ))}
      </HTMLSelect>
      conditions below:
    </span>
  )

  const ConditionRow = ({ c }: { c: CriterionRow }) => {
    const arity = arityOf(c, params)
    const allowed = operators.filter((o) => o.arity === arity)
    return (
      <span className="flex items-center gap-1.5 flex-wrap text-xs">
        <HTMLSelect minimal value={c.template ?? 'current_user'}
          onChange={(e) => {
            const t = e.currentTarget.value as Template
            update.mutate(t === 'current_user'
              ? { id: c.id, template: t, user_field: 'group_ids', parameter_id: null }
              : { id: c.id, template: t, user_field: null, parameter_id: params[0]?.id ?? null })
          }}>
          <option value="current_user">Current user</option>
          <option value="parameter">Parameter</option>
        </HTMLSelect>

        {c.template === 'current_user' ? (
          <HTMLSelect minimal value={c.user_field ?? 'group_ids'}
            onChange={(e) => { update.mutate({ id: c.id, user_field: e.currentTarget.value as UserField }) }}>
            <option value="user_id">user ID</option>
            <option value="group_ids">groups</option>
            <option value="attribute">attribute</option>
          </HTMLSelect>
        ) : (
          <>
            <HTMLSelect minimal value={c.parameter_id ?? ''}
              onChange={(e) => { update.mutate({ id: c.id, parameter_id: e.currentTarget.value }) }}>
              {params.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </HTMLSelect>
            <Tag minimal className="font-mono">
              {params.find((p) => p.id === c.parameter_id)?.base_type ?? '—'}
            </Tag>
          </>
        )}

        {c.template === 'current_user' && c.user_field === 'attribute' && (
          <InputGroup size="small" placeholder="attribute name" value={c.attribute_name ?? ''}
            onValueChange={(v) => { update.mutate({ id: c.id, attribute_name: v }) }}
            className="oma-crit-attr" />
        )}

        {/* "Only showing compatible operators" — the arity split is
            submission_operators()'s own, and the italic is the screenshot's. */}
        <HTMLSelect minimal value={c.operator ?? ''} className="oma-crit-verb"
          title="Only showing compatible operators"
          onChange={(e) => { update.mutate({ id: c.id, operator: e.currentTarget.value }) }}>
          {allowed.map((o) => (
            <option key={o.operator} value={o.operator} title={o.note}>{o.operator}</option>
          ))}
        </HTMLSelect>

        <HTMLSelect minimal value={c.value_source ?? 'static'}
          onChange={(e) => {
            const v = e.currentTarget.value as ValueSource
            update.mutate({
              id: c.id, value_source: v,
              value_parameter_id: v === 'parameter' ? params[0]?.id ?? null : null,
              static_value: v === 'static' ? '' : null,
            })
          }}>
          <option value="static">Specific value</option>
          <option value="parameter">Parameter</option>
          <option value="none">No value</option>
        </HTMLSelect>

        {c.value_source === 'static' && (
          <InputGroup size="small" value={typeof c.static_value === 'string' ? c.static_value : ''}
            onValueChange={(v) => { update.mutate({ id: c.id, static_value: v }) }}
            className="oma-crit-val" />
        )}
        {c.value_source === 'parameter' && (
          <HTMLSelect minimal value={c.value_parameter_id ?? ''}
            onChange={(e) => { update.mutate({ id: c.id, value_parameter_id: e.currentTarget.value }) }}>
            {params.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </HTMLSelect>
        )}
      </span>
    )
  }

  /** "Every condition and logical operator on the root level has its own failure
   *  message… The failure message will be displayed to the end user across
   *  Foundry whenever a condition is not met." So only roots take one. */
  const FailureMessage = ({ c }: { c: CriterionRow }) => (
    <div className="oma-crit-msg">
      <Icon icon="warning-sign" size={11} className="text-muted-foreground shrink-0" />
      <InputGroup size="small" fill value={c.failure_message ?? ''}
        placeholder="Failure message shown to the user when this is not met"
        onValueChange={(v) => { update.mutate({ id: c.id, failure_message: v }) }} />
    </div>
  )

  const Level = ({ parent, root }: { parent: string | null; root: boolean }) => (
    <div className={root ? undefined : 'oma-crit-level'}>
      {childrenOf(rows, parent).map((c) => (
        <div key={c.id}>
          <Row c={c} />
          {root && <FailureMessage c={c} />}
          {c.node_type === 'logical' && <Level parent={c.id} root={false} />}
        </div>
      ))}
      <div className="oma-crit-add">
        <Icon icon="plus" size={11} />
        <span>Add a </span>
        <Button variant="minimal" size="small" onClick={() => { addAt(parent, 'condition') }}>condition</Button>
        <span> or a </span>
        <Button variant="minimal" size="small" onClick={() => { addAt(parent, 'logical') }}>logical operator</Button>
      </div>
    </div>
  )

  return (
    <div className="oma-config">
      <h3 className="text-sm font-semibold">Execution</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        Conditions that determine whether this action can be submitted. Independent from who may
        edit the action type itself.
      </p>
      {roots.length === 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          No criteria — this action can be submitted by anyone who can see it.
        </p>
      )}
      <Level parent={null} root />
      {roots.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          <Tag minimal className="mr-1">note</Tag>
          A <strong>None</strong> over a groups condition is a misconfiguration — scoped tokens may
          lack the attribute, so the condition passes and grants more access than intended.
        </p>
      )}
    </div>
  )
}

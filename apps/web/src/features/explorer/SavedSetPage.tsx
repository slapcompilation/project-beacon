// A saved set, opened: the name and kind, how many objects it holds right now
// — live for an exploration, stored for a list — its rows through the same
// engine path, and for an exploration a way back into editing: open the
// filters as a new exploration.

import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Icon, NonIdealState, Spinner, Tag } from '@blueprintjs/core'
import { useObjectTypes } from '@/features/objectTypes/hooks'
import { useSavedSetRows, useSavedSetSize, useSavedSets } from './api'

export default function SavedSetPage() {
  const { setId = '' } = useParams()
  const navigate = useNavigate()
  const { data: sets = [], isLoading } = useSavedSets()
  const { data: types = [] } = useObjectTypes()
  const set = sets.find((s) => s.id === setId) ?? null
  const type = types.find((t) => t.id === set?.subject_type_id) ?? null
  const { data: size } = useSavedSetSize(set?.id ?? null)
  const { data: rows = [] } = useSavedSetRows(set?.id ?? null)

  if (isLoading) return <Spinner />
  if (!set || !type) return <NonIdealState icon="search" title="No such saved set" />

  const props = [...type.object_type_properties]
    .filter((p) => p.visibility !== 'hidden')
    .sort((a, b) => a.position - b.position)

  return (
    <div className="explorer-page">
      <div className="exploration-header">
        <Link to="/explorer" className="text-muted-foreground"><Icon icon="arrow-left" /></Link>
        <Icon icon={set.set_kind === 'list' ? 'th-list' : 'search-template'} size={18} color="#7961db" />
        <h1 className="exploration-title">{set.name}</h1>
        <Tag minimal>{set.set_kind === 'list' ? 'List' : 'Exploration'}</Tag>
        <Tag minimal round intent="primary">{size ?? '…'} objects</Tag>
        <span className="flex-1" />
        {set.set_kind === 'exploration' && (
          <Button icon="timeline-bar-chart" onClick={() => {
            void navigate(`/explorer/${type.id}`, { state: { filters: set.filters } })
          }}>
            Open as exploration
          </Button>
        )}
      </div>
      {set.description && <p className="explorer-sub">{set.description}</p>}

      <div className="results-scroll">
        <table className="results-table">
          <thead>
            <tr>{props.map((p) => <th key={p.property_id}>{p.display_name}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {props.map((p) => (
                  <td key={p.property_id}>
                    {r[p.property_id] === null || r[p.property_id] === undefined
                      ? '—' : typeof r[p.property_id] === 'object'
                        ? JSON.stringify(r[p.property_id]) : String(r[p.property_id] as string | number | boolean)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <NonIdealState icon="th" title="This set holds no objects" />}
      </div>
    </div>
  )
}

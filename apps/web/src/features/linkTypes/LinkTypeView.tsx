// Foundry's link type view: a metadata card, a Configuration card carrying the
// join method and the key pairing, and both directions of the link.
//
// Ten columns reached nothing before this. `link_types` topped the unread-column
// sweep, and they were not scattered leftovers — source_label/target_label,
// source_api_name/target_api_name and source_visibility/target_visibility are
// the two directions the course records ("Both directions get sentence
// renderings and API names… Per-direction Visibility"), and backing_kind with
// its key columns is the Join method. See readings/link-type-view.md.
import { Icon, Tag } from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import {
  BACKING_LABEL, BACKING_ICON, CARDINALITY_LABEL, LINK_BACKINGS, canBack,
  type LinkTypeDef, type ObjectTypeDef, type LinkBackingKind,
} from '@beacon/ontology'
import { cn } from '@/lib/utils'
import { MetaShell, Row } from '@/features/objectTypes/MetadataCard'
import { tileStyle, typePath } from '@/features/ontologyManager/resources'

function TypeChip({ type }: { type: ObjectTypeDef | undefined }) {
  if (type === undefined) return <Tag minimal>Unknown type</Tag>
  return (
    <Link to={typePath(type.id)} className="flex items-center gap-2 min-w-0">
      <span className="oma-tile is-sm" style={tileStyle(type)}>
        <Icon icon={type.icon as 'cube'} size={12} />
      </span>
      <span className="truncate">{type.label}</span>
    </Link>
  )
}

/** One direction of the link: its sentence, its generated API name, and its own
 *  visibility. Showing one side would misrepresent the model. */
function Direction(
  { from, to, sentence, apiName, visibility }:
  { from: ObjectTypeDef | undefined; to: ObjectTypeDef | undefined
    sentence: string | null | undefined; apiName: string | null | undefined
    visibility: string | null | undefined },
) {
  return (
    <div className="oma-link-dir">
      <div className="flex items-center gap-2 min-w-0 text-sm">
        <TypeChip type={from} />
        <Icon icon="arrow-right" size={12} className="text-muted-foreground shrink-0" />
        <TypeChip type={to} />
      </div>
      <p className="text-xs mt-1.5">
        {sentence !== null && sentence !== undefined && sentence !== ''
          ? sentence
          : <span className="text-muted-foreground">No sentence set</span>}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <Tag minimal className="font-mono">{apiName ?? '—'}</Tag>
        <Tag minimal icon="eye-open">{visibility ?? 'normal'}</Tag>
      </div>
    </div>
  )
}

export function LinkTypeView(
  { link, types, ontologyName }:
  { link: LinkTypeDef; types: ObjectTypeDef[]; ontologyName: string },
) {
  const byId = new Map(types.map((t) => [t.id, t]))
  const source = byId.get(link.sourceTypeId)
  const target = byId.get(link.targetTypeId)
  const backing = link.backingKind ?? null

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center gap-2 min-w-0">
        <TypeChip type={source} />
        <Icon icon="link" size={13} className="text-muted-foreground shrink-0" />
        <TypeChip type={target} />
        {/* The cardinality is a sentence under the title, not a diagram. */}
        <span className="text-xs text-muted-foreground ml-2">
          {link.cardinality !== null && link.cardinality !== undefined
            ? CARDINALITY_LABEL[link.cardinality] : 'Cardinality not set'}
        </span>
      </div>

      <MetaShell
        left={<>
          <Row label="Ontology">{ontologyName}</Row>
          <Row label="API name"><span className="font-mono truncate">{link.apiName}</span></Row>
        </>}
        right={<Row label="Status"><Tag minimal>{link.status ?? 'experimental'}</Tag></Row>}
        identity={<>
          <Row label="ID"><span className="font-mono truncate">{link.id}</span></Row>
          <Row label="RID"><span className="font-mono truncate">{link.rid ?? 'Set on save'}</span></Row>
        </>}
      />

      <div className="oma-config">
        <h3 className="text-sm font-semibold">Configuration</h3>
        <p className="text-xs text-muted-foreground mt-3 mb-2">Join method</p>
        {/* Read-only in this pass: changing it rewrites dataset, key columns and
            backing type together, and a half-rebound link is worse than none
            (readings/link-type-view.md Decision 3). A cardinality cannot express
            every backing, so the ones it cannot are shown unavailable. */}
        <div className="oma-joins">
          {LINK_BACKINGS.map((b: LinkBackingKind) => {
            const allowed = link.cardinality === null || link.cardinality === undefined
              || canBack(link.cardinality, b)
            return (
              <div key={b} className={cn('oma-join', b === backing && 'is-active', !allowed && 'is-out')}
                title={allowed ? undefined : 'This cardinality cannot be expressed by this backing'}>
                <Icon icon={BACKING_ICON[b]} size={16} />
                <span>{BACKING_LABEL[b]}</span>
              </div>
            )
          })}
        </div>

        {backing === 'foreign_key' && (
          <>
            <p className="text-xs text-muted-foreground mt-4 mb-2">
              The property on each side that carries the join.
            </p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Tag minimal className="font-mono">{link.sourceKeyColumn ?? '—'}</Tag>
              <Icon icon="arrows-horizontal" size={12} className="text-muted-foreground" />
              <Tag minimal className="font-mono">{link.targetKeyColumn ?? '—'}</Tag>
            </div>
          </>
        )}
        {backing === 'join_table' && (
          <p className="text-xs text-muted-foreground mt-4">
            Backed by a join dataset{link.datasetId !== null && link.datasetId !== undefined ? '' : ' — none bound yet'}.
          </p>
        )}
        {backing === 'object_backed' && (
          <div className="flex items-center gap-2 mt-4 text-xs">
            <span className="text-muted-foreground">Backed by</span>
            <TypeChip type={link.backingObjectTypeId !== null && link.backingObjectTypeId !== undefined
              ? byId.get(link.backingObjectTypeId) : undefined} />
          </div>
        )}
        {backing === null && (
          <p className="text-xs text-muted-foreground mt-4">No join method set.</p>
        )}
      </div>

      <div className="oma-config">
        <h3 className="text-sm font-semibold">Directions</h3>
        <div className="oma-dirs">
          <Direction from={source} to={target} sentence={link.targetLabel}
            apiName={link.targetApiName} visibility={link.targetVisibility} />
          <Direction from={target} to={source} sentence={link.sourceLabel}
            apiName={link.sourceApiName} visibility={link.sourceVisibility} />
        </div>
      </div>
    </section>
  )
}

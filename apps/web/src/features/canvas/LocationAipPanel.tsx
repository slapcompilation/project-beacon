// Phase F5 — Zone-shaped AIP detail rendered in the ContextPanel's Detail
// tab when an operator clicks a zone tile on Canvas. Reuses the existing
// Refine flow (/variant/<id>?refine=<proposalId>) so a queued proposal can
// be refined inline from Canvas without leaving the panel.

import { Link } from 'react-router-dom'
import { Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useLocationAip, type ZoneProposal } from './useLocationAip'

export function LocationAipPanel({ locationId }: { locationId: string }) {
  const { data, isLoading, isError } = useLocationAip(locationId)

  if (isLoading) {
    return (
      <div className="px-4 py-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading zone observations…
      </div>
    )
  }
  if (isError || !data) {
    return <div className="px-4 py-4 text-xs text-muted-foreground">Zone observations unavailable.</div>
  }

  const atRiskCount = data.variants.filter((v) => v.at_risk).length

  return (
    <div className="divide-y divide-border/50">
      {/* Variants */}
      <Section
        icon="cube"
        title={`Variants · ${String(data.variants.length)}`}
        chip={atRiskCount > 0 ? <Tag minimal intent={Intent.WARNING} className="!text-[10px]">{atRiskCount} at risk</Tag> : null}
      >
        {data.variants.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No variants assigned to this zone yet.</p>
        ) : (
          <ul className="space-y-1">
            {data.variants.slice(0, 12).map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-xs">
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', v.at_risk ? 'bg-amber-400' : 'bg-emerald-500')} />
                <Link to={`/objects/variant/${v.id}`} className="flex-1 truncate hover:underline">
                  {v.product_name ? <span className="text-muted-foreground/80">{v.product_name} · </span> : null}
                  <span>{v.name}</span>
                </Link>
                <span className="tabular-nums text-[10px] text-muted-foreground/70">
                  {v.current_stock}{v.low_stock_threshold ? ` / ${String(v.low_stock_threshold)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Pending proposals */}
      <Section
        icon="predictive-analysis"
        title={`Pending proposals · ${String(data.proposals.length)}`}
        chip={data.proposals.length > 0 ? <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">queue</Tag> : null}
      >
        {data.proposals.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No agent proposals targeting this zone right now.</p>
        ) : (
          <ul className="space-y-2">
            {data.proposals.map((p) => <ProposalRow key={p.id} p={p} />)}
          </ul>
        )}
      </Section>

      {/* Unread alerts */}
      <Section
        icon="warning-sign"
        title={`Active alerts · ${String(data.alerts.length)}`}
        chip={data.alerts.length > 0 ? <Tag minimal intent={Intent.DANGER} className="!text-[10px]">unread</Tag> : null}
      >
        {data.alerts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No unread alerts for variants in this zone.</p>
        ) : (
          <ul className="space-y-1">
            {data.alerts.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-xs">
                <Tag minimal className="font-mono !text-[10px]">{a.type}</Tag>
                <Link to={`/objects/alert/${a.id}`} className="flex-1 truncate text-muted-foreground hover:underline">
                  {a.variant_id ? a.variant_id.slice(0, 8) : '—'}
                </Link>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Section({ icon, title, chip, children }: { icon: 'cube' | 'predictive-analysis' | 'warning-sign'; title: string; chip: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={icon} size={11} className="text-muted-foreground" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">{title}</p>
        {chip}
      </div>
      {children}
    </div>
  )
}

function ProposalRow({ p }: { p: ZoneProposal }) {
  const band =
    p.confidence >= 0.85 ? 'bg-emerald-500' :
    p.confidence >= 0.6  ? 'bg-amber-400'   : 'bg-red-500'
  return (
    <li className="rounded border bg-card px-2.5 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', band)} />
        <Tag minimal className="font-mono !text-[10px]">{p.action_type}</Tag>
        <span className="text-muted-foreground flex-1 truncate">{p.agent_name}</span>
        <span className="tabular-nums text-muted-foreground/70 shrink-0">{Math.round(p.confidence * 100)}%</span>
      </div>
      {p.reasoning && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/80 line-clamp-2">{p.reasoning}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Link to={`/objects/variant/${p.variant_id}?refine=${p.id}`} className="text-[11px] text-primary hover:underline">
          Refine →
        </Link>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">
          {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
        </span>
      </div>
    </li>
  )
}

// Compass resource status, for every kind that can carry it.
//
// These hooks started under objectTypes because object types were the first
// promotable kind. Promotion spans three — object types, applications and
// documents — so it lives on its own, and the toggle below is the one control
// all three share.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon, Switch, Tag } from '@blueprintjs/core'
import { promotionEffects, PROMOTABLE_LABELS, type PromotableKind } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'

const KEY = ['resource-promotions'] as const

/** Every promotion in the org, keyed `kind:id`. One read backs every toggle. */
export function usePromotions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('resource_status')
        .select('resource_kind, resource_id').eq('status', 'promoted')
      if (error) throw new Error(error.message)
      return new Set((data as { resource_kind: string; resource_id: string }[])
        .map((r) => `${r.resource_kind}:${r.resource_id}`))
    },
    staleTime: 30_000,
  })
}

/** Promotion is a row; removing it deletes that row. Foundry has no "not
 *  promoted" value — "the resource will return to its default state". */
export function useSetPromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { kind: PromotableKind; id: string; promoted: boolean }) => {
      const { error } = i.promoted
        ? await supabase.from('resource_status').insert({ resource_kind: i.kind, resource_id: i.id })
        : await supabase.from('resource_status').delete()
            .eq('resource_kind', i.kind).eq('resource_id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: KEY })
      // Promoting an object type sets its visibility, in a trigger.
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      void qc.invalidateQueries({ queryKey: ['quicksearch'] })
      toast.success(v.promoted ? 'Promoted — it now leads search and the catalog' : 'Promotion removed')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The shared control. Compact by default; `withEffects` spells the three out
 *  where there is room to say them at the point of decision. */
export function PromoteToggle({ kind, id, withEffects = false }: {
  kind: PromotableKind
  id: string
  withEffects?: boolean
}) {
  const { data: promotions } = usePromotions()
  const promote = useSetPromotion()
  const isPromoted = promotions?.has(`${kind}:${id}`) ?? false

  if (!withEffects) {
    return (
      <Tag minimal interactive
        icon={<Icon icon={isPromoted ? 'endorsed' : 'star-empty'} size={11}
                    className={isPromoted ? 'text-violet-500' : 'text-muted-foreground'} />}
        className="!text-[9px]"
        title={isPromoted
          ? 'Promoted — leads search and appears in the catalog. Click to remove.'
          : `Promote this ${PROMOTABLE_LABELS[kind]} so it leads search for everyone.`}
        onClick={(e) => {
          e.stopPropagation()
          promote.mutate({ kind, id, promoted: !isPromoted })
        }}>
        {isPromoted ? 'Promoted' : 'Promote'}
      </Tag>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <Switch checked={isPromoted} disabled={promote.isPending} className="!mb-0"
        labelElement={<span className="text-xs font-medium">Promote this {PROMOTABLE_LABELS[kind]}</span>}
        onChange={(e) => { promote.mutate({ kind, id, promoted: e.currentTarget.checked }) }} />
      <ul className="text-[11px] text-muted-foreground space-y-0.5 flex-1">
        {promotionEffects(kind).map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  )
}

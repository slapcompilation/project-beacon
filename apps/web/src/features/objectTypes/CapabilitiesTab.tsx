// The Capabilities tab — "object types now have a Capabilities page to
// configure features historically defined as type classes. The configuration
// of all supported type classes will move to the Capabilities page."
// (object-link-types/metadata-typeclasses)
//
// The shape is the Geospatial panel screenshot: a capability is a panel with an
// icon, a title, a one-line description and a collapse chevron; each slot is a
// row with a "Choose a property" dropdown. The slot vocabulary and the types
// each slot accepts are the platform's — capability_slots() — never restated
// here, so the picker offers exactly what the guard will accept.

import { useState } from 'react'
import { Callout, Collapse, HTMLSelect, Icon, Spinner, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useCapabilitySlots, useObjectTypeCapabilities, useNominate } from './capabilities'

/** Panel chrome per capability. The Geospatial line is the screenshot's own;
 *  no page or screenshot read gives Event a description, so it gets its
 *  slots' subject rather than an invented quote. */
const PANELS: Record<string, { title: string; icon: IconName; blurb: string }> = {
  geospatial: {
    title: 'Geospatial',
    icon: 'globe',
    blurb: 'Each Object represents a geospatial feature',
  },
  event: {
    title: 'Event',
    icon: 'timeline-events',
    blurb: 'Properties that identify and bound an event object',
  },
}

const titleCase = (slot: string) =>
  slot.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function CapabilitiesTab({ type }: { type: ObjectTypeDef }) {
  const { data: slots, isLoading } = useCapabilitySlots()
  const { data: chosen } = useObjectTypeCapabilities(type.id)
  const nominate = useNominate(type.id)
  const [open, setOpen] = useState<Record<string, boolean>>({ geospatial: true })

  if (isLoading || !slots) return <Spinner size={20} />

  const capabilities = [...new Set(slots.map((s) => s.capability))]

  return (
    <div className="space-y-3">
      <Callout className="!text-[11px]">
        A capability is this object type nominating its own properties against a
        platform contract. Each slot accepts particular base types; the picker
        offers only properties that fit.
      </Callout>

      {capabilities.map((cap) => {
        const panel = PANELS[cap] ?? { title: titleCase(cap), icon: 'cube' as IconName, blurb: '' }
        const rows = slots.filter((s) => s.capability === cap)
        const filled = rows.filter((s) => chosen?.has(`${cap}/${s.slot}`)).length
        const isOpen = open[cap] ?? false
        return (
          <section key={cap} className="rounded border">
            <button type="button" className="flex w-full items-center gap-2 p-3 text-left"
              onClick={() => { setOpen({ ...open, [cap]: !isOpen }) }}>
              <Icon icon={panel.icon} size={15} className="text-violet-500" />
              <span className="text-sm font-semibold">{panel.title}</span>
              <span className="text-[11px] text-muted-foreground">{panel.blurb}</span>
              {filled > 0 && <Tag minimal round className="!text-[10px]">{filled} set</Tag>}
              <Icon icon={isOpen ? 'chevron-up' : 'chevron-down'} size={13} className="ml-auto" />
            </button>

            <Collapse isOpen={isOpen}>
              <div className="space-y-2 border-t p-3">
                {rows.map((s) => {
                  // The guard compares the property's base type against this
                  // slot's accepts, so the same list decides what is offered.
                  const eligible = type.properties.filter(
                    (p) => p.id !== undefined && s.accepts.includes(p.type))
                  const current = chosen?.get(`${cap}/${s.slot}`) ?? ''
                  return (
                    <div key={s.slot} className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{titleCase(s.slot)}</p>
                        <p className="text-[11px] text-muted-foreground">{s.note}</p>
                      </div>
                      <div className="shrink-0">
                        <HTMLSelect value={current} disabled={nominate.isPending}
                          onChange={(e) => {
                            nominate.mutate({
                              capability: cap, slot: s.slot,
                              propertyId: e.currentTarget.value || null,
                            })
                          }}>
                          <option value="">Choose a property…</option>
                          {eligible.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </HTMLSelect>
                        {eligible.length === 0 && (
                          <p className="mt-1 text-right text-[10px] text-muted-foreground">
                            no {s.accepts.join(' / ')} property
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Collapse>
          </section>
        )
      })}
    </div>
  )
}

// Purpose switcher (purpose-based controls). Declaring a purpose NARROWS what
// sensitive data the operator sees — the same user under "Operations" sees only
// internal documents, under "Compliance" sees restricted. Sends the choice as
// the x-beacon-purpose header; RLS enforces the ceiling. Changing it refetches
// document views so the visible set reflects the new purpose immediately.

import { Icon, Menu, MenuDivider, MenuItem, Popover, Tag } from '@blueprintjs/core'
import { useQueryClient } from '@tanstack/react-query'
import { usePurposeStore } from '@/stores/purpose.store'
import { useAccessPurposes } from './hooks'

export function PurposeSwitcher({ variant }: { variant?: 'sidebar' } = {}) {
  const onDark = variant === 'sidebar'
  const qc = useQueryClient()
  const active = usePurposeStore((s) => s.activePurpose)
  const setPurpose = usePurposeStore((s) => s.setPurpose)
  const { data: purposes = [] } = useAccessPurposes()

  const choose = (id: string | null) => {
    setPurpose(id)
    // Visible documents/chunks depend on the purpose — refetch anything that reads them.
    void qc.invalidateQueries({ queryKey: ['documents'] })
    void qc.invalidateQueries({ queryKey: ['documents-for-node'] })
  }

  const activePurpose = purposes.find((p) => p.id === active)
  const label = activePurpose?.label ?? 'No purpose'

  return (
    <Popover
      placement="bottom-start"
      content={
        <Menu className="!min-w-64">
          <MenuDivider title="Access purpose" />
          <MenuItem
            icon="cross"
            text="No purpose (role only)"
            labelElement={active == null ? <Icon icon="tick" size={12} /> : undefined}
            onClick={() => { choose(null) }}
          />
          <MenuDivider />
          {purposes.map((p) => (
            <MenuItem
              key={p.id}
              icon="shield"
              text={
                <span className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <span className="flex-1">{p.label}</span>
                    <Tag minimal className="!text-[9px]">≤ {p.max_sensitivity}</Tag>
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-snug">{p.description}</span>
                </span>
              }
              labelElement={active === p.id ? <Icon icon="tick" size={12} /> : undefined}
              onClick={() => { choose(p.id) }}
            />
          ))}
        </Menu>
      }
    >
      <button className={onDark
        ? 'flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[#cfd4dd] transition-colors hover:bg-white/5 hover:text-white'
        : 'flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors max-w-[180px]'}>
        <Icon icon="shield" size={12} className="shrink-0" />
        <span className="flex-1 truncate text-left">{label}</span>
        <Icon icon="chevron-down" size={10} className="shrink-0" />
      </button>
    </Popover>
  )
}

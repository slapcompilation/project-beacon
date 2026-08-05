// Right context panel. Tabs: Detail · Copilot · Graph.
// Desktop: inline aside with slide animation. Mobile: Drawer overlay.
// Always mounted so Copilot chat state survives toggles.

import { Drawer, Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useAppStore, type ContextPanelTab } from '@/stores/app.store'
import { CopilotChatView } from '@/features/eye/components/CopilotChatView'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { DetailTabContent } from './context-panel/DetailTab'

const TABS: { id: ContextPanelTab; label: string; icon: IconName }[] = [
  { id: 'detail',  label: 'Detail',  icon: 'info-sign' },
  { id: 'copilot', label: 'Copilot', icon: 'predictive-analysis' },
]

function ContextPanelContent() {
  const contextPanelTab    = useAppStore((s) => s.contextPanelTab)
  const setContextPanelTab = useAppStore((s) => s.setContextPanelTab)
  const setContextPanelOpen = useAppStore((s) => s.setContextPanelOpen)

  return (
    <>
      <div className="flex items-center border-b border-border shrink-0">
        <div className="flex flex-1 px-2" role="tablist">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={contextPanelTab === id}
              onClick={() => { setContextPanelTab(id) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                contextPanelTab === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon icon={icon} size={12} />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setContextPanelOpen(false) }}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Close context panel"
        >
          <Icon icon="cross" size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {contextPanelTab === 'detail'  && <DetailTabContent />}
        {contextPanelTab === 'copilot' && <CopilotChatView compact />}
      </div>
    </>
  )
}

function ContextPanelInline() {
  const contextPanelOpen = useAppStore((s) => s.contextPanelOpen)

  return (
    <aside
      className={cn(
        'w-[380px] shrink-0 border-l border-border bg-surface-1 flex flex-col h-full overflow-hidden',
        'transition-[transform,opacity,margin] duration-200 ease-out',
        contextPanelOpen
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 pointer-events-none -mr-[380px]',
      )}
      style={contextPanelOpen ? undefined : { marginRight: -380 }}
    >
      <ContextPanelContent />
    </aside>
  )
}

export function ContextPanel() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const open      = useAppStore((s) => s.contextPanelOpen)
  const setOpen   = useAppStore((s) => s.setContextPanelOpen)

  if (isDesktop) return <ContextPanelInline />

  return (
    <Drawer
      isOpen={open}
      onClose={() => { setOpen(false) }}
      position="right"
      size="100%"
      className="!p-0 sm:!max-w-sm"
      hasBackdrop
    >
      <ContextPanelContent />
    </Drawer>
  )
}

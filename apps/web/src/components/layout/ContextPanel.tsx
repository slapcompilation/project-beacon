// Layer: meta — right context panel (three-zone layout)
// Three tabs: Detail (entity context), Copilot (AI chat), Graph (connections).
// Replaces the old ObjectPanel with an always-accessible intelligence surface.
// Copilot lives here so it's available from any page, not buried in Eye workspace.
// Always mounted to preserve Copilot chat state. Desktop: inline aside with slide
// animation. Mobile (< lg): Sheet overlay via Radix Dialog.

import { X, Sparkles, GitBranch, Info } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAppStore, type ContextPanelTab } from '@/stores/app.store'
import { CopilotChatView } from '@/features/eye/components/CopilotChatView'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { DetailTabContent } from './context-panel/DetailTab'
import { GraphTabContent } from './context-panel/GraphTab'

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS: { id: ContextPanelTab; label: string; icon: React.ElementType }[] = [
  { id: 'detail',  label: 'Detail',  icon: Info },
  { id: 'copilot', label: 'Copilot', icon: Sparkles },
  { id: 'graph',   label: 'Graph',   icon: GitBranch },
]

// ─── Panel inner content (shared between desktop inline and mobile Sheet) ────

function ContextPanelContent() {
  const contextPanelTab    = useAppStore((s) => s.contextPanelTab)
  const setContextPanelTab = useAppStore((s) => s.setContextPanelTab)
  const setContextPanelOpen = useAppStore((s) => s.setContextPanelOpen)

  return (
    <>
      {/* Tab bar + close button */}
      <div className="flex items-center border-b border-border shrink-0">
        <div className="flex flex-1 px-2" role="tablist">
          {TABS.map(({ id, label, icon: TabIcon }) => (
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
              <TabIcon className="h-3 w-3" />
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
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {contextPanelTab === 'detail'  && <DetailTabContent />}
        {contextPanelTab === 'copilot' && <CopilotChatView compact />}
        {contextPanelTab === 'graph'   && <GraphTabContent />}
      </div>
    </>
  )
}

// ─── Desktop: inline aside with slide animation ─────────────────────────────

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

// ─── Export: desktop inline / mobile Sheet ───────────────────────────────────

export function ContextPanel() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const open      = useAppStore((s) => s.contextPanelOpen)
  const setOpen   = useAppStore((s) => s.setContextPanelOpen)

  // Desktop: always-mounted inline aside with slide animation
  if (isDesktop) return <ContextPanelInline />

  // Mobile: Sheet overlay (follows NotificationsPanel pattern)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
        <ContextPanelContent />
      </SheetContent>
    </Sheet>
  )
}

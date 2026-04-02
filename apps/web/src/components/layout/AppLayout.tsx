import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Bell } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from '@/components/OfflineBanner'
import { CommandBar } from '@/components/CommandBar'
import { QuickActions } from '@/components/QuickActions'
import { NotificationsPanel } from '@/components/NotificationsPanel'
import { ServiceWorkerUpdatePrompt } from '@/components/ServiceWorkerUpdatePrompt'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import { useEyeLayerPrefetch } from '@/hooks/useEyeLayerPrefetch'
import { useSilentAutoAlerts } from '@/features/notifications/hooks'
import { useUnreadNotificationCount } from '@/features/notifications/hooks'
import { useHotels } from '@/features/hotel/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAppStore } from '@/stores/app.store'
import { cn } from '@/lib/utils'

export function AppLayout() {
  useRealtimeSync()
  useKeyboardNav()
  useEyeLayerPrefetch()
  useSilentAutoAlerts() // background alert scan — runs on mount + every 10 min
  const { isOnline, isSyncing, pendingCount, syncError, retrySync, clearQueue } = useSyncQueue()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const unreadCount = useUnreadNotificationCount()
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)
  const activeHotelId = useActiveHotelId()
  const { data: hotels = [] } = useHotels()
  const activeHotel = hotels.find((h) => h.id === activeHotelId)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <OfflineBanner
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        syncError={syncError}
        onRetry={retrySync}
        onDiscardAll={clearQueue}
      />

      {/* Mobile header — hidden on lg+ where sidebar is always visible */}
      <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-border bg-slate-900 px-3 lg:hidden">
        <button
          type="button"
          onClick={() => { setSidebarOpen(true) }}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex-1 text-sm font-semibold text-white">
          {activeHotel?.name ?? 'Beacon'}
        </span>
        <button
          type="button"
          onClick={() => { setNotifPanelOpen(true) }}
          className="relative rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Backdrop overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => { setSidebarOpen(false) }}
          />
        )}

        {/* Sidebar — fixed overlay on mobile, static on lg+ */}
        <div className={cn(
          'fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto lg:flex lg:flex-shrink-0',
          sidebarOpen ? 'flex' : 'hidden lg:flex',
        )}>
          <Sidebar onClose={() => { setSidebarOpen(false) }} />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="page-fade h-full">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandBar />
      <QuickActions />
      <NotificationsPanel />
      <ServiceWorkerUpdatePrompt />
    </div>
  )
}

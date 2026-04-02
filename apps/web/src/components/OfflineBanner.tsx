import { useState } from 'react'
import { WifiOff, Loader2, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Props {
  isOnline:     boolean
  isSyncing:    boolean
  pendingCount: number
  syncError?:   boolean          // queue stalled — an item failed to sync
  onRetry?:     () => void
  onDiscardAll?: () => Promise<void>
}

export function OfflineBanner({
  isOnline, isSyncing, pendingCount, syncError, onRetry, onDiscardAll,
}: Props) {
  const [discarding, setDiscarding] = useState(false)

  // Nothing to show when fully online and queue is clear
  if (isOnline && !isSyncing && pendingCount === 0 && !syncError) return null

  const handleDiscard = async () => {
    if (!onDiscardAll) return
    setDiscarding(true)
    try { await onDiscardAll() } finally { setDiscarding(false) }
  }

  // ── Sync stalled — an RPC error blocked the queue ──────────────────────────
  if (syncError && isOnline) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-amber-600 px-4 py-2 text-sm text-white">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 min-w-0">
          {pendingCount > 0
            ? `${String(pendingCount)} adjustment${pendingCount !== 1 ? 's' : ''} couldn't sync — possible network or server issue.`
            : 'Sync failed. Adjustments may not have been saved.'}
        </span>
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs border-white/40 text-white hover:bg-white/10 hover:text-white"
              onClick={onRetry}
              disabled={isSyncing}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          {onDiscardAll && pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs border-white/40 text-white hover:bg-white/10 hover:text-white"
              onClick={() => { void handleDiscard() }}
              disabled={discarding}
            >
              {discarding
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><Trash2 className="h-3 w-3 mr-1" />Discard all</>
              }
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Offline ─────────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2.5 bg-red-600 px-4 py-2 text-sm text-white">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 min-w-0 leading-snug">
          Offline — adjustments will sync when you reconnect.
        </span>
        {pendingCount > 0 && (
          <Badge
            variant="outline"
            className="ml-auto flex-shrink-0 border-white/40 text-white"
          >
            {pendingCount} queued
          </Badge>
        )}
      </div>
    )
  }

  // ── Online, syncing ─────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2.5 bg-yellow-500 px-4 py-2 text-sm text-white">
      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
      <span>
        Syncing {pendingCount} offline adjustment{pendingCount !== 1 ? 's' : ''}…
      </span>
    </div>
  )
}

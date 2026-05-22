import { useState } from 'react'
import { Button, Icon, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'

interface Props {
  isOnline:     boolean
  isSyncing:    boolean
  pendingCount: number
  syncError?:   boolean
  onRetry?:     () => void
  onDiscardAll?: () => Promise<void>
}

export function OfflineBanner({
  isOnline, isSyncing, pendingCount, syncError, onRetry, onDiscardAll,
}: Props) {
  const [discarding, setDiscarding] = useState(false)

  if (isOnline && !isSyncing && pendingCount === 0 && !syncError) return null

  const handleDiscard = async () => {
    if (!onDiscardAll) return
    setDiscarding(true)
    try { await onDiscardAll() } finally { setDiscarding(false) }
  }

  // Sync stalled — an RPC error blocked the queue
  if (syncError && isOnline) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-amber-600 px-4 py-2 text-sm text-white">
        <Icon icon="warning-sign" size={14} className="flex-shrink-0" />
        <span className="flex-1 min-w-0">
          {pendingCount > 0
            ? `${String(pendingCount)} adjustment${pendingCount !== 1 ? 's' : ''} couldn't sync — possible network or server issue.`
            : 'Sync failed. Adjustments may not have been saved.'}
        </span>
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          {onRetry && (
            <Button
              size="small"
              variant="outlined"
              icon="refresh"
              onClick={onRetry}
              disabled={isSyncing}
              className="!h-6 !text-xs !border-white/40 !text-white hover:!bg-white/10"
            >
              Retry
            </Button>
          )}
          {onDiscardAll && pendingCount > 0 && (
            <Button
              size="small"
              variant="outlined"
              icon="trash"
              loading={discarding}
              onClick={() => { void handleDiscard() }}
              disabled={discarding}
              className="!h-6 !text-xs !border-white/40 !text-white hover:!bg-white/10"
            >
              Discard all
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2.5 bg-red-600 px-4 py-2 text-sm text-white">
        <Icon icon="offline" size={14} className="flex-shrink-0" />
        <span className="flex-1 min-w-0 leading-snug">
          Offline — adjustments will sync when you reconnect.
        </span>
        {pendingCount > 0 && (
          <Tag minimal className="ml-auto flex-shrink-0 !border-white/40 !text-white">
            {pendingCount} queued
          </Tag>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 bg-yellow-500 px-4 py-2 text-sm text-white">
      <Spinner size={SpinnerSize.SMALL} className="flex-shrink-0" />
      <span>
        Syncing {pendingCount} offline adjustment{pendingCount !== 1 ? 's' : ''}…
      </span>
    </div>
  )
}

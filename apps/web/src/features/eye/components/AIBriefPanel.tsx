// Daily brief synthesised from all live signals.

import { useEffect } from 'react'
import { Icon, Spinner, SpinnerSize } from '@blueprintjs/core'
import { useAIBrief } from '../hooks/useAIBrief'
import { useDateFormat } from '@/features/user/hooks'

export function AIBriefPanel() {
  const { data, isLoading, error, generate } = useAIBrief()
  const fmtDate = useDateFormat()

  useEffect(() => {
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-lg border bg-gradient-to-br from-purple-50/40 to-blue-50/20 dark:from-purple-950/20 dark:to-blue-950/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          <Icon icon="predictive-analysis" size={10} className="text-purple-500" />
          Mind · AI Brief
        </p>
        <button
          onClick={() => { void generate() }}
          disabled={isLoading}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 disabled:opacity-50"
          title="Regenerate brief"
        >
          {isLoading
            ? <Spinner size={SpinnerSize.SMALL} />
            : <Icon icon="refresh" size={10} />}
        </button>
      </div>

      {isLoading && !data ? (
        <div className="space-y-1.5 animate-pulse">
          <div className="h-2.5 bg-muted rounded w-full" />
          <div className="h-2.5 bg-muted rounded w-5/6" />
          <div className="h-2.5 bg-muted rounded w-4/6" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-1.5 text-destructive">
          <Icon icon="error" size={12} className="mt-0.5 flex-shrink-0" />
          <p className="text-[10px]">{error}</p>
        </div>
      ) : data ? (
        <>
          <p className="text-[11px] leading-relaxed text-foreground whitespace-pre-line">
            {data.brief}
          </p>
          <p className="text-[9px] text-muted-foreground/60 font-mono">
            Generated {fmtDate(new Date(data.generated_at))}
          </p>
        </>
      ) : null}
    </div>
  )
}

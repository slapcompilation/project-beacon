// Production Hardening — Sprint 19
// Per-panel error boundary: one broken panel doesn't crash the whole app.
// Shows an operator-grade inline error card — the tab bar and other panels
// remain fully functional. Click "Retry" to clear and re-mount the panel.
//
// Use case: wrap each workspace panel container so a runtime crash in e.g.
// PredictiveRestockPage doesn't kill EyeWorkspace.

import { Component, useState } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Copy button (functional component used inside the class fallback) ─────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => { setCopied(false); }, 2000)
  }
  return (
    <button
      onClick={() => { void handleCopy() }}
      className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied
        ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
        : <><Copy className="w-3 h-3" /> Copy error</>
      }
    </button>
  )
}

// ─── Boundary ──────────────────────────────────────────────────────────────────

interface Props {
  children:  ReactNode
  /** Shown in the error card header for context. Defaults to "Panel". */
  name?:     string
  className?: string
}

interface State {
  error: Error | null
  errorId: number   // increment on each retry to force a fresh mount
}

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorId: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const name = this.props.name ?? 'panel'
    console.error(`[PanelErrorBoundary:${name}]`, error.message)
    console.error(info.componentStack)
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, errorId: s.errorId + 1 }))
  }

  render() {
    const { error, errorId } = this.state

    if (error) {
      const details = [
        `Panel: ${this.props.name ?? 'unknown'}`,
        `Error: ${error.message}`,
        `Stack:\n${error.stack ?? 'unavailable'}`,
      ].join('\n\n')

      return (
        <div className={cn(
          'flex flex-1 flex-col items-center justify-center p-8 overflow-auto',
          this.props.className,
        )}>
          <div className="w-full max-w-lg rounded-lg border border-destructive/40 bg-destructive/5 p-5 space-y-4">

            {/* Header */}
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {this.props.name ? `${this.props.name} — ` : ''}Runtime error
                </div>
                <p className="mt-0.5 text-xs font-mono text-muted-foreground break-all leading-relaxed">
                  {error.message}
                </p>
              </div>
            </div>

            {/* Stack excerpt */}
            {error.stack && (
              <pre className="max-h-32 overflow-y-auto rounded border bg-muted/30 p-2.5 text-[10px] font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
                {error.stack.slice(0, 600)}{error.stack.length > 600 ? '…' : ''}
              </pre>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry panel
              </button>
              <CopyButton text={details} />
              <button
                onClick={() => { window.location.reload() }}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Key on errorId so Retry forces a full remount of the child tree
    return (
      <div key={errorId} className={cn('contents', this.props.className)}>
        {this.props.children}
      </div>
    )
  }
}

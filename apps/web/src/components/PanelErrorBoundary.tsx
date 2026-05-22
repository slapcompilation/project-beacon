// Per-panel error boundary: one broken panel doesn't crash the workspace.
// Retry forces a remount by bumping a key.

import { Component, useState } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { Button, Icon, Intent } from '@blueprintjs/core'
import { cn } from '@/lib/utils'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }
  return (
    <Button
      size="small"
      variant="outlined"
      icon={copied ? 'tick' : 'duplicate'}
      onClick={() => { void handleCopy() }}
    >
      {copied ? 'Copied' : 'Copy error'}
    </Button>
  )
}

interface Props {
  children:  ReactNode
  name?:     string
  className?: string
}

interface State {
  error: Error | null
  errorId: number
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
            <div className="flex items-start gap-3">
              <Icon icon="warning-sign" size={14} intent={Intent.DANGER} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {this.props.name ? `${this.props.name} — ` : ''}Runtime error
                </div>
                <p className="mt-0.5 text-xs font-mono text-muted-foreground break-all leading-relaxed">
                  {error.message}
                </p>
              </div>
            </div>

            {error.stack && (
              <pre className="max-h-32 overflow-y-auto rounded border bg-muted/30 p-2.5 text-[10px] font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
                {error.stack.slice(0, 600)}{error.stack.length > 600 ? '…' : ''}
              </pre>
            )}

            <div className="flex items-center gap-2">
              <Button size="small" intent={Intent.PRIMARY} icon="refresh" onClick={this.handleRetry}>
                Retry panel
              </Button>
              <CopyButton text={details} />
              <Button
                variant="minimal"
                size="small"
                onClick={() => { window.location.reload() }}
                className="!ml-auto"
              >
                Reload page
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div key={errorId} className={cn('contents', this.props.className)}>
        {this.props.children}
      </div>
    )
  }
}

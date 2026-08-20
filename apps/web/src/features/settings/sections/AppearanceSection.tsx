// Personal: theme picker (Light / Dark / Follow system).

import { Icon, type IconName } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { SectionHeader } from './_shared'

type Theme = 'light' | 'dark' | 'system'

interface ThemeOption {
  value:       Theme
  label:       string
  description: string
  icon:        IconName
  /** Two-tone preview swatch — outer (page) + inner (card). */
  preview: { page: string; card: string; border: string; accent: string }
}

const OPTIONS: ThemeOption[] = [
  {
    value:       'light',
    label:       'Light',
    description: 'Bright surfaces, ideal for daytime ops floors.',
    icon:        'flash',
    preview: { page: '#f4f6f9', card: '#ffffff', border: '#dce0e5', accent: '#2d72d2' },
  },
  {
    value:       'dark',
    label:       'Dark',
    description: 'Lower glare for control-tower and overnight shifts.',
    icon:        'moon',
    preview: { page: '#16191e', card: '#252a31', border: '#3a414c', accent: '#8abbff' },
  },
  {
    value:       'system',
    label:       'Follow system',
    description: 'Match your OS appearance and switch automatically.',
    icon:        'desktop',
    preview: { page: 'linear-gradient(135deg, #f4f6f9 0 49%, #16191e 51% 100%)', card: 'transparent', border: 'transparent', accent: '#2d72d2' },
  },
]

export function AppearanceSection() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  return (
    <div>
      <SectionHeader
        title="Appearance"
        description="Pick how the interface looks. Applies instantly and persists across sessions."
      />

      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const active = theme === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => { setTheme(opt.value) }}
              className={cn(
                'group flex flex-col gap-3 rounded-md border p-3 text-left transition-all',
                active
                  ? 'border-primary ring-2 ring-primary/30 bg-muted/20'
                  : 'border-border hover:border-muted-foreground/40 hover:bg-muted/40',
              )}
            >
              {/* Two-tone preview tile */}
              <div
                className="relative h-16 rounded-sm border overflow-hidden"
                style={{
                  background: opt.preview.page,
                  borderColor: opt.preview.border,
                }}
              >
                {opt.value !== 'system' && (
                  <>
                    <div
                      className="absolute inset-x-2 top-2 h-3 rounded-sm"
                      style={{ background: opt.preview.card, border: `1px solid ${opt.preview.border}` }}
                    />
                    <div
                      className="absolute left-2 bottom-2 h-2 w-8 rounded-sm"
                      style={{ background: opt.preview.accent }}
                    />
                    <div
                      className="absolute left-12 bottom-2 h-2 w-12 rounded-sm opacity-60"
                      style={{ background: opt.preview.card }}
                    />
                  </>
                )}
              </div>

              <div className="flex items-start gap-2">
                <Icon icon={opt.icon} size={14} className={active ? 'text-primary mt-0.5' : 'text-muted-foreground mt-0.5'} />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold', active && 'text-primary')}>{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{opt.description}</p>
                </div>
                {active && <Icon icon="tick" size={14} className="text-primary mt-0.5" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

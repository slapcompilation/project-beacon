// Flag settings — the sub-page `cleanup-configuration-view.png` draws.
//
// Two radios ("Optimized for usage · Default" versus "Custom"), then every
// published flag as a toggle with a Priority dropdown and, for the two that
// take one, a parameter. Five ship on and two off.
//
// The mode is not cosmetic. "Note that if using a custom flag setup, new flags
// that get added in the future will not be automatically turned on if they are
// turned on when using the default set of flags." So the default set stays a
// live reference and overrides exist only in custom mode — which is why this
// page writes a mode plus departures, never a row per flag.
//
// And two flags cannot be computed here at all. Foundry renders every flag it
// has; rendering ours identically would make "we cannot compute this" look like
// "this found nothing", so each says which it is and why.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Callout, HTMLSelect, InputGroup, NumericInput, Radio, RadioGroup,
  Spinner, Switch, Tag, Tooltip,
} from '@blueprintjs/core'
import { useAppStore } from '@/stores/app.store'
import {
  FLAG_LABEL, useCleanupConfig, useCleanupFlags, useEffectiveFlags, useSaveFlagSettings,
} from '@/features/cleanup/api'

interface Draft { enabled: boolean; priority: string; days: number | null; regex: string | null }

export default function CleanupFlagsPage() {
  const ontologyId = useAppStore((s) => s.omaOntologyId)
  const config = useCleanupConfig(ontologyId)
  const configId = config.data?.id ?? null
  const published = useCleanupFlags()
  const effective = useEffectiveFlags(configId)
  const save = useSaveFlagSettings(configId, ontologyId)

  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [draft, setDraft] = useState<Partial<Record<string, Draft>>>({})

  useEffect(() => {
    if (config.data) setMode(config.data.mode === 'custom' ? 'custom' : 'default')
  }, [config.data])
  useEffect(() => {
    if (!effective.data) return
    setDraft(Object.fromEntries(effective.data.map((f) => [f.flag, {
      enabled: f.enabled, priority: f.priority, days: f.days, regex: f.regex,
    }])))
  }, [effective.data])

  if (config.isLoading || published.isLoading || effective.isLoading) return <Spinner size={20} />
  const flags = published.data ?? []

  return (
    <section className="max-w-3xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <Link to="/ontology/cleanup">
          <Button variant="minimal" size="small" icon="chevron-left">Cleanup</Button>
        </Link>
        <h1 className="text-base font-semibold">Flag settings</h1>
      </header>

      <div>
        <p className="mb-1 text-xs font-semibold">Choose cleanup configuration</p>
        <RadioGroup selectedValue={mode}
          onChange={(e) => { setMode(e.currentTarget.value as 'default' | 'custom') }}>
          <Radio value="default" labelElement={
            <span className="text-xs">
              <strong>Optimized for usage</strong> <Tag minimal className="!text-[10px]">Default</Tag>
              <span className="block text-neutral-500">Recommended flags for usage optimization</span>
            </span>
          } />
          <Radio value="custom" labelElement={
            <span className="text-xs">
              <strong>Custom</strong>
              <span className="block text-neutral-500">Choose custom flags to use</span>
            </span>
          } />
        </RadioGroup>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold">Choose cleanup flags to perform checks</p>
        <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
          {flags.map((f) => {
            const d = draft[f.flag]
            const locked = mode === 'default'
            return (
              <li key={f.flag} className="space-y-1 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Switch className="!mb-0" checked={d?.enabled ?? f.default_on} disabled={locked}
                    onChange={() => {
                      setDraft({ ...draft, [f.flag]: { ...d, enabled: !(d?.enabled ?? f.default_on) } as Draft })
                    }} />
                  <span className="flex-1 text-xs">{FLAG_LABEL[f.flag] ?? f.flag}</span>
                  {!f.computable &&
                    <Tooltip content={<span className="max-w-xs text-xs">{f.note}</span>}>
                      <Tag minimal intent="warning" className="!text-[10px]">not computed here</Tag>
                    </Tooltip>}
                  <span className="text-[10px] uppercase tracking-wide text-neutral-500">Priority</span>
                  <HTMLSelect disabled={locked} value={d?.priority ?? f.priority}
                    options={['high', 'medium', 'low']}
                    onChange={(e) => {
                      setDraft({ ...draft, [f.flag]: { ...d, priority: e.currentTarget.value } as Draft })
                    }} />
                </div>
                {f.parameter === 'days' &&
                  <NumericInput size="small" disabled={locked} min={1} value={d?.days ?? 0}
                    onValueChange={(v) => { setDraft({ ...draft, [f.flag]: { ...d, days: v } as Draft }) }} />}
                {f.parameter === 'regex' &&
                  <InputGroup size="small" disabled={locked} value={d?.regex ?? ''}
                    onChange={(e) => { setDraft({ ...draft, [f.flag]: { ...d, regex: e.currentTarget.value } as Draft }) }} />}
              </li>
            )
          })}
        </ul>
      </div>

      <Callout intent="none" icon="info-sign" className="!text-xs">
        Saving changes to flag settings will reset previous Cleanup results.
        Under the default set a flag added later turns on for you automatically;
        under Custom it does not.
      </Callout>

      <Button intent="primary" size="small" loading={save.isPending}
        onClick={() => {
          save.mutate({
            mode,
            overrides: mode === 'custom'
              ? flags.map((f) => {
                  const d = draft[f.flag]
                  return {
                    flag: f.flag,
                    enabled: d?.enabled ?? f.default_on,
                    priority: d?.priority,
                    days: d?.days ?? undefined,
                    regex: d?.regex ?? undefined,
                  }
                })
              : [],
          })
        }}>Save changes</Button>
    </section>
  )
}

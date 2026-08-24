// The checkpoint prompt, drawn from the user-side capture
// (checkpoints/images/export-checkpoint.png): a flag-icon Checkpoint header,
// the configured title behind a warning glyph, the prompt, the description in
// lighter text, the justification input per type, the submitting user and
// timestamp in the footer, and Submit disabled until the justification is
// valid. Recent justifications render as the history menu of
// recent-justifications-example.png.
import { useState } from 'react'
import {
  Button, Checkbox, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, Menu, MenuItem, Popover, Spinner, TextArea,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import {
  submitCheckpointRecord, useCheckpointConfig, useRecentJustifications,
  type CheckpointConfig, type JustificationValue,
} from './api'
import { useCheckpointGate } from './gate'

/** Mounted once in the shell; renders whenever a guarded operation is
 *  waiting on a justification. */
export function CheckpointHost() {
  const pending = useCheckpointGate((s) => s.pending)
  if (pending === null) return null
  return <CheckpointPrompt key={pending.configId} configId={pending.configId} />
}

function CheckpointPrompt({ configId }: { configId: string }) {
  const settle = useCheckpointGate((s) => s.settle)
  const items = useCheckpointGate((s) => s.pending?.items ?? [])
  const { data: config, isLoading } = useCheckpointConfig(configId)
  const [submitting, setSubmitting] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [response, setResponse] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [extras, setExtras] = useState<Record<string, string>>({})
  const email = useAuthStore((s) => s.session?.user.email ?? null)
  const showRecent = config?.justification_type === 'response'
    && config.justification_config.display_recent === true
  const { data: recent = [] } = useRecentJustifications(configId, showRecent)

  const justification = (): JustificationValue | null => {
    if (config === null || config === undefined) return null
    if (config.justification_type === 'acknowledgment') {
      return acknowledged ? { kind: 'acknowledgment', acknowledged: true } : null
    }
    if (config.justification_type === 'response') {
      if (response.trim() === '') return null
      const regex = config.justification_config.regex
      if (regex !== undefined) {
        try { if (!new RegExp(regex).test(response)) return null } catch { /* server validates */ }
      }
      return { kind: 'response', response }
    }
    if (selected.length === 0) return null
    const options = config.justification_config.options ?? []
    const selections = selected.map((label) => {
      const extra = (extras[label] ?? '').trim()
      return extra === '' ? { option: label } : { option: label, additional_response: extra }
    })
    for (const sel of selections) {
      const opt = options.find((o) => o.label === sel.option)
      if (opt?.free_response === 'mandatory' && sel.additional_response === undefined) return null
    }
    return { kind: 'dropdown', selections }
  }
  const value = justification()

  return (
    <Dialog isOpen title={<span className="flex items-center gap-2"><Icon icon="flag" />Checkpoint</span>}
      onClose={() => { settle(false) }} canOutsideClickClose={false}>
      <DialogBody>
        {isLoading || config === undefined ? <Spinner /> : config === null ? (
          <p className="text-sm">This checkpoint's configuration is not visible to you.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon icon="warning-sign" intent={Intent.WARNING} />
              <span className="text-sm font-semibold">{config.title}</span>
            </div>
            <p className="text-sm">{config.prompt}</p>
            {config.checkpoint_description !== '' && (
              <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
                {config.checkpoint_description}
              </p>
            )}
            <JustificationInput config={config} acknowledged={acknowledged}
              setAcknowledged={setAcknowledged} response={response} setResponse={setResponse}
              selected={selected} setSelected={setSelected} extras={extras} setExtras={setExtras}
              recent={recent} />
          </div>
        )}
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button text="Cancel" onClick={() => { settle(false) }} />
          <Button intent={Intent.PRIMARY} text="Submit" loading={submitting}
            disabled={value === null || submitting}
            onClick={() => {
              if (value === null) return
              setSubmitting(true)
              submitCheckpointRecord(configId, value, items)
                .then(() => { settle(true) })
                .catch((e: unknown) => {
                  toast.error(e instanceof Error ? e.message : String(e))
                  setSubmitting(false)
                })
            }} />
        </>
      }>
        <span className="text-[11px] text-muted-foreground">
          {email ?? ''} · {new Date().toLocaleString()}
        </span>
      </DialogFooter>
    </Dialog>
  )
}

function JustificationInput({ config, acknowledged, setAcknowledged, response, setResponse,
  selected, setSelected, extras, setExtras, recent }: {
  config: CheckpointConfig
  acknowledged: boolean
  setAcknowledged: (v: boolean) => void
  response: string
  setResponse: (v: string) => void
  selected: string[]
  setSelected: (v: string[]) => void
  extras: Record<string, string>
  setExtras: (v: Record<string, string>) => void
  recent: { response: string; at: string }[]
}) {
  const cfg = config.justification_config
  if (config.justification_type === 'acknowledgment') {
    return (
      <Checkbox checked={acknowledged} label={cfg.checkbox_text ?? 'I acknowledge'}
        onChange={(e) => { setAcknowledged(e.currentTarget.checked) }} />
    )
  }
  if (config.justification_type === 'response') {
    return (
      <div className="ckpt-response">
        <TextArea fill value={response} placeholder={cfg.placeholder ?? 'Enter your justification.'}
          onChange={(e) => { setResponse(e.currentTarget.value) }} />
        {cfg.display_recent === true && recent.length > 0 && (
          <Popover position="bottom-right" content={
            <Menu>
              {recent.map((r) => (
                <MenuItem key={r.at} icon="history" text={r.response}
                  label={`Last used on ${new Date(r.at).toLocaleString()}`}
                  onClick={() => { setResponse(r.response) }} />
              ))}
            </Menu>
          }>
            <Button variant="minimal" size="small" icon="history" className="ckpt-history"
              aria-label="Recent justifications" />
          </Popover>
        )}
      </div>
    )
  }
  const options = cfg.options ?? []
  const multiple = cfg.multiple === true
  return (
    <div className="space-y-2">
      {multiple ? (
        // "If users can select multiple options, the dropdown will be
        // presented as a set of checkboxes to the user."
        options.map((o) => (
          <Checkbox key={o.label} checked={selected.includes(o.label)} label={o.label}
            onChange={(e) => {
              setSelected(e.currentTarget.checked
                ? [...selected, o.label] : selected.filter((l) => l !== o.label))
            }} />
        ))
      ) : (
        <HTMLSelect fill value={selected[0] ?? ''}
          onChange={(e) => { setSelected(e.currentTarget.value === '' ? [] : [e.currentTarget.value]) }}>
          <option value="">Select a justification…</option>
          {options.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
        </HTMLSelect>
      )}
      {options.filter((o) => selected.includes(o.label) && o.free_response !== undefined
        && o.free_response !== 'disabled').map((o) => (
          <InputGroup key={o.label} value={extras[o.label] ?? ''}
            placeholder={`${o.label} — ${o.free_response === 'mandatory' ? 'response required' : 'optional response'}`}
            onChange={(e) => { setExtras({ ...extras, [o.label]: e.currentTarget.value }) }} />
        ))}
    </div>
  )
}

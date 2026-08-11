// Value Types Manager — its own application off the platform sidebar.
// "1. Navigate to the Value Types Manager application from the platform
//  sidebar. 2. From the top left corner, use the dropdown menu to select the
//  space… 3. Select Create New Value Type from the upper right corner."
// (object-link-types/create-value-type)

import { useEffect, useState } from 'react'
import {
  Button, Callout, Card, Checkbox, Dialog, DialogBody, DialogFooter,
  HTMLSelect, Icon, InputGroup, Intent, Radio, RadioGroup, Tag, TextArea,
} from '@blueprintjs/core'
import { PROPERTY_TYPES, toCamel, type PropertyType } from '@beacon/ontology'
import {
  useSpaces, useValueTypes, useCreateValueType, useMintVersion, checkValue,
  type ConstraintDraft, type ConstraintKind, type ValueTypeRow,
} from '@/features/valueTypes/api'

export default function ValueTypesPage() {
  const { data: spaces = [] } = useSpaces()
  const [spaceId, setSpaceId] = useState<string | null>(null)
  useEffect(() => {
    if (spaceId === null && spaces.length > 0) setSpaceId(spaces[0].id)
  }, [spaces, spaceId])
  const { data: rows = [] } = useValueTypes(spaceId)
  const [creating, setCreating] = useState(false)

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <HTMLSelect value={spaceId ?? ''} onChange={(e) => { setSpaceId(e.currentTarget.value || null) }}>
          {spaces.length === 0 && <option value="">No spaces</option>}
          {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </HTMLSelect>
        <h1 className="text-base font-semibold">Value types</h1>
        <Button intent={Intent.PRIMARY} icon="add" className="ml-auto" disabled={!spaceId}
          onClick={() => { setCreating(true) }}>Create New Value Type</Button>
      </div>

      {rows.length === 0 && (
        <Callout>
          A value type is a reusable declaration: a base type plus a constraint, owned by this space.
          Bind one to a property in Ontology Manager.
        </Callout>
      )}
      {rows.map((vt) => <ValueTypeCard key={vt.id} vt={vt} spaceId={spaceId ?? ''} />)}

      {spaceId && <CreateWizard spaceId={spaceId} isOpen={creating} onClose={() => { setCreating(false) }} />}
    </div>
  )
}

const iconFor = (t: PropertyType) => PROPERTY_TYPES.find((p) => p.value === t)?.label ?? t

function summarize(c: { kind: string; params: Record<string, unknown> } | null): string {
  if (!c) return 'No constraint'
  switch (c.kind) {
    case 'enum': return `One of: ${(c.params.values as string[] | undefined)?.join(', ') ?? ''}`
    case 'range': return `Range ${String((c.params.min as number | undefined) ?? '−∞')} … ${String((c.params.max as number | undefined) ?? '∞')}`
    case 'regex': return `Matches ${(c.params.pattern as string | undefined) ?? ''}`
    default: return c.kind.toUpperCase()
  }
}

function ValueTypeCard({ vt, spaceId }: { vt: ValueTypeRow; spaceId: string }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const mint = useMintVersion(spaceId)
  const [draft, setDraft] = useState<ConstraintDraft | null>(null)

  return (
    <Card className="space-y-2 !py-3">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setOpen(!open) }}>
        <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={12} />
        <span className="text-sm font-medium">{vt.displayName}</span>
        <code className="text-[11px] text-muted-foreground">{vt.apiName}</code>
        <Tag minimal className="!text-[10px]">{iconFor(vt.baseType)}</Tag>
        <Tag minimal className="!text-[10px] tabular-nums ml-auto">v{vt.currentVersion}</Tag>
      </div>
      {open && (
        <div className="pl-5 space-y-2 text-xs">
          {vt.description && <p className="text-muted-foreground">{vt.description}</p>}
          <div className="flex items-center gap-2">
            <span>{summarize(vt.constraint)}</span>
            <Button variant="minimal" size="small" icon="edit" title="Update the constraint — mints a new version"
              onClick={() => { setEditing(!editing); setDraft(vt.constraint as ConstraintDraft | null) }} />
          </div>
          <p className="text-muted-foreground">On failure: “{vt.failureMessage}”</p>
          {editing && (
            <div className="space-y-2 border rounded p-2">
              <ConstraintCard baseType={vt.baseType} draft={draft} onChange={setDraft} />
              <Button size="small" intent={Intent.PRIMARY} loading={mint.isPending}
                onClick={() => { mint.mutate({ id: vt.id, constraint: draft }, { onSuccess: () => { setEditing(false) } }) }}>
                Mint new version
              </Button>
            </div>
          )}
          <LiveCheck valueTypeId={vt.id} failureMessage={vt.failureMessage} />
        </div>
      )}
    </Card>
  )
}

/** "Check inputs against your constraints" — the stored validator answers. */
function LiveCheck({ valueTypeId, failureMessage }: { valueTypeId: string; failureMessage: string }) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<boolean | null>(null)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <InputGroup size="small" placeholder="Value" value={value}
          onChange={(e) => { setValue(e.currentTarget.value); setResult(null) }} />
        <Button size="small" disabled={!value}
          onClick={() => { void checkValue(valueTypeId, value).then(setResult) }}>Check</Button>
      </div>
      {result !== null && (
        <Tag minimal intent={result ? Intent.SUCCESS : Intent.DANGER} icon={result ? 'tick' : 'cross'}
          className="!text-[10px]">
          {result ? 'Passing validation' : failureMessage}
        </Tag>
      )}
    </div>
  )
}

// The kinds the wizard offers, in the screenshot's grid order. uniqueness,
// nested and element exist in the schema but need referenced types the wizard
// does not collect yet.
const KINDS: { kind: ConstraintKind; label: string }[] = [
  { kind: 'rid', label: 'RID' }, { kind: 'uuid', label: 'UUID' },
  { kind: 'range', label: 'Range' }, { kind: 'regex', label: 'Regex' },
  { kind: 'enum', label: 'Enum' },
]

function ConstraintCard({ baseType, draft, onChange }: {
  baseType: PropertyType
  draft: ConstraintDraft | null
  onChange: (next: ConstraintDraft | null) => void
}) {
  const set = (kind: ConstraintKind) => { onChange({ kind, params: {} }) }
  const param = (patch: Record<string, unknown>) => {
    if (draft) onChange({ ...draft, params: { ...draft.params, ...patch } })
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">Constraint</span>
        {draft && <Button variant="minimal" size="small" icon="trash" className="ml-auto"
          onClick={() => { onChange(null) }} />}
      </div>
      <RadioGroup inline selectedValue={draft?.kind ?? ''}
        onChange={(e) => { set(e.currentTarget.value as ConstraintKind) }}>
        {KINDS.map((k) => <Radio key={k.kind} value={k.kind} label={k.label} />)}
      </RadioGroup>
      {draft?.kind === 'enum' && (
        <div className="space-y-1">
          <InputGroup size="small" placeholder="Values, comma-separated"
            value={(draft.params.values as string[] | undefined)?.join(', ') ?? ''}
            onChange={(e) => { param({ values: e.currentTarget.value.split(',').map((v) => v.trim()).filter(Boolean) }) }} />
          <Checkbox label="Case insensitive" checked={draft.params.case_sensitive === false}
            onChange={(e) => { param({ case_sensitive: !e.currentTarget.checked }) }} />
        </div>
      )}
      {draft?.kind === 'range' && (
        <div className="flex gap-2">
          <InputGroup size="small" placeholder="Min" value={String((draft.params.min as number | undefined) ?? '')}
            onChange={(e) => { param({ min: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) }) }} />
          <InputGroup size="small" placeholder="Max" value={String((draft.params.max as number | undefined) ?? '')}
            onChange={(e) => { param({ max: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) }) }} />
        </div>
      )}
      {draft?.kind === 'regex' && (
        <InputGroup size="small" placeholder="Pattern" value={(draft.params.pattern as string | undefined) ?? ''}
          onChange={(e) => { param({ pattern: e.currentTarget.value }) }} />
      )}
      {baseType !== 'string' && (draft?.kind === 'regex' || draft?.kind === 'enum') && (
        <p className="text-[11px] text-amber-600">This constraint reads the value as text.</p>
      )}
    </div>
  )
}

type Step = 'metadata' | 'constraints' | 'preview'
const STEPS: { id: Step; n: number; label: string }[] = [
  { id: 'metadata', n: 1, label: 'Metadata' },
  { id: 'constraints', n: 2, label: 'Constraints' },
  { id: 'preview', n: 3, label: 'Preview' },
]

function CreateWizard({ spaceId, isOpen, onClose }: { spaceId: string; isOpen: boolean; onClose: () => void }) {
  const create = useCreateValueType(spaceId)
  const [step, setStep] = useState<Step>('metadata')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [apiName, setApiName] = useState('')
  const [baseType, setBaseType] = useState<PropertyType>('string')
  const [draft, setDraft] = useState<ConstraintDraft | null>(null)
  const [failureMessage, setFailureMessage] = useState('')
  const [example, setExample] = useState('')

  const metadataOk = name.trim() !== '' && (apiName || toCamel(name)) !== ''
  const reset = () => {
    setStep('metadata'); setName(''); setDescription(''); setApiName('')
    setBaseType('string'); setDraft(null); setFailureMessage(''); setExample('')
  }
  const submit = () => {
    create.mutate({
      displayName: name.trim(), apiName: apiName || toCamel(name), description: description.trim(),
      baseType, failureMessage: failureMessage.trim(), exampleValue: example.trim(),
      constraint: draft,
    }, { onSuccess: () => { reset(); onClose() } })
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create new value type" style={{ width: 560 }}>
      <DialogBody>
        <div className="flex gap-4">
          <div className="w-32 shrink-0 space-y-2">
            {STEPS.map((s) => (
              <div key={s.id} className={`text-xs flex items-center gap-1.5 ${step === s.id ? 'font-semibold text-violet-500' : 'text-muted-foreground'}`}>
                <Tag minimal round className="!text-[10px]">{s.n}</Tag>{s.label}
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-3">
            {step === 'metadata' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold">Metadata</h3>
                  <p className="text-xs text-muted-foreground">Give your value type a searchable name, description and base type.</p>
                </div>
                <InputGroup placeholder="Give your value type a unique name" value={name}
                  onChange={(e) => { setName(e.currentTarget.value) }} />
                <TextArea fill placeholder="Describe what the value type does" value={description}
                  onChange={(e) => { setDescription(e.currentTarget.value) }} />
                <InputGroup placeholder={toCamel(name) || 'Give your value type an api name to allow references in code'}
                  value={apiName} onChange={(e) => { setApiName(e.currentTarget.value) }} className="font-mono" />
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Base type — once saved cannot be modified
                  </span>
                  <HTMLSelect value={baseType} onChange={(e) => { setBaseType(e.currentTarget.value as PropertyType) }}>
                    {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </HTMLSelect>
                </label>
              </>
            )}
            {step === 'constraints' && (
              <>
                <ConstraintCard baseType={baseType} draft={draft} onChange={setDraft} />
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Failure validation message</span>
                  <InputGroup placeholder="Constraint failed" value={failureMessage}
                    onChange={(e) => { setFailureMessage(e.currentTarget.value) }} />
                </label>
              </>
            )}
            {step === 'preview' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold">Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Provide an example value. Once created, the card's Check panel validates inputs against the stored constraint.
                  </p>
                </div>
                <InputGroup placeholder="Value" value={example}
                  onChange={(e) => { setExample(e.currentTarget.value) }} />
              </>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFooter actions={<>
        <Button onClick={onClose}>Close</Button>
        {step !== 'metadata' && (
          <Button onClick={() => { setStep(step === 'preview' ? 'constraints' : 'metadata') }}>Back</Button>
        )}
        {step !== 'preview' ? (
          <Button intent={Intent.PRIMARY} disabled={!metadataOk}
            onClick={() => { setStep(step === 'metadata' ? 'constraints' : 'preview') }}>Next</Button>
        ) : (
          <Button intent={Intent.PRIMARY} loading={create.isPending} onClick={submit}>Create value type</Button>
        )}
      </>} />
    </Dialog>
  )
}

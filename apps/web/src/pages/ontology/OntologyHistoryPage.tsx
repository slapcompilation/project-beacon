// The Ontology history page — "Select the History tab in the homepage
// sidebar to view a list of all saved Ontology changes with details on when
// the changes were made and the user who applied them." Entries are
// collapsed by default; a change to an object type carries the restore
// button, whose result is STAGED: "The changes will be added to your working
// state and you will need to save your changes to the Ontology for your
// restore to take effect." The engine is 672's; this is its first reader.

import { useState } from 'react'
import {
  Alert, Button, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { restoreObjectType } from '@beacon/platform'
import { useOmaOntology } from '@/features/ontologyManager/resources'

interface SaveRow {
  id: string
  via: string
  savedBy: string | null
  savedAt: string
  ontologyVersion: number
}

interface ChangeRow {
  id: string
  resourceKind: string
  resourceId: string
  operation: string
  label: string | null
  fields: Record<string, unknown>
  base: Record<string, unknown>
}

function useOntologySaves(ontologyId: string | null) {
  return useQuery({
    queryKey: ['ontology-saves', ontologyId ?? ''],
    enabled: ontologyId !== null,
    queryFn: async (): Promise<SaveRow[]> => {
      const { data, error } = await supabase.from('ontology_saves')
        .select('id, via, saved_by, saved_at, ontology_version')
        .eq('ontology_id', ontologyId ?? '')
        .order('saved_at', { ascending: false }).limit(100)
      if (error) throw new Error(error.message)
      return (data as {
        id: string; via: string; saved_by: string | null
        saved_at: string; ontology_version: number
      }[]).map((r) => ({
        id: r.id, via: r.via, savedBy: r.saved_by,
        savedAt: r.saved_at, ontologyVersion: r.ontology_version,
      }))
    },
  })
}

function useSaveChanges(saveId: string | null) {
  return useQuery({
    queryKey: ['ontology-save-changes', saveId ?? ''],
    enabled: saveId !== null,
    queryFn: async (): Promise<ChangeRow[]> => {
      const { data, error } = await supabase.from('ontology_save_changes')
        .select('id, resource_kind, resource_id, operation, label, fields, base')
        .eq('save_id', saveId ?? '')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; resource_kind: string; resource_id: string; operation: string
        label: string | null; fields: Record<string, unknown>; base: Record<string, unknown>
      }[]).map((r) => ({
        id: r.id, resourceKind: r.resource_kind, resourceId: r.resource_id,
        operation: r.operation, label: r.label, fields: r.fields, base: r.base,
      }))
    },
  })
}

export default function OntologyHistoryPage() {
  const { ontology } = useOmaOntology()
  const { data: saves = [], isLoading } = useOntologySaves(ontology?.id ?? null)
  if (!ontology) return <NonIdealState icon="cube" title="Open an ontology first" />
  return (
    <div className="px-8 py-6 max-w-3xl space-y-3">
      <header>
        <h1 className="text-xl font-semibold">Ontology history</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Every entry is one save — who, when, and what changed. Restoring an object type
          stages the older version into your working state; the restore takes effect when
          you save.
        </p>
      </header>
      {isLoading ? <Spinner size={SpinnerSize.SMALL} />
        : saves.length === 0 ? (
          <NonIdealState icon="history" title="No saves yet"
            description="The first save to this ontology starts its history." />
        ) : saves.map((s) => <SaveEntry key={s.id} save={s} />)}
    </div>
  )
}

function SaveEntry({ save }: { save: SaveRow }) {
  const [open, setOpen] = useState(false)
  const { data: changes = [] } = useSaveChanges(open ? save.id : null)
  return (
    <Card compact>
      <button type="button" className="oh-row" onClick={() => { setOpen(!open) }}>
        <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={12} />
        <Icon icon="floppy-disk" size={12} className="text-violet-500" />
        <span className="text-sm font-medium">v{save.ontologyVersion}</span>
        <Tag minimal className="!text-[9px]">{save.via}</Tag>
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(save.savedAt).toLocaleString()}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {changes.length === 0
            ? <p className="text-xs text-muted-foreground">No visible changes in this save.</p>
            : changes.map((c) => <ChangeLine key={c.id} change={c} saveId={save.id} />)}
        </div>
      )}
    </Card>
  )
}

function ChangeLine({ change, saveId }: { change: ChangeRow; saveId: string }) {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const restore = useMutation({
    mutationFn: () => client(restoreObjectType).applyAction(
      { p_object_type: change.resourceId, p_save: saveId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Restore staged — save your changes for it to take effect')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
  const moved = Object.keys(change.fields)
  return (
    <div className="flex items-center gap-2 text-xs pl-6">
      <Tag minimal className="!text-[9px]">{change.resourceKind.replace('_', ' ')}</Tag>
      <span className="font-medium">{change.label ?? change.resourceId}</span>
      <span className="text-muted-foreground">{change.operation}</span>
      {moved.length > 0 && (
        <span className="text-muted-foreground truncate">{moved.join(', ')}</span>
      )}
      {change.resourceKind === 'object_type' && change.operation !== 'deleted' && (
        <>
          <Button variant="minimal" size="small" icon="history" className="ml-auto"
            title="Restore the object type to this version"
            loading={restore.isPending}
            onClick={() => { setConfirming(true) }} />
          <Alert isOpen={confirming} intent={Intent.WARNING} icon="history"
            confirmButtonText="Confirm" cancelButtonText="Cancel"
            onCancel={() => { setConfirming(false) }}
            onConfirm={() => { setConfirming(false); restore.mutate() }}>
            Changes made after this entry will be undone. The restore is added to your
            working state — save your changes for it to take effect.
          </Alert>
        </>
      )}
    </div>
  )
}
